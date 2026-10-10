"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  dataSummary,
  deleteMyAccount,
  exportMyData,
  saveIdentity,
  savePreferences,
} from "@/app/settings/actions";

export interface SettingsProfile {
  name: string | null;
  email: string;
  school: string | null;
  year: string | null;
  courses: string[];
  academicLevel: string;
  teachingStyle: string;
  explanationDepth: number;
  questionDifficulty: number;
  studyFormat: string;
  remindersOn: boolean;
  reminderTime: string;
  dailyGoalMinutes: number;
  theme: string;
  onboarded: boolean;
}

const LEVEL_LABEL: Record<string, string> = {
  foundation: "Foundation (Years 1–2)",
  medical_student: "Medical student",
  resident: "Resident / postgraduate",
  allied: "Allied health",
};

const STYLE_HELP: Record<string, string> = {
  gentle: "Patient and encouraging, one idea at a time",
  rapid_fire: "Quick focused questions that keep moving",
  exam_pressure: "Exam-condition questioning that expects precision",
  step_by_step: "Explicitly sequenced, never skipping a step",
};

const DEPTH_HELP: Record<number, string> = {
  1: "Very brief — key point only",
  2: "Brief",
  3: "Balanced",
  4: "Detailed",
  5: "Exhaustive — exam-level completeness",
};

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Settings (PRD §3.9.2). Everything on this screen feeds the personalization
 * layer, so the copy says what each control actually changes rather than
 * presenting them as cosmetic toggles.
 */
