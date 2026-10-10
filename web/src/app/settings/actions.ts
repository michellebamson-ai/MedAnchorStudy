"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { describeProvider } from "@/lib/ai/provider";

const LEVELS = ["foundation", "medical_student", "resident", "allied"] as const;
const STYLES = ["gentle", "rapid_fire", "exam_pressure", "step_by_step"] as const;
const FORMATS = ["mixed", "text", "visual"] as const;

function refreshAll(): void {
  for (const p of ["/settings", "/dashboard", "/teach", "/practice", "/plan", "/progress"]) {
    try {
      revalidatePath(p);
    } catch {
      /* not in a request context */
    }
  }
}

/**
 * Settings (PRD §3.9.2). Every field here feeds `lib/personalization.ts`, which
 * is what adapts explanation depth, teaching style and difficulty across every
 * feature — so these are not cosmetic preferences.
 */
export async function savePreferences(input: {
  academicLevel: string;
  teachingStyle: string;
  explanationDepth: number;
  questionDifficulty: number;
  studyFormat: string;
  remindersOn: boolean;
  reminderTime: string;
  dailyGoalMinutes: number;
  theme: string;
  courses: string[];
}): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return { ok: false, message: "Sign in to change settings." };

  const level = LEVELS.includes(input.academicLevel as never) ? input.academicLevel : "medical_student";
  const style = STYLES.includes(input.teachingStyle as never) ? input.teachingStyle : "gentle";
  const format = FORMATS.includes(input.studyFormat as never) ? input.studyFormat : "mixed";
  const depth = Math.max(1, Math.min(5, Math.round(input.explanationDepth) || 3));
  const diff = Math.max(1, Math.min(5, Math.round(input.questionDifficulty) || 3));
  const goal = Math.max(15, Math.min(480, Math.round(input.dailyGoalMinutes) || 60));
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(input.reminderTime) ? input.reminderTime : "18:00";
  const theme = ["light", "dark"].includes(input.theme) ? input.theme : "light";
  const courses = (input.courses ?? []).map((c) => c.trim().slice(0, 80)).filter(Boolean).slice(0, 8);

  await prisma.profile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      academicLevel: level,
      teachingStyle: style,
      studyFormat: format,
      explanationDepth: depth,
      questionDifficulty: diff,
      remindersOn: input.remindersOn,
      reminderTime: time,
      dailyGoalMinutes: goal,
      theme,
      courses,
      onboarded: true,
    },
    update: {
      academicLevel: level,
      teachingStyle: style,
      studyFormat: format,
      explanationDepth: depth,
      questionDifficulty: diff,
      remindersOn: input.remindersOn,
      reminderTime: time,
      dailyGoalMinutes: goal,
      theme,
      courses,
    },
  });

  refreshAll();
  return { ok: true, message: "Saved. Every feature adapts to these from now on." };
}

/** Identity fields, editable after onboarding. */
export async function saveIdentity(input: {
  name: string;
  school: string;
  year: string;
  courses: string[];
}): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return { ok: false, message: "Sign in first." };

  const name = input.name.trim().slice(0, 80);
  const year = input.year.trim().slice(0, 40);
  const courses = (input.courses ?? []).map((c) => c.trim().slice(0, 80)).filter(Boolean).slice(0, 8);

  await prisma.user.update({ where: { id: user.id }, data: { name: name || null } });
  await prisma.profile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, school: input.school.trim().slice(0, 120) || null, year: year || null, courses, onboarded: true },
    update: {
      school: input.school.trim().slice(0, 120) || null,
      year: year || null,
      courses,
    },
  });

  refreshAll();
  return { ok: true, message: "Profile updated." };
}

/**
 * Data rights (ADR-3, committed "from day one"). Returns every row the
 * student owns. Documents are referenced by metadata and their file path, but
 * the file bytes are not embedded — the download is a portable record, not an
 * archive of their uploads.
 */
