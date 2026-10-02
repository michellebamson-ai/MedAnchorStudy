"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { saveProfile, skipProfile } from "@/app/profile-setup/actions";

const COURSES = ["Medicine", "Nursing", "Public Health", "Pharmacy", "Dentistry", "Biomedical Science", "Other"];
const YEARS = ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5 or higher", "Postgraduate"];

/**
 * Page 3: Your Profile (ONBOARDING_SPEC.md). Course and year are required and
 * drive the Finish button; school is optional; Skip never traps the student.
 */
export function ProfileForm() {
  const router = useRouter();
  const [course, setCourse] = useState("");
  const [customCourse, setCustomCourse] = useState("");
  const [year, setYear] = useState("");
  const [school, setSchool] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const ready = !!course && !!year && (course !== "Other" || !!customCourse.trim());

  function finish() {
    if (!ready || pending) return;
    setError("");
    start(async () => {
      const res = await saveProfile({ course, customCourse, year, school });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  function skip() {
    start(async () => {
      await skipProfile();
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="onboard-inner">
      <Link className="onboard-back" href="/login" aria-label="Back to login">
        ←
      </Link>
      <div style={{ marginTop: "var(--sp-4)" }}>
        <BrandMark size={56} label="MedAnchor Study logo" />
      </div>

      <h1 className="onboard-heading">Tell us about your studies</h1>
      <p className="onboard-sub">This helps us fit MedAnchor to you.</p>

      <div className="onboard-form">
        <div className="onboard-field">
          <span className="label" id="course-label" style={{ color: "rgba(234,246,251,0.85)" }}>
            Course or program
          </span>
          <div className="chips" role="group" aria-labelledby="course-label" style={{ marginTop: "var(--sp-2)" }}>
            {COURSES.map((c) => (
              <button
                key={c}
                className="chip"
                aria-pressed={course === c}
                onClick={() => setCourse(c)}
                type="button"
                style={
                  course === c
                    ? undefined
                    : { background: "rgba(255,255,255,0.08)", borderColor: "transparent", color: "rgba(234,246,251,0.75)" }
                }
              >
                {c}
              </button>
            ))}
          </div>
          {course === "Other" ? (
            <input
              className="onboard-input"
              style={{ marginTop: "var(--sp-3)" }}
              placeholder="Type your course…"
              value={customCourse}
              onChange={(e) => setCustomCourse(e.target.value)}
              aria-label="Your course"
            />
          ) : null}
        </div>

        <div className="onboard-field">
          <span className="label" id="year-label" style={{ color: "rgba(234,246,251,0.85)" }}>
            Year or level
          </span>
          <div className="year-row" role="group" aria-labelledby="year-label" style={{ marginTop: "var(--sp-2)" }}>
            {YEARS.map((y) => (
              <button key={y} className="chip" aria-pressed={year === y} onClick={() => setYear(y)} type="button">
                {y}
              </button>
            ))}
          </div>
        </div>

        <div className="onboard-field">
          <label htmlFor="school">School or country (optional)</label>
          <input
            id="school"
            className="onboard-input"
            placeholder="You can leave this empty"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            autoComplete="organization"
          />
        </div>

        {error ? <div className="alert alert-danger">{error}</div> : null}

        <button className="btn-brand" disabled={!ready || pending} onClick={finish} type="button">
          {pending ? "Saving…" : "Finish"}
        </button>
        <button className="onboard-skip" onClick={skip} type="button">
          Skip for now
        </button>
      </div>

      <div className="onboard-gap" style={{ minHeight: "var(--sp-6)" }} />
      <div className="onboard-dots" aria-label="Page 3 of 3">
        <i data-on="false" />
        <i data-on="false" />
        <i data-on="true" />
      </div>
    </div>
  );
}
