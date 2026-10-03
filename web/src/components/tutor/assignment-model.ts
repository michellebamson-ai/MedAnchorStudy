/**
 * Assignment domain constants (TUTOR_SPEC.md §2). Kept in a plain module —
 * never in a "use server" file — so client components can import them.
 */

export const ASSIGNMENT_TYPES = [
  "Essay",
  "Report",
  "Research project",
  "Presentation",
  "Calculation task",
  "Case write-up",
] as const;

export const WORK_STEPS = [
  { id: "understand", label: "Understand" },
  { id: "research", label: "Research" },
  { id: "plan", label: "Plan" },
  { id: "build", label: "Build" },
  { id: "check", label: "Check" },
  { id: "improve", label: "Improve" },
] as const;

export type WorkStepId = (typeof WORK_STEPS)[number]["id"];
