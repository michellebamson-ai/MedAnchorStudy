"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getProvider } from "@/lib/ai/provider";
import { recordActivity } from "@/lib/mastery";
import {
  ASSIGNMENT_TYPES,
  WORK_STEPS,
  type WorkStepId,
} from "@/components/tutor/assignment-model";

export type { WorkStepId };

async function requireUserId(): Promise<string> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) throw new Error("UNAUTHENTICATED");
  return user.id;
}

/** "Write it for me" and friends get the spec's redirect, not a draft. */
function wantsFinishedWork(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /write (it|this|my|the).{0,20}(for me|essay|assignment|report)/.test(t) ||
    /(do|finish|complete) my (assignment|homework|essay)/.test(t) ||
    /just give me the (answer|essay|full)/.test(t)
  );
}

export interface CreateAssignmentInput {
  brief: string;
  kind: string;
  course: string;
  dueAt: string;
  materialIds: string[];
}

export async function createAssignment(
  input: CreateAssignmentInput
): Promise<{ ok: boolean; message: string; id?: string }> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { ok: false, message: "Sign in to start an assignment." };
  }

  const brief = input.brief.trim().slice(0, 2000);
  if (brief.length < 10) {
    return { ok: false, message: "Paste your assignment or upload a file to begin." };
  }
  if (!ASSIGNMENT_TYPES.includes(input.kind as (typeof ASSIGNMENT_TYPES)[number])) {
    return { ok: false, message: "Pick the assignment type." };
  }
  const due = new Date(input.dueAt);
  if (Number.isNaN(due.getTime())) {
    return { ok: false, message: "Pick a deadline — it goes to your Study Plan." };
  }

  const owned = input.materialIds.length
    ? await prisma.document.findMany({ where: { id: { in: input.materialIds }, userId }, select: { id: true } })
    : [];

  const assignment = await prisma.assignment.create({
    data: {
      userId,
      title: brief.split("\n")[0].slice(0, 120),
      course: input.course.trim().slice(0, 80) || null,
      kind: input.kind,
      dueAt: due,
      status: "in_progress",
      notes: brief,
      steps: { done: [] as string[] },
      materialIds: owned.map((d) => d.id),
    },
  });

  // The deadline goes to Study Plan so milestones spread before it.
  await prisma.planItem.create({
    data: {
      userId,
      title: `Assignment due: ${assignment.title.slice(0, 60)}`,
      mode: "deep",
      activity: "assignment",
      scheduledFor: new Date(due.getTime() - 2 * 86_400_000),
      dueAt: due,
      estMinutes: 120,
      priority: 1,
      origin: "assignment",
    },
  });

  await recordActivity({
    userId,
    kind: "assignment",
    activity: "assignment_start",
    detail: { assignmentId: assignment.id, kind: input.kind },
  });

  revalidatePath("/teach");
  return { ok: true, message: "Assignment started — let's work through it step by step.", id: assignment.id };
}

export async function assignmentChat(input: {
  assignmentId: string;
  step: WorkStepId;
  transcript: Array<{ role: "tutor" | "student"; text: string }>;
  answer: string;
}): Promise<{ text: string; done: boolean }> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { text: "Sign in so your work counts.", done: true };
  }

  const assignment = await prisma.assignment.findFirst({
    where: { id: input.assignmentId, userId },
    include: { user: { include: { profile: true } } },
  });
  if (!assignment) return { text: "Assignment not found.", done: true };

  if (wantsFinishedWork(input.answer)) {
    return {
      text: "I'll help you build this yourself. Let's start with your main point. What do you want to say?",
      done: false,
    };
  }

  const provider = getProvider();
  const stepLabel = WORK_STEPS.find((s) => s.id === input.step)?.label ?? input.step;
  const level = assignment.user.profile?.academicLevel === "resident" ? "advanced" : "student";

  // Examples stay about a different topic, so they can't be copied (spec).
  const turn = await provider.teach({
    topic: `${assignment.title} — ${stepLabel} step`,
    level,
    teachingStyle: "gentle",
    turn: Math.min(4, input.transcript.length),
    transcript: [
      {
        role: "student",
        text: `Assignment brief: ${(assignment.notes ?? "").slice(0, 800)}. We are on the ${stepLabel} step. Student says: ${input.answer.slice(0, 1500)}`,
      },
      ...input.transcript.slice(-6),
    ],
  });

  await recordActivity({
    userId,
    kind: "assignment",
    activity: `assignment_${input.step}`,
    detail: { assignmentId: assignment.id },
  });

  return { text: turn.question ? `${turn.text}\n\n${turn.question}` : turn.text, done: false };
}

export async function completeStep(
  assignmentId: string,
  step: WorkStepId
): Promise<{ ok: boolean; done: string[] }> {
  try {
    const userId = await requireUserId();
    const assignment = await prisma.assignment.findFirst({ where: { id: assignmentId, userId } });
    if (!assignment) return { ok: false, done: [] };
    const done = new Set(((assignment.steps as { done?: string[] } | null)?.done ?? []) as string[]);
    done.add(step);
    const list = [...done];
    await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        steps: { done: list },
        status: list.length >= WORK_STEPS.length ? "done" : "in_progress",
      },
    });
    await recordActivity({
      userId,
      kind: "assignment",
      activity: `assignment_${step}_done`,
      detail: { assignmentId },
    });
    revalidatePath("/teach");
    return { ok: true, done: list };
  } catch {
    return { ok: false, done: [] };
  }
}

export async function finishAssignment(assignmentId: string): Promise<{
  wentWell: string[];
  workOn: string[];
  nextSteps: string[];
}> {
  const userId = await requireUserId();
  const assignment = await prisma.assignment.findFirst({ where: { id: assignmentId, userId } });
  const done = (((assignment?.steps as { done?: string[] } | null)?.done ?? []) as string[]);

  await prisma.assignment.updateMany({
    where: { id: assignmentId, userId },
    data: { status: "done" },
  });
  await recordActivity({
    userId,
    kind: "assignment",
    activity: "assignment_finish",
    detail: { assignmentId, stepsDone: done.length },
  });

  const remaining = WORK_STEPS.filter((s) => !done.includes(s.id)).map((s) => s.label);
  return {
    wentWell: [`Worked through ${done.length} of ${WORK_STEPS.length} steps`, "Kept the thinking your own"],
    workOn: remaining.length ? [`Unfinished steps: ${remaining.join(", ")}`] : ["Give it one last read before submitting"],
    nextSteps: ["Practice this", "Add review to my plan"],
  };
}
