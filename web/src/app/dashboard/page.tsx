import Link from "next/link";
import { Shell } from "@/components/shell";
import { Bar, Empty, Ring, Stat } from "@/components/ui";
import { StudyPlanPrompt } from "@/components/study-plan-prompt";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getStudentContext } from "@/lib/personalization";
import { masteryOverview, recommendNext } from "@/lib/mastery";
import { recentActivity } from "@/lib/activity";
import { dueCards } from "@/lib/spaced-repetition";

export const metadata = { title: "Home" };

/**
 * Home dashboard (ONBOARDING_SPEC.md).
 *
 * Greeting + tutor card → Today's Study → Quick Access, with a right column
 * (progress ring + legend + focus area, continue learning) and a help banner.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();

  const topics = await prisma.topic.findMany({ orderBy: { order: "asc" } });
  const searchTopics = topics.map((t) => ({ slug: t.slug, title: t.title }));

  if (!user) {
    return (
      <Shell section="dashboard" topics={searchTopics}>
        <div className="page-head">
          <span className="eyebrow">MedAnchor Study</span>
          <h1 className="display">Your learning workspace</h1>
          <p className="lede">
            Upload a lecture, get taught, apply it in a case — and let MedAnchor decide what
            matters next.
          </p>
        </div>
        <Empty
          title="Sign in to personalise this workspace"
          action={
            <Link className="btn btn-primary" href="/login">
              Sign in
            </Link>
          }
        >
          Your content is ready: {topics.length} topics, 4 clinical and public-health cases, 14
          flashcards and 9 biostatistics modules.
        </Empty>
      </Shell>
    );
  }

  const ctx = await getStudentContext(user.id);
  const [mastery, activity, due, profile, examGoals] = await Promise.all([
    masteryOverview(user.id),
    recentActivity(user.id, 6),
    dueCards(user.id, 20),
    prisma.profile.findUnique({ where: { userId: user.id } }),
    prisma.examGoal.count({ where: { userId: user.id } }),
  ]);

  // The study-plan card shows once after first landing: only for students who
  // finished (or skipped) onboarding, have no exam yet, and haven't closed it
  // twice already.
  const showPlanPrompt =
    !!profile?.onboarded && examGoals === 0 && (profile?.planPromptDismissals ?? 0) < 2;

  const firstName = (ctx.name ?? "there").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dayEmoji = hour < 12 ? "☀" : hour < 18 ? "◐" : "☾";

  const now = new Date();
  const todaysPlan = await prisma.planItem.findMany({
    where: {
      userId: user.id,
      status: "planned",
      scheduledFor: {
        gte: new Date(now.getTime() - 86_400_000),
        lte: new Date(now.getTime() + 86_400_000),
      },
    },
    orderBy: { priority: "asc" },
    take: 6,
  });

  const totalMinutes = todaysPlan.reduce((s, p) => s + p.estMinutes, 0);
  const studied = mastery.filter((m) => m.attempts > 0).length;
  const avgScore = mastery.length
    ? Math.round((mastery.reduce((s, m) => s + m.score, 0) / mastery.length) * 100)
    : 0;

  const strong = mastery.filter((m) => m.status === "strong");
  const needsReview = mastery.filter((m) => m.status === "needs_review");
  const needsAttention = mastery.filter((m) => m.status === "needs_attention");
  const focus = needsAttention[0] ?? needsReview[0] ?? null;

  const displayName = ctx.name ?? "Student";
  const displayRole = `${(ctx.academicLevel ?? "medical_student").replace(/_/g, " ")} · ${
    ctx.courses[0] ?? "Medicine"
  }`;

  return (
    <Shell
      section="dashboard"
      name={displayName}
      role={displayRole}
      topics={searchTopics}
      searchPlaceholder="Search topics, questions, or ask MedAnchor…"
    >
      {showPlanPrompt ? (
        <div style={{ marginBottom: "var(--sp-8)" }}>
          <StudyPlanPrompt />
        </div>
      ) : null}
      <div className="dash">
        <div className="dash-main">
          {/* ---------------- Top header ---------------- */}
          <div className="dash-head">
            <div>
              <h1 className="display">
                {greeting}, {firstName} <span aria-hidden="true">{dayEmoji}</span>
              </h1>
              <p className="lede">Here’s what needs your attention today.</p>
            </div>
            <Link className="tutor-card" href="/teach">
              <span className="tutor-icon" aria-hidden="true">
                ◉
              </span>
              <span>
                <span className="tutor-title">MedAnchor Tutor</span>
                <span className="tutor-sub">Let’s make today count.</span>
              </span>
              <span className="tutor-go" aria-hidden="true">
                →
              </span>
            </Link>
          </div>

          {/* ---------------- Today's Study ---------------- */}
          <section className="dash-section" aria-labelledby="today-heading">
            <div className="dash-row-head">
              <div>
                <h2 id="today-heading" className="display-sm">
                  <span aria-hidden="true">▦</span> Today’s Study
                </h2>
                <p className="list-sub">
                  {todaysPlan.length} topics · {totalMinutes} minutes planned
                </p>
              </div>
              <Link className="btn btn-ghost btn-sm" href="/plan">
                View All →
              </Link>
            </div>

            {todaysPlan.length === 0 ? (
              <div className="surface">
                <p className="card-sub" style={{ margin: 0 }}>
                  Nothing scheduled yet. Set an exam date and the planner will build your week
                  around your weak topics.
                </p>
                <div style={{ marginTop: "var(--sp-4)" }}>
                  <Link className="btn btn-primary btn-sm" href="/plan">
                    Build my plan
                  </Link>
                </div>
              </div>
            ) : (
              <div className="study-strip">
                {todaysPlan.map((item) => (
                  <article key={item.id} className="study-card">
                    <span className="study-icon" aria-hidden="true">
                      {item.activity === "flashcard"
                        ? "▤"
                        : item.activity === "case"
                          ? "⚑"
                          : item.activity === "quiz"
                            ? "✎"
                            : "◆"}
                    </span>
                    <h3 className="study-title">{item.title}</h3>
                    <p className="list-sub">
                      {item.estMinutes} min · {item.mode.replace(/_/g, " ")}
                    </p>
                    <div className="study-foot">
                      <Link
                        className="btn btn-primary btn-sm"
                        href={
                          item.activity === "flashcard"
                            ? "/flashcards"
                            : item.activity === "case"
                              ? "/cases"
                              : item.activity === "quiz"
                                ? "/exam"
                                : item.topicSlug
                                  ? `/teach/${item.topicSlug}`
                                  : "/teach"
                        }
                      >
                        Start
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* ---------------- Quick Access ---------------- */}
          <section className="dash-section" aria-labelledby="quick-heading">
            <h2 id="quick-heading" className="display-sm" style={{ marginBottom: "var(--sp-5)" }}>
              Quick access
            </h2>
            <div className="grid grid-4">
              {[
                { href: "/flashcards", icon: "▤", title: "Flashcards", sub: "Review what is due today." },
                { href: "/exam", icon: "✎", title: "Practice Questions", sub: "Test yourself with feedback." },
                { href: "/teach", icon: "◆", title: "AI Tutor", sub: "Get taught, step by step." },
                { href: "/plan", icon: "☷", title: "Study Planner", sub: "See what is scheduled next." },
              ].map((q) => (
                <Link key={q.href + q.title} className="surface-tight quick-card" href={q.href}>
                  <span className="quick-icon" aria-hidden="true">
                    {q.icon}
                  </span>
                  <span className="list-title">{q.title}</span>
                  <span className="list-sub">{q.sub}</span>
                </Link>
              ))}
            </div>
          </section>

          {/* ---------------- Bottom banner ---------------- */}
          <section className="banner" aria-label="Need help with a concept">
            <span className="banner-icon" aria-hidden="true">
              ◉
            </span>
            <span className="banner-text">
              <span className="banner-title">Need help with a concept?</span>
              <span className="banner-sub">
                Ask MedAnchor and get a guided explanation, not just an answer.
              </span>
            </span>
            <Link className="btn btn-primary" href="/teach">
              Chat Now
            </Link>
            <span className="banner-motto" aria-hidden="true">
              Small steps. Big progress. ∿∿∿
            </span>
          </section>
        </div>

        {/* ---------------- Right column ---------------- */}
        <div className="dash-side">
          <section className="surface progress-card" aria-labelledby="progress-heading">
            <h2 id="progress-heading" className="card-title">
              Your Progress
            </h2>
            <div className="progress-ring">
              <Ring pct={avgScore} label={`${avgScore}%`} />
              <p className="list-sub">Overall Completion</p>
            </div>
            <ul className="legend">
              <li>
                <span className="dot dot-strong" aria-hidden="true" />
                Strong <b>{strong.length}</b>
              </li>
              <li>
                <span className="dot dot-review" aria-hidden="true" />
                Needs Review <b>{needsReview.length}</b>
              </li>
              <li>
                <span className="dot dot-attention" aria-hidden="true" />
                Needs Attention <b>{needsAttention.length}</b>
              </li>
            </ul>
            {focus ? (
              <div className="focus-callout">
                <span className="list-sub">Focus area</span>
                <Link className="list-title" href={`/teach/${focus.topicSlug}`}>
                  {focus.title}
                </Link>
                <Link className="btn btn-ghost btn-sm" href={`/teach/${focus.topicSlug}`}>
                  {recommendNext(focus)[0]} →
                </Link>
              </div>
            ) : (
              <p className="list-sub">
                {studied}/{mastery.length} topics with activity. Start anywhere and this fills in.
              </p>
            )}
          </section>

          <section className="surface" aria-labelledby="continue-heading">
            <div className="row-between" style={{ marginBottom: "var(--sp-4)" }}>
              <h2 id="continue-heading" className="card-title" style={{ margin: 0 }}>
                Continue Learning
              </h2>
              <Link className="btn btn-ghost btn-sm" href="/progress">
                View All →
              </Link>
            </div>
            {activity.length === 0 ? (
              <p className="card-sub" style={{ margin: 0 }}>
                Anything you start will appear here so you can pick it back up.
              </p>
            ) : (
              <div className="stack-sm">
                {activity.slice(0, 4).map((e) => (
                  <div key={e.id} className="continue-row">
                    <span className="continue-icon" aria-hidden="true">
                      {e.kind === "case" ? "⚑" : e.kind === "quiz" ? "✎" : e.kind === "flashcard" ? "▤" : "◆"}
                    </span>
                    <span>
                      <span className="list-title">
                        {e.activity.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}
                      </span>
                      <span className="list-sub" style={{ display: "block" }}>
                        {e.topicSlug ?? "general"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="surface" aria-label="Reviews due">
            <Stat label="Spaced reviews due" value={due.length} hint="scheduled automatically" />
          </section>
        </div>
      </div>
    </Shell>
  );
}
