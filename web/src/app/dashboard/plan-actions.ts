"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

const HOURS = [5, 10, 15, 20];

/**
 * The study-plan card (ONBOARDING_SPEC.md): asks for the exam and weekly hours
 * only after the student has seen the app. Shows once after first dashboard
 * landing; "Not now" twice stops it by itself.
 */
export async function saveStudyPlan(input: {
  examName: string;
  examDate: string;
  hoursPerWeek: number;
}): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return { ok: false, message: "Sign in first." };

  const name = input.examName.trim().slice(0, 120);
  if (!name) return { ok: false, message: "Name your next exam." };
  const date = new Date(input.examDate);
  if (Number.isNaN(date.getTime()) || date.getTime() < Date.now() - 86_400_000) {
    return { ok: false, message: "Pick a date in the future." };
  }
  if (!HOURS.includes(input.hoursPerWeek)) {
    return { ok: false, message: "Pick your weekly study hours." };
  }

  await prisma.examGoal.create({
    data: { userId: user.id, title: name, examDate: date },
  });
  // Weekly hours become a daily goal the dashboard can count down.
  await prisma.profile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, dailyGoalMinutes: Math.round((input.hoursPerWeek * 60) / 7) },
    update: { dailyGoalMinutes: Math.round((input.hoursPerWeek * 60) / 7) },
  });

  revalidatePath("/dashboard");
  return { ok: true, message: "Plan saved — your dashboard now counts the days with you." };
}

export async function dismissStudyPlan(): Promise<{ ok: boolean }> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return { ok: false };
  await prisma.profile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, planPromptDismissals: 1 },
    update: { planPromptDismissals: { increment: 1 } },
  });
  revalidatePath("/dashboard");
  return { ok: true };
}
