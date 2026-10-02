"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

const COURSES = ["Medicine", "Nursing", "Public Health", "Pharmacy", "Dentistry", "Biomedical Science", "Other"];
const YEARS = ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5 or higher", "Postgraduate"];

/**
 * Page 3: save course/year/school (ONBOARDING_SPEC.md). Marks onboarding done
 * so the study-plan prompt — not this screen — appears next.
 */
export async function saveProfile(input: {
  course: string;
  customCourse?: string;
  year: string;
  school?: string;
}): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return { ok: false, message: "Sign in first." };

  const course = COURSES.includes(input.course) ? input.course : null;
  if (!course) return { ok: false, message: "Pick your course or program." };
  const finalCourse = course === "Other" ? input.customCourse?.trim().slice(0, 80) || "Other" : course;
  if (!YEARS.includes(input.year)) return { ok: false, message: "Pick your year or level." };

  // Academic level follows the year: early years are foundations, later years
  // and postgraduates get the full clinical register.
  const academicLevel =
    input.year === "Postgraduate" ? "resident" : input.year === "Year 1" || input.year === "Year 2" ? "foundation" : "medical_student";

  await prisma.profile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      academicLevel,
      courses: [finalCourse],
      year: input.year,
      school: input.school?.trim().slice(0, 120) || null,
      onboarded: true,
    },
    update: {
      academicLevel,
      courses: [finalCourse],
      year: input.year,
      school: input.school?.trim().slice(0, 120) || null,
      onboarded: true,
    },
  });

  revalidatePath("/dashboard");
  return { ok: true, message: "Profile saved." };
}

/** "Skip for now" still counts as leaving the flow — never trap the student. */
export async function skipProfile(): Promise<{ ok: boolean }> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return { ok: false };
  await prisma.profile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, onboarded: true },
    update: { onboarded: true },
  });
  revalidatePath("/dashboard");
  return { ok: true };
}
