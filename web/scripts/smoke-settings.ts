/** Settings smoke: preferences persist, export contains real rows, delete refuses a wrong email. */
import { prisma } from "../src/lib/prisma";
import { resetDemo } from "../src/lib/demo-seed";
import { savePreferences, exportMyData, dataSummary, deleteMyAccount, saveIdentity } from "../src/app/settings/actions";

async function main() {
  // smoke:plan and smoke:progress wipe and rebuild the demo account, so assert
  // against our own seed rather than whatever happened to run last.
  const seed = await prisma.user.findUnique({ where: { email: "demo@medanchor.local" } });
  if (!seed) throw new Error("demo user missing - load /settings once first");
  await resetDemo(seed.id);

  const demo = await prisma.user.findUnique({ where: { email: "demo@medanchor.local" } });
  if (!demo) throw new Error("demo user missing � load /settings once first");
  const before = await prisma.profile.findUnique({ where: { userId: demo.id } });
  console.log("[before] depth:", before?.explanationDepth, "| style:", before?.teachingStyle, "| goal:", before?.dailyGoalMinutes);

  const saved = await savePreferences({
    academicLevel: "resident", teachingStyle: "exam_pressure", explanationDepth: 5,
    questionDifficulty: 4, studyFormat: "text", remindersOn: false, reminderTime: "07:30",
    dailyGoalMinutes: 120, theme: "dark", courses: ["Medicine", "Public Health"],
  });
  console.log("[prefs]", saved.message);

  const after = await prisma.profile.findUnique({ where: { userId: demo.id } });
  console.log("[after]  depth:", after?.explanationDepth, "| style:", after?.teachingStyle, "| goal:", after?.dailyGoalMinutes, "| theme:", after?.theme);
  if (after?.explanationDepth !== 5 || after?.teachingStyle !== "exam_pressure") throw new Error("preferences did not persist");

  const id = await saveIdentity({ name: "Demo Student", school: "Test University", year: "Year 4", courses: ["Medicine"] });
  console.log("[identity]", id.message);

  // Out-of-range values must be clamped, not rejected.
  await savePreferences({
    academicLevel: "nonsense", teachingStyle: "nonsense", explanationDepth: 99,
    questionDifficulty: -5, studyFormat: "nonsense", remindersOn: true, reminderTime: "not-a-time",
    dailyGoalMinutes: 99999, theme: "neon", courses: [],
  });
  const c = await prisma.profile.findUnique({ where: { userId: demo.id } });
  console.log("[clamp] depth:", c?.explanationDepth, "| diff:", c?.questionDifficulty, "| goal:", c?.dailyGoalMinutes, "| time:", c?.reminderTime, "| theme:", c?.theme, "| level:", c?.academicLevel);
  if ((c?.explanationDepth ?? 0) > 5 || (c?.dailyGoalMinutes ?? 0) > 480) throw new Error("out-of-range values were not clamped");

  const summary = await dataSummary();
  console.log("[summary]", JSON.stringify(summary.counts));

  const exported = await exportMyData();
  if (!exported.ok || !exported.json) throw new Error("export failed");
  const parsed = JSON.parse(exported.json) as { format: string; counts: Record<string, number> };
  console.log("[export] file:", exported.filename, "| format:", parsed.format);
  console.log("[export] counts:", JSON.stringify(parsed.counts));
  if (parsed.counts.activityEvents < 1) throw new Error("export contained no activity");
  if (exported.json.includes("data/uploads")) throw new Error("export leaked a server file path");

  const wrong = await deleteMyAccount("not-my-email@example.com");
  console.log("[delete guard]", wrong.ok ? "SECURITY BUG" : "refused:", wrong.message);
  if (wrong.ok) throw new Error("delete accepted a wrong confirmation email");

  const stillThere = await prisma.user.count({ where: { email: "demo@medanchor.local" } });
  console.log("[delete guard] account still present:", stillThere === 1);
  if (stillThere !== 1) throw new Error("account was deleted by the guard test");

  // Restore sensible defaults for the demo.
  await savePreferences({
    academicLevel: "medical_student", teachingStyle: "gentle", explanationDepth: 3,
    questionDifficulty: 3, studyFormat: "mixed", remindersOn: true, reminderTime: "18:00",
    dailyGoalMinutes: 84, theme: "light", courses: ["Medicine"],
  });

  console.log("\nSETTINGS CHECKS PASSED");
}
main().catch((e) => { console.error("FAILED:", e.message ?? e); process.exit(1); }).finally(async () => prisma.$disconnect());
