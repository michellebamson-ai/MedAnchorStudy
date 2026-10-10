import Link from "next/link";
import { Shell } from "@/components/shell";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isBypassOn } from "@/lib/bypass";
import { describeProvider } from "@/lib/ai/provider";
import { SettingsClient, type SettingsProfile } from "@/components/settings/settings-client";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

/**
 * Settings (PRD §3.9.2, ADR-3). Preferences feed the personalization layer;
 * the data panel is the student's right to take or delete their own record.
 */
export default async function SettingsPage() {
  const user = await getCurrentUser().catch(() => null);
  const topics = await prisma.topic.findMany({ orderBy: { order: "asc" } });
  const searchTopics = topics.map((t) => ({ slug: t.slug, title: t.title }));

  if (!user) {
    return (
      <Shell section="settings" topics={searchTopics}>
        <div className="page-head">
          <span className="eyebrow">Your study, your call</span>
          <h1 className="display">Settings</h1>
          <p className="lede">How MedAnchor explains things, and what it keeps.</p>
        </div>
        <div className="surface" style={{ maxWidth: 560 }}>
          <h2 className="display-lg">Sign in to change your settings</h2>
          <p className="card-sub" style={{ marginTop: "var(--sp-3)" }}>
            Preferences are stored per account, so your explanation depth and study routine follow you.
          </p>
          <div style={{ marginTop: "var(--sp-5)" }}>
            <Link className="btn btn-primary" href="/login">
              Sign in
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });

  const data: SettingsProfile = {
    name: user.name ?? null,
    email: user.email,
    school: profile?.school ?? null,
    year: profile?.year ?? null,
    courses: profile?.courses ?? [],
    academicLevel: profile?.academicLevel ?? "medical_student",
    teachingStyle: profile?.teachingStyle ?? "gentle",
    explanationDepth: profile?.explanationDepth ?? 3,
    questionDifficulty: profile?.questionDifficulty ?? 3,
    studyFormat: profile?.studyFormat ?? "mixed",
    remindersOn: profile?.remindersOn ?? true,
    reminderTime: profile?.reminderTime ?? "18:00",
    dailyGoalMinutes: profile?.dailyGoalMinutes ?? 60,
    theme: profile?.theme ?? "light",
    onboarded: profile?.onboarded ?? false,
  };

  return (
    <Shell section="settings" name={data.name ?? "Student"} topics={searchTopics}>
      <div className="page-head">
        <span className="eyebrow">Your study, your call</span>
        <h1 className="display">Settings</h1>
        <p className="lede">How MedAnchor explains things, and what it keeps.</p>
      </div>
      <SettingsClient profile={data} isDemo={isBypassOn()} aiLanes={describeProvider()} />
    </Shell>
  );
}