export async function exportMyData(): Promise<{
  ok: boolean;
  message: string;
  filename?: string;
  json?: string;
}> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return { ok: false, message: "Sign in to export your data." };

  const id = user.id;
  const [
    profile, documents, docConcepts, artifacts, sources, citations,
    goals, assignments, planItems, paths, cardStates,
    attempts, caseAttempts, commAttempts, mastery, events,
  ] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: id } }),
    prisma.document.findMany({ where: { userId: id } }),
    prisma.docConcept.findMany({ where: { document: { userId: id } } }),
    prisma.artifact.findMany({ where: { userId: id } }),
    prisma.source.findMany({ where: { userId: id } }),
    prisma.citation.findMany({ where: { source: { userId: id } } }),
    prisma.examGoal.findMany({ where: { userId: id } }),
    prisma.assignment.findMany({ where: { userId: id } }),
    prisma.planItem.findMany({ where: { userId: id } }),
    prisma.learningPath.findMany({ where: { userId: id } }),
    prisma.cardReviewState.findMany({ where: { userId: id } }),
    prisma.quizAttempt.findMany({ where: { userId: id } }),
    prisma.caseAttempt.findMany({ where: { userId: id } }),
    prisma.commAttempt.findMany({ where: { userId: id } }),
    prisma.topicMastery.findMany({ where: { userId: id } }),
    prisma.activityEvent.findMany({ where: { userId: id } }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    format: "medanchor-study-export/1",
    note: "Your learning record. Uploaded file bytes are not included; documents are listed by metadata.",
    account: { id, email: user.email, name: user.name, createdAt: null },
    counts: {
      documents: documents.length, artifacts: artifacts.length, sources: sources.length,
      examsAndDeadlines: goals.length, assignments: assignments.length, planItems: planItems.length,
      learningPaths: paths.length, cardReviews: cardStates.length, quizAttempts: attempts.length,
      caseAttempts: caseAttempts.length, rolePlayAttempts: commAttempts.length,
      masteryRecords: mastery.length, activityEvents: events.length,
    },
    profile,
    documents: documents.map((d) => ({ ...d, storedPath: "[file on server]" })),
    documentConcepts: docConcepts,
    artifacts,
    sources,
    citations,
    examsAndDeadlines: goals,
    assignments,
    planItems,
    learningPaths: paths,
    cardReviewStates: cardStates,
    quizAttempts: attempts,
    caseAttempts,
    rolePlayAttempts: commAttempts,
    mastery,
    activityEvents: events,
  };

  const json = JSON.stringify(payload, null, 2);
  const stamp = new Date().toISOString().slice(0, 10);
  return {
    ok: true,
    message: `Exported ${events.length} activity events and ${documents.length} documents.`,
    filename: `medanchor-data-${stamp}.json`,
    json,
  };
}

/** Small counts for the "your data" panel, so the size of a delete is visible. */
export async function dataSummary(): Promise<{ ok: boolean; message: string; counts?: Record<string, number> }> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return { ok: false, message: "Sign in first." };
  const id = user.id;
  const [documents, planItems, events, mastery, attempts] = await Promise.all([
    prisma.document.count({ where: { userId: id } }),
    prisma.planItem.count({ where: { userId: id } }),
    prisma.activityEvent.count({ where: { userId: id } }),
    prisma.topicMastery.count({ where: { userId: id } }),
    prisma.quizAttempt.count({ where: { userId: id } }),
  ]);
  return { ok: true, message: "", counts: { documents, planItems, events, mastery, attempts } };
}

/**
 * Irreversible. Requires the student to type their email, because a
 * one-tap delete that also removes every upload is the kind of thing that
 * should be impossible to do by accident.
 */
export async function deleteMyAccount(confirmEmail: string): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return { ok: false, message: "Sign in first." };
  if (confirmEmail.trim().toLowerCase() !== (user.email ?? "").toLowerCase()) {
    return { ok: false, message: "That does not match your email address." };
  }

  const { removeDocumentFile } = await import("@/lib/documents");
  const docs = await prisma.document.findMany({ where: { userId: user.id }, select: { storedPath: true } });
  for (const d of docs) {
    // Best effort: a missing file must not strand the account in a half-deleted state.
    await removeDocumentFile(d.storedPath).catch(() => undefined);
  }

  // Ordered child-first; every other table cascades from User.
  await prisma.planItem.deleteMany({ where: { userId: user.id } });
  await prisma.learningPath.deleteMany({ where: { userId: user.id } });
  await prisma.activityEvent.deleteMany({ where: { userId: user.id } });
  await prisma.topicMastery.deleteMany({ where: { userId: user.id } });
  await prisma.cardReviewState.deleteMany({ where: { userId: user.id } });
  await prisma.quizAttempt.deleteMany({ where: { userId: user.id } });
  await prisma.caseAttempt.deleteMany({ where: { userId: user.id } });
  await prisma.commAttempt.deleteMany({ where: { userId: user.id } });
  await prisma.artifact.deleteMany({ where: { userId: user.id } });
  await prisma.source.deleteMany({ where: { userId: user.id } });
  await prisma.assignment.deleteMany({ where: { userId: user.id } });
  await prisma.examGoal.deleteMany({ where: { userId: user.id } });
  await prisma.docConcept.deleteMany({ where: { document: { userId: user.id } } });
  await prisma.document.deleteMany({ where: { userId: user.id } });
  await prisma.profile.deleteMany({ where: { userId: user.id } });
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await prisma.account.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });

  return { ok: true, message: "Your account and everything in it has been deleted." };
}

/** What the app is currently using, so the student is never misled about AI. */
export async function aiStatus(): Promise<{ lanes: string[]; bypass: boolean }> {
  return { lanes: describeProvider(), bypass: !!process.env.BYPASS_AUTH };
}
