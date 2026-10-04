/** Study Plan smoke test: setup -> generate -> complete -> miss -> catch-up -> availability -> deadlines. */
import { prisma } from "../src/lib/prisma";
import {
  loadPlanSnapshot,
  completeSetup,
  addDeadline,
  updateDeadline,
  completeDeadline,
  deleteDeadline,
  saveAvailability,
  addManualItem,
  setItemStatus,
  setMode,
  deleteItem,
  regeneratePlan,
} from "../src/app/plan/actions";

const day = 86_400_000;

function inDays(n: number): string {
  return new Date(Date.now() + n * day).toISOString().slice(0, 10);
}

async function main() {
  const demo = await prisma.user.findUnique({ where: { email: "demo@medanchor.local" } });
  if (!demo) throw new Error("demo user missing — load /plan once first");

  // Start clean so the run is repeatable.
  await prisma.planItem.deleteMany({ where: { userId: demo.id } });
  await prisma.examGoal.deleteMany({ where: { userId: demo.id } });
  await prisma.profile.update({
    where: { userId: demo.id },
    data: { planSetupDone: false, planMode: "deep", weeklyHours: 10 },
  });

  // ---- First-run setup ----
  const setup = await completeSetup({
    examName: "Cardiology midterm",
    examDate: inDays(12),
    weeklyHours: 12,
    mode: "deep",
  });
  console.log("[setup]", setup.message, "| notes:", setup.notes.length);

  // ---- Snapshot: planner filled itself in ----
  const snap = await loadPlanSnapshot();
  if (!snap) throw new Error("no snapshot");
  console.log(
    "[snapshot] setupDone:", snap.setupDone,
    "| next exam:", snap.nextExam?.title, snap.nextExam?.daysLeft + "d",
    "| days:", snap.days.length,
    "| today items:", snap.days[0].items.length,
    "| today minutes:", snap.todayMinutes,
    "| week:", snap.week.plannedMinutes, "planned /", snap.week.doneMinutes, "done",
  );
  if (!snap.setupDone) throw new Error("setup did not complete");
  if (!snap.days[0].items.length) throw new Error("today is empty after setup");
  if (!snap.days[0].items[0].reason) throw new Error("items must explain themselves");

  const reasons = snap.days.flatMap((d) => d.items.map((i) => `${d.label}: ${i.title} — ${i.reason}`));
  reasons.slice(0, 4).forEach((r) => console.log("   ·", r));

  // ---- Complete one task ----
  const first = snap.days[0].items[0];
  const done = await setItemStatus(first.id, "done");
  console.log("[complete]", done.message);
  const afterDone = await loadPlanSnapshot();
  console.log("[week] done minutes now:", afterDone?.week.doneMinutes, "| pct:", afterDone?.week.pct + "%");

  // ---- Skip one, then miss one by ageing it ----
  const second = afterDone?.days[0].items.find((i) => i.status !== "done");
  if (second) {
    const skipped = await setItemStatus(second.id, "missed");
    console.log("[miss]", skipped.message);
  }
  await prisma.planItem.updateMany({
    where: { userId: demo.id, status: "planned" },
    data: { scheduledFor: new Date(Date.now() - 2 * day) },
  });

  // Loading detects overdue work as missed, then redistributes it forward and
  // says so — recovery must be visible, not silent (§8.2).
  const afterMiss = await loadPlanSnapshot();
  console.log("[detect] missed count:", afterMiss?.missedCount);
  const recoveryNote = afterMiss?.notes.find((n) => n.includes("missed task"));
  console.log("[recovery]", recoveryNote ?? "NO RECOVERY NOTE");
  if (!recoveryNote) throw new Error("missed work was recovered silently, or not recovered at all");
  if (!/moved forward/.test(recoveryNote)) throw new Error(`recovery did not redistribute: ${recoveryNote}`);
  if ((afterMiss?.missedCount ?? 0) !== 0) {
    throw new Error("missed work was not moved out of the missed state");
  }

  // ---- Catch-Up redistributes on demand too ----
  const caught = await setMode("catch_up");
  console.log("[catch-up]", caught.message);
  caught.notes.forEach((n) => console.log("   ·", n));
  const afterCatch = await loadPlanSnapshot();
  console.log("[catch-up] missed now:", afterCatch?.missedCount, "| tasks ahead:", afterCatch?.days[0].items.length);
  if (afterCatch?.days[0].items.length === 0) throw new Error("catch-up left today empty");

  // ---- Other modes ----
  for (const mode of ["quick", "cram", "revision", "deep"] as const) {
    const res = await regeneratePlan(mode, "today");
    console.log(`[mode:${mode}]`, res.message);
  }

  // ---- Availability drives the week ----
  const avail = await saveAvailability({
    dayMinutes: [0, 30, 30, 30, 30, 60, 90],
    weeklyHours: 5,
    dailyGoalMinutes: 45,
  });
  console.log("[availability]", avail.message);
  const afterAvail = await loadPlanSnapshot();
  console.log(
    "[availability] week capacity:", afterAvail?.weekCapacityMinutes,
    "min | planned:", afterAvail?.week.plannedMinutes
  );
  // Sunday was set to 0 minutes: that must be respected as a rest day.
  // Completed work stays where it was done, so only live work is capped.
  const live = (items: { status: string; estMinutes: number }[]) =>
    items.filter((i) => i.status === "planned" || i.status === "in_progress");
  const sunday = afterAvail?.days.find((d) => new Date(d.date).getDay() === 0);
  const sundayLive = live(sunday?.items ?? []);
  console.log(
    "[rest day] capacity:", sunday?.capacityMinutes,
    "min | live items:", sundayLive.length,
    "| done earlier:", (sunday?.items.length ?? 0) - sundayLive.length
  );
  if (sunday && sunday.capacityMinutes === 0 && sundayLive.length > 0) {
    throw new Error("planner scheduled new work on a declared rest day");
  }

  // ---- Workload balancing: never exceed the hours the student declared ----
  for (const day of afterAvail?.days ?? []) {
    const used = live(day.items).reduce((s, i) => s + i.estMinutes, 0);
    console.log(`   ${day.label}: ${used} min live / ${day.capacityMinutes} min available`);
    if (used > day.capacityMinutes) {
      throw new Error(`${day.label} is overloaded: ${used} min planned, ${day.capacityMinutes} available`);
    }
  }
  if ((afterAvail?.week.plannedMinutes ?? 0) > (afterAvail?.weekCapacityMinutes ?? 0)) {
    throw new Error("week exceeds the hours the student declared available");
  }

  // ---- Manual task ----
  const manual = await addManualItem({
    title: "Re-read the sepsis notes",
    date: new Date().toISOString(),
    estMinutes: 25,
    activity: "review",
    topicSlug: null,
  });
  console.log("[manual]", manual.message);
  const afterManual = await loadPlanSnapshot();
  const manualItem = afterManual?.days[0].items.find((i) => i.title.startsWith("Re-read"));
  if (!manualItem) throw new Error("manual task not on the plan");
  console.log("[manual] on plan:", manualItem.title, "|", manualItem.estMinutes, "min |", manualItem.reason);
  const del = await deleteItem(manualItem.id);
  console.log("[manual delete]", del.message);

  // ---- Deadline lifecycle ----
  const added = await addDeadline({
    title: "Evidence summary write-up",
    kind: "assignment",
    course: "Public Health",
    date: inDays(5),
    notes: "Use the WHO hand hygiene source",
  });
  console.log("[deadline add]", added.message);
  const withDeadline = await loadPlanSnapshot();
  const newDeadline = withDeadline?.deadlines.find((d) => d.title.startsWith("Evidence summary"));
  console.log("[deadline] in list:", newDeadline?.title, "|", newDeadline?.kind, "|", newDeadline?.daysLeft + "d", "| editable:", newDeadline?.editable);
  if (!newDeadline) throw new Error("deadline not listed");

  const updated = await updateDeadline(newDeadline.id, {
    title: "Evidence summary write-up",
    kind: "project",
    course: "Public Health",
    date: inDays(9),
    notes: "Use the WHO hand hygiene source",
  });
  console.log("[deadline update]", updated.message);
  const afterUpdate = await loadPlanSnapshot();
  const moved9 = afterUpdate?.deadlines.find((d) => d.id === newDeadline.id);
  console.log("[deadline] now:", moved9?.daysLeft + "d", "| kind:", moved9?.kind);

  const completed = await completeDeadline(newDeadline.id, true);
  console.log("[deadline done]", completed.message);
  const removed = await deleteDeadline(newDeadline.id);
  console.log("[deadline delete]", removed.message);

  // ---- Forecast is cautious, not a promise ----
  console.log("[forecast]", afterAvail?.forecast?.note);

  // ---- Closed loop: the planner shows up in the activity log ----
  const events = await prisma.activityEvent.findMany({
    where: { userId: demo.id, kind: "plan" },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { activity: true },
  });
  console.log("[loop] plan events:", events.length, "|", [...new Set(events.map((e) => e.activity))].join(", "));
  if (!events.length) throw new Error("planner did not record activity");

  console.log("\nPLAN CHECKS PASSED");
}

main()
  .catch((e) => {
    console.error("\nFAILED:", e.message ?? e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());