export function SettingsClient({
  profile,
  isDemo,
  aiLanes,
}: {
  profile: SettingsProfile;
  isDemo: boolean;
  aiLanes: string[];
}) {
  const router = useRouter();
  const [identity, setIdentity] = useState({
    name: profile.name ?? "",
    school: profile.school ?? "",
    year: profile.year ?? "",
    courses: profile.courses.join(", "),
  });
  const [prefs, setPrefs] = useState({
    academicLevel: profile.academicLevel,
    teachingStyle: profile.teachingStyle,
    explanationDepth: profile.explanationDepth,
    questionDifficulty: profile.questionDifficulty,
    studyFormat: profile.studyFormat,
    remindersOn: profile.remindersOn,
    reminderTime: profile.reminderTime,
    dailyGoalMinutes: profile.dailyGoalMinutes,
    theme: profile.theme,
  });
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"ok" | "warn" | "danger">("ok");
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState("");
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  function notify(m: string, t: "ok" | "warn" | "danger" = "ok") {
    setMessage(m);
    setTone(t);
  }

  function saveIdent() {
    start(async () => {
      const res = await saveIdentity({
        ...identity,
        courses: identity.courses.split(",").map((c) => c.trim()).filter(Boolean),
      });
      notify(res.message, res.ok ? "ok" : "danger");
      if (res.ok) router.refresh();
    });
  }

  function savePrefs() {
    start(async () => {
      const res = await savePreferences({ ...prefs, courses: identity.courses.split(",").map((c) => c.trim()).filter(Boolean) });
      notify(res.message, res.ok ? "ok" : "danger");
      if (res.ok) router.refresh();
    });
  }

  function doExport() {
    start(async () => {
      const res = await exportMyData();
      if (!res.ok || !res.json || !res.filename) {
        notify(res.message, "danger");
        return;
      }
      download(res.filename, res.json);
      notify(res.message);
    });
  }

  function loadCounts() {
    start(async () => {
      const res = await dataSummary();
      if (res.counts) setCounts(res.counts);
      else notify(res.message, "danger");
    });
  }

  function doDelete() {
    start(async () => {
      const res = await deleteMyAccount(confirm);
      notify(res.message, res.ok ? "warn" : "danger");
      if (res.ok) {
        setConfirm("");
        // The session is gone; there is nothing left to show.
        router.push("/welcome");
      }
    });
  }

  const readiness = aiLanes.join(" + ");

  return (
    <div className="stack-lg settings-page">
      {message ? (
        <div className={`alert alert-${tone === "ok" ? "ok" : tone === "warn" ? "warn" : "danger"}`} role="status">
          {message}
        </div>
      ) : null}

      {isDemo ? (
        <div className="alert alert-warn">
          You are signed in as the shared demo student. Changes here affect the demo account, not a
          real one.
        </div>
      ) : null}

      {/* ---------------- Profile ---------------- */}
      <section className="surface settings-section" aria-labelledby="s-profile">
        <h2 id="s-profile" className="display-sm settings-h">
          Your profile
        </h2>
        <p className="section-note">Used to pitch explanations at the right level.</p>

        <div className="settings-fields">
          <div className="field">
            <label className="label" htmlFor="st-name">Name</label>
            <input id="st-name" className="input" value={identity.name} onChange={(e) => setIdentity({ ...identity, name: e.target.value })} />
          </div>
          <div className="field">
            <label className="label" htmlFor="st-email">Email</label>
            <input id="st-email" className="input" value={profile.email} disabled />
            <span className="hint">Contact support to change this.</span>
          </div>
          <div className="field">
            <label className="label" htmlFor="st-school">School or institution</label>
            <input id="st-school" className="input" value={identity.school} onChange={(e) => setIdentity({ ...identity, school: e.target.value })} placeholder="Optional" />
          </div>
          <div className="field">
            <label className="label" htmlFor="st-year">Year or level</label>
            <input id="st-year" className="input" value={identity.year} onChange={(e) => setIdentity({ ...identity, year: e.target.value })} placeholder="e.g. Year 3" />
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label className="label" htmlFor="st-courses">Courses</label>
            <input id="st-courses" className="input" value={identity.courses} onChange={(e) => setIdentity({ ...identity, courses: e.target.value })} placeholder="Comma separated, e.g. Medicine, Public Health" />
          </div>
        </div>
        <div className="row" style={{ marginTop: "var(--sp-4)" }}>
          <button className="btn btn-primary" disabled={pending} onClick={saveIdent} type="button">
            {pending ? "Saving…" : "Save profile"}
          </button>
        </div>
      </section>

      {/* ---------------- How things are explained ---------------- */}
      <section className="surface settings-section" aria-labelledby="s-learn">
        <h2 id="s-learn" className="display-sm settings-h">
          How things are explained
        </h2>
        <p className="section-note">These shape every tutor turn, question and summary in the app.</p>

        <div className="field" style={{ marginTop: "var(--sp-4)" }}>
          <span className="label">Academic level</span>
          <div className="chips" role="group" aria-label="Academic level">
            {Object.entries(LEVEL_LABEL).map(([v, label]) => (
              <button key={v} className="chip" aria-pressed={prefs.academicLevel === v} onClick={() => setPrefs({ ...prefs, academicLevel: v })} type="button">
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="field" style={{ marginTop: "var(--sp-5)" }}>
          <label className="label" htmlFor="st-style">Tutor teaching style</label>
          <div className="chips" role="group" aria-label="Teaching style">
            {(Object.keys(STYLE_HELP) as string[]).map((v) => (
              <button key={v} className="chip" aria-pressed={prefs.teachingStyle === v} title={STYLE_HELP[v]} onClick={() => setPrefs({ ...prefs, teachingStyle: v })} type="button">
                {v.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          <span className="hint" style={{ marginTop: "var(--sp-2)", display: "block" }}>
            {STYLE_HELP[prefs.teachingStyle]}
          </span>
        </div>

        <div className="field" style={{ marginTop: "var(--sp-5)" }}>
          <label className="label" htmlFor="st-depth">
            Explanation depth — {prefs.explanationDepth} of 5
          </label>
          <input id="st-depth" type="range" min={1} max={5} step={1} value={prefs.explanationDepth} onChange={(e) => setPrefs({ ...prefs, explanationDepth: Number(e.target.value) })} className="settings-range" />
          <span className="hint">{DEPTH_HELP[prefs.explanationDepth]}</span>
        </div>

        <div className="field" style={{ marginTop: "var(--sp-5)" }}>
          <label className="label" htmlFor="st-diff">
            Question pressure — {prefs.questionDifficulty} of 5
          </label>
          <input id="st-diff" type="range" min={1} max={5} step={1} value={prefs.questionDifficulty} onChange={(e) => setPrefs({ ...prefs, questionDifficulty: Number(e.target.value) })} className="settings-range" />
          <span className="hint">Higher means closer to real exam conditions.</span>
        </div>

        <div className="field" style={{ marginTop: "var(--sp-5)" }}>
          <span className="label">Preferred format</span>
          <div className="chips" role="group" aria-label="Study format">
            {["mixed", "text", "visual"].map((v) => (
              <button key={v} className="chip" aria-pressed={prefs.studyFormat === v} onClick={() => setPrefs({ ...prefs, studyFormat: v })} type="button">
                {v}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Study routine ---------------- */}
      <section className="surface settings-section" aria-labelledby="s-routine">
        <h2 id="s-routine" className="display-sm settings-h">
          Study routine
        </h2>
        <p className="section-note">Feeds the daily goal and the reminders the planner assumes.</p>

        <div className="settings-fields">
          <div className="field">
            <label className="label" htmlFor="st-goal">Daily goal (minutes)</label>
            <input id="st-goal" className="input" type="number" min={15} max={480} step={15} value={prefs.dailyGoalMinutes} onChange={(e) => setPrefs({ ...prefs, dailyGoalMinutes: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label className="label" htmlFor="st-time">Reminder time</label>
            <input id="st-time" className="input" type="time" value={prefs.reminderTime} disabled={!prefs.remindersOn} onChange={(e) => setPrefs({ ...prefs, reminderTime: e.target.value })} />
          </div>
        </div>

        <label className="settings-toggle" style={{ marginTop: "var(--sp-4)" }}>
          <input type="checkbox" checked={prefs.remindersOn} onChange={(e) => setPrefs({ ...prefs, remindersOn: e.target.checked })} />
          <span>Send me a daily reminder</span>
        </label>
        <p className="hint">
          Reminders are stored now. Push delivery needs a mobile app, so today this records your
          preference and the time — nothing will pop up on this device.
        </p>

        <div className="field" style={{ marginTop: "var(--sp-5)" }}>
          <span className="label">Appearance</span>
          <div className="chips" role="group" aria-label="Theme">
            {["light", "dark"].map((v) => (
              <button key={v} className="chip" aria-pressed={prefs.theme === v} onClick={() => setPrefs({ ...prefs, theme: v })} type="button">
                {v}
              </button>
            ))}
          </div>
          <span className="hint" style={{ marginTop: "var(--sp-2)", display: "block" }}>
            Takes effect across the whole app after saving. The ☾ / ☀ button in the top bar always
            works immediately.
          </span>
        </div>

        <div className="row" style={{ marginTop: "var(--sp-5)" }}>
          <button className="btn btn-primary" disabled={pending} onClick={savePrefs} type="button">
            {pending ? "Saving…" : "Save preferences"}
          </button>
        </div>
      </section>

      {/* ---------------- AI ---------------- */}
      <section className="surface settings-section" aria-labelledby="s-ai">
        <h2 id="s-ai" className="display-sm settings-h">
          What is generating your content
        </h2>
        <p className="section-note">
          Tutor conversations run on <b>{aiLanes[0] ?? "an offline engine"}</b>
          {aiLanes.length > 1 ? `; study materials and grading run on ${aiLanes[1]}.` : "."}{" "}
          If a provider is unavailable, the app quietly falls back to a deterministic engine, and
          generated summaries say which one wrote them.
        </p>
        <p className="hint">
          Never upload real patient records. This app is for study material and is not HIPAA-covered.
        </p>
      </section>

      {/* ---------------- Your data ---------------- */}
      <section className="surface settings-section" aria-labelledby="s-data">
        <h2 id="s-data" className="display-sm settings-h">
          Your data
        </h2>
        <p className="section-note">
          Everything below is yours. Download it, or delete the account and all of it.
        </p>

        <div className="row" style={{ marginTop: "var(--sp-4)" }}>
          <button className="btn" disabled={pending} onClick={doExport} type="button">
            {pending ? "Preparing…" : "Download my data"}
          </button>
          <button className="btn btn-ghost btn-sm" disabled={pending} onClick={loadCounts} type="button">
            What would be deleted?
          </button>
        </div>

        {counts ? (
          <div className="settings-counts">
            {(
              [
                ["Documents", counts.documents],
                ["Plan items", counts.planItems],
                ["Activity events", counts.events],
                ["Mastery records", counts.mastery],
                ["Question attempts", counts.attempts],
              ] as Array<[string, number]>
            ).map(([label, n]) => (
              <div key={label} className="surface-tight">
                <span className="list-sub">{label}</span>
                <span className="list-title">{n}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="settings-danger">
          <h3 className="card-title">Delete my account</h3>
          <p className="card-sub" style={{ marginTop: 0 }}>
            Removes your profile, uploads, study plans, progress and history permanently. This cannot
            be undone, and there is no backup — download your data first if you want a copy.
          </p>
          <div className="field">
            <label className="label" htmlFor="st-confirm">Type your email to confirm</label>
            <input id="st-confirm" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={profile.email} autoComplete="off" />
          </div>
          <button className="btn btn-danger" style={{ marginTop: "var(--sp-3)" }} disabled={pending || confirm.trim().toLowerCase() !== profile.email.toLowerCase()} onClick={doDelete} type="button">
            {pending ? "Deleting…" : "Delete my account permanently"}
          </button>
        </div>
      </section>

      <p className="hint">
        Content currently served by: <b>{readiness}</b>
      </p>
    </div>
  );
}
