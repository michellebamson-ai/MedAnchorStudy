import type { ReactNode } from "react";
import Link from "next/link";
import { Brand, Nav } from "@/components/nav";

const TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  learn: "Start Learning",
  teach: "Teach Me Mode",
  cases: "Case Practice",
  flashcards: "Flashcards",
  biostats: "Biostatistics Coach",
  evidence: "Health Knowledge & Evidence",
  communicate: "Communication Practice",
  exam: "Exam Preparation",
  plan: "Study Plan",
  progress: "Progress",
  settings: "Settings",
};

/**
 * App shell. Server Component; no client JS unless a page opts in.
 * `section` is the first path segment after / (ADR-1).
 */
export function Shell({
  section,
  children,
  streak = 0,
  initial = "S",
  focus,
}: {
  section: string;
  children: ReactNode;
  streak?: number;
  initial?: string;
  focus?: string;
}) {
  return (
    <div className="app">
      <aside className="sidebar" id="sidebar" aria-label="Main navigation">
        <Brand />
        <Nav current={`/${section}`} />
        <div className="sidebar-foot">
          <div className="focus-card">
            <div className="focus-label">Today&apos;s anchor</div>
            <div className="focus-text">{focus ?? "Loading your plan…"}</div>
          </div>
          <Link className="btn btn-ghost btn-sm" href="/settings">
            Preferences
          </Link>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">{TITLES[section] ?? "MedAnchor Study"}</div>
          <div className="topbar-right">
            <div className="streak">
              <span aria-hidden="true">✦</span>
              <span>{streak}</span>
              <span>day streak</span>
            </div>
            <div className="avatar" aria-label="Student profile">
              {initial}
            </div>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
