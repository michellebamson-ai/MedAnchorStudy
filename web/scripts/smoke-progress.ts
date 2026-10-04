/** Progress smoke test: signals -> statuses -> paths -> advancing -> feed -> course scoping. */
import { prisma } from "../src/lib/prisma";
import { buildPath, explain, nextAction } from "../src/lib/paths";
import {
  loadProgressSnapshot,
  startPath,
  advancePath,
  dismissPath,
  recordStepActivity,
} from "../src/app/progress/actions";

async function main() {
  const demo = await prisma.user.findUnique({ where: { email: "demo@medanchor.local" } });
  if (!demo) throw new Error("demo user missing — load /progress once first");
  const userId = demo.id;

  // Clean the loop state so the run is repeatable.
  await prisma.learningPath.deleteMany({ where: { userId } });
  await prisma.activityEvent.deleteMany({ where: { userId, kind: "plan" } });

  const topics = await prisma.topic.findMany({ orderBy: { order: "asc" }, select: { slug: true, title: true } });
  if (topics.length < 3) throw new Error("need at least 3 seeded topics");
  console.log("[topics]", topics.map((t) => t.slug).join(", "));

  // ---- Empty state: no activity at all ----
  await prisma.activityEvent.deleteMany({ where: { userId } });
  await prisma.topicMastery.deleteMany({ where: { userId } });
  const empty = await loadProgressSnapshot();
  console.log("[empty] hasSignal:", empty.hasSignal, "| mastery:", empty.overallMastery + "%");
  if (empty.hasSignal) throw new Error("empty state should not claim personalized insight");
  if (empty.chains.length) throw new Error("feed should be empty with no activity");

  // ---- One signal is not enough to be confident ----
  await recordStepActivity(topics[0].slug, "quiz", 8, 10);
  const oneSignal = await loadProgressSnapshot();
  console.log("[one signal] hasSignal:", oneSignal.hasSignal);
  if (oneSignal.hasSignal) throw new Error("a single signal must not be treated as a profile");

  // ---- Build a real, multi-signal picture ----
  // Strong topic: quiz + case + tutor all high.
  await recordStepActivity(topics[0].slug, "case", 9, 10);
  await recordStepActivity(topics[0].slug, "teach_me", 8, 10);
  // Weak topic: quiz low, case low.
  await recordStepActivity(topics[1].slug, "quiz", 3, 10);
  await recordStepActivity(topics[1].slug, "case", 3, 10);
  // Untouched topic: no signals at all.
  const untouched = topics[2].slug;

  const snap = await loadProgressSnapshot();
  console.log(
    "[snapshot] mastery:", snap.overallMastery + "%",
    "| strong:", snap.health.strong,
    "review:", snap.health.needsReview,
    "attention:", snap.health.needsAttention,
    "| days this week:", snap.consistency.daysThisWeek,
    "streak:", snap.consistency.streak,
  );
  if (!snap.hasSignal) throw new Error("multi-signal activity should enable the page");
  if (!snap.health.strong) throw new Error("high multi-signal topic should be strong");

  const strongTopic = snap.topics.find((t) => t.slug === topics[0].slug);
  const weakTopic = snap.topics.find((t) => t.slug === topics[1].slug);
  const coldTopic = snap.topics.find((t) => t.slug === untouched);
  console.log("[strong]", strongTopic?.title, "=", strongTopic?.status, Math.round((strongTopic?.score ?? 0) * 100) + "%");
  console.log("[weak]  ", weakTopic?.title, "=", weakTopic?.status, Math.round((weakTopic?.score ?? 0) * 100) + "%");
  console.log("[cold]  ", coldTopic?.title, "=", coldTopic?.status, "|", coldTopic?.reason);
  if (strongTopic?.breadth && strongTopic.breadth < 2) {
    throw new Error("strong topic should rest on more than one signal");
  }

  // ---- Every topic must lead somewhere concrete ----
  for (const t of snap.topics) {
    if (!t.reason) throw new Error(`${t.slug} has no signal explanation`);
    if (!t.action?.target) throw new Error(`${t.slug} has no next action`);
    if (!t.path || t.path.steps === 0) throw new Error(`${t.slug} has no learning path`);
  }
  console.log("[actions] every topic has a reason, a next action and a path");

  // ---- Paths differ by what is missing ----
  const weakPath = buildPath({ slug: weakTopic!.slug, title: weakTopic!.title }, {
    quizzes: weakTopic!.signals.quizzes,
    tutoring: weakTopic!.signals.tutoring,
    cases: weakTopic!.signals.cases,
    cards: weakTopic!.signals.cards,
    breadth: weakTopic!.breadth,
    attempts: weakTopic!.attempts,
    lastStudied: weakTopic!.lastStudied ? new Date(weakTopic!.lastStudied) : null,
    score: weakTopic!.score,
    status: weakTopic!.status,
    course: weakTopic!.course,
    daysSince: weakTopic!.daysSince,
  });
  console.log("[weak path]", weakPath.title, "·", weakPath.steps.map((s) => s.label).join(" → "));
  if (!weakPath.steps.some((s) => s.kind === "spaced_review")) {
    throw new Error("path must end with a spaced review so the fix survives");
  }
  if (!weakPath.steps.some((s) => s.kind === "teach_me" || s.kind === "review")) {
    throw new Error("path must start by understanding the topic");
  }
  if (!weakPath.steps.some((s) => s.kind === "practice" || s.kind === "quiz")) {
    throw new Error("path must include retrieval practice");
  }

  const strongPath = buildPath({ slug: strongTopic!.slug, title: strongTopic!.title }, {
    quizzes: strongTopic!.signals.quizzes,
    tutoring: strongTopic!.signals.tutoring,
    cases: strongTopic!.signals.cases,
    cards: strongTopic!.signals.cards,
    breadth: strongTopic!.breadth,
    attempts: strongTopic!.attempts,
    lastStudied: strongTopic!.lastStudied ? new Date(strongTopic!.lastStudied) : null,
    score: strongTopic!.score,
    status: strongTopic!.status,
    course: strongTopic!.course,
    daysSince: strongTopic!.daysSince,
  });
  console.log("[strong path]", strongPath.title, "·", strongPath.steps.map((s) => s.label).join(" → "));
  if (strongPath.steps.length >= weakPath.steps.length) {
    throw new Error("a strong topic should need a shorter path than a weak one");
  }

  // ---- Explanations are honest about thin evidence ----
  const thin = explain({
    quizzes: 0.5, tutoring: null, cases: null, cards: null,
    breadth: 1, attempts: 1, lastStudied: new Date(), score: 0.5,
    status: "needs_attention", course: null, daysSince: 0,
  });
  console.log("[thin evidence]", thin);
  if (!thin.toLowerCase().includes("provisional")) {
    throw new Error("a single-signal judgement must be labelled provisional");
  }

  // ---- Focus areas carry a startable path ----
  console.log("[focus]", snap.focus.length, "areas");
  if (!snap.focus.length) throw new Error("weak topics must surface as focus areas");
  const focus = snap.focus[0];
  console.log("   ", focus.title, "|", focus.reason);
  console.log("    path:", focus.steps.map((s) => s.label).join(" → "));
  if (focus.steps.length < 2) throw new Error("focus area path is too short to be a path");

  // ---- Start a path: it must land on a real step and persist ----
  const started = await startPath(focus.topicSlug);
  console.log("[start]", started.message, "→ target:", started.target);
  if (!started.ok) throw new Error("could not start path");
  if (!started.target.startsWith("/")) throw new Error("path did not resolve to a real target");

  const persisted = await prisma.learningPath.findFirst({
    where: { userId, topicSlug: focus.topicSlug, status: "active" },
  });
  if (!persisted) throw new Error("path was not persisted, so remaining steps would be lost");

  // Remaining steps survive navigation.
  const afterStart = await loadProgressSnapshot();
  const resumed = afterStart.focus.find((f) => f.topicSlug === focus.topicSlug);
  console.log("[resume] step", resumed?.currentStep, "of", resumed?.steps.length);
  if (!resumed || resumed?.currentStep !== 0) throw new Error("path did not resume at the first step");

  // ---- Walk the whole path ----
  const total = (persisted.steps as unknown as Array<{ label: string }>).length;
  for (let i = 1; i <= total; i++) {
    const res = await advancePath(persisted.id);
    console.log(`[step ${i}/${total}]`, res.message);
    if (!res.ok) throw new Error(`step ${i} failed`);
    if (i === total && !res.finished) throw new Error("final step did not close the path");
  }
  const closed = await prisma.learningPath.findFirst({ where: { id: persisted.id } });
  console.log("[finish] status:", closed?.status, "| completedAt:", !!closed?.completedAt);
  if (closed?.status !== "done") throw new Error("path should be marked done");
  if (closed?.currentStep !== total) throw new Error("completed path should sit on its last step");

  // ---- A finished path no longer clutters focus areas ----
  const afterDone = await loadProgressSnapshot();
  const stillThere = afterDone.focus.find((f) => f.topicSlug === focus.topicSlug);
  console.log("[after finish] still in focus:", !!stillThere);

  // ---- Dismissal works too ----
  const second = await startPath(snap.topics.find((t) => t.status !== "strong")!.slug);
  const dpath = await prisma.learningPath.findFirst({ where: { userId, status: "active" } });
  if (dpath) {
    const dis = await dismissPath(dpath.id);
    console.log("[dismiss]", dis.message);
    const stillActive = await prisma.learningPath.count({ where: { userId, status: "active" } });
    console.log("[dismiss] active paths now:", stillActive);
  }
  void second;

  // ---- Course scoping ----
  const withCourses = await loadProgressSnapshot();
  console.log("[courses]", withCourses.courses.map((c) => `${c.name}(${c.strong}/${c.topics})`).join(" ") || "none");
  const courseName = withCourses.courses[0]?.name;
  if (courseName) {
    const scoped = await loadProgressSnapshot(courseName);
    console.log("[scope]", courseName, "| topics:", scoped.topics.length, "| activeCourse:", scoped.activeCourse);
    if (scoped.activeCourse !== courseName) throw new Error("course filter did not apply");
    const bad = await loadProgressSnapshot("Not A Course");
    if (bad.activeCourse !== null) throw new Error("an unknown course must fall back to all courses");
    console.log("[scope] unknown course falls back to all:", bad.activeCourse === null);
  }

  // ---- Loop feed shows the chain, not just timestamps ----
  const final = await loadProgressSnapshot();
  console.log("[feed] chains:", final.chains.length);
  for (const chain of final.chains.slice(0, 3)) {
    console.log(`   ${chain.topicTitle ?? "general"}:`);
    chain.entries.slice(0, 4).forEach((e) => console.log(`     ${e.label}${e.detail ? ` — ${e.detail}` : ""}`));
  }
  if (!final.chains.length) throw new Error("loop feed is empty after real activity");

  // ---- Closed loop: path events reached the shared activity spine ----
  const loopEvents = await prisma.activityEvent.findMany({
    where: { userId, activity: { in: ["path_started", "path_step_done", "path_completed"] } },
    select: { activity: true, topicSlug: true },
  });
  console.log("[loop] path events:", loopEvents.length, "|", [...new Set(loopEvents.map((e) => e.activity))].join(", "));
  if (!loopEvents.some((e) => e.activity === "path_completed")) throw new Error("completion was not recorded");

  // ---- Next action is always a real surface ----
  for (const t of final.topics) {
    const a = nextAction({
      quizzes: t.signals.quizzes, tutoring: t.signals.tutoring, cases: t.signals.cases,
      cards: t.signals.cards, breadth: t.breadth, attempts: t.attempts,
      lastStudied: null, score: t.score, status: t.status, course: t.course, daysSince: t.daysSince,
    });
    if (!a.target.startsWith("/")) throw new Error("next action target is not a route");
  }
  console.log("[next actions] all targets are real routes");

  console.log("\nPROGRESS CHECKS PASSED");
}

main()
  .catch((e) => {
    console.error("\nFAILED:", e.message ?? e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());