"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { requestPasswordReset, signIn, signUp } from "@/lib/auth-client";

type Mode = "create" | "signin";

function strengthOf(pw: string): { label: string; pct: number } {
  if (!pw) return { label: "", pct: 0 };
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (score <= 2) return { label: "Weak", pct: 33 };
  if (score <= 3) return { label: "Okay", pct: 66 };
  return { label: "Strong", pct: 100 };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Page 2: Login and Setup (ONBOARDING_SPEC.md). Create-account first, sign-in
 * second; password meter, show toggle, Google option, spec-exact messages,
 * and the quiet "Welcome, {name}" moment after sign-up.
 */
export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("create");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [welcomed, setWelcomed] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const meter = strengthOf(password);

  function validate(): boolean {
    setEmailError("");
    setPasswordError("");
    setFormError("");
    let ok = true;
    if (!email.trim()) {
      setEmailError("Enter your email.");
      ok = false;
    } else if (!EMAIL_RE.test(email.trim())) {
      setEmailError("Check your email address.");
      ok = false;
    }
    if (password.length < 8) {
      setPasswordError("Use at least 8 characters.");
      ok = false;
    }
    return ok;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!validate()) return;
    setBusy(true);
    try {
      if (mode === "create") {
        const name = firstName.trim();
        const res = await signUp.email({
          email: email.trim(),
          password,
          name: name || email.trim().split("@")[0],
        });
        if (res.error) {
          setFormError("That email or password doesn't match. Try again.");
          return;
        }
        // The quiet welcome moment — same teal, logo, one line, ~2 seconds.
        const short = (name || "there").split(" ")[0];
        setWelcomed(short);
        setTimeout(() => router.push("/profile-setup"), 2000);
      } else {
        const res = await signIn.email({ email: email.trim(), password });
        if (res.error) {
          setFormError("That email or password doesn't match. Try again.");
          return;
        }
        // Returning students skip setup and go straight to the dashboard.
        router.push("/dashboard");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setFormError("");
    try {
      await signIn.social({ provider: "google", callbackURL: "/profile-setup" });
    } catch {
      setFormError("Google sign-in isn't connected yet — email works right now.");
    }
  }

  async function forgot() {
    if (!email.trim()) {
      setFormError("Enter your email address first.");
      return;
    }
    setFormError("");
    setBusy(true);
    try {
      await requestPasswordReset({
        email: email.trim(),
        redirectTo: `${window.location.origin}/login`,
      });
      // Always the same message: never reveal whether an account exists.
      setResetSent(true);
    } catch {
      setFormError("We couldn't start the reset. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  if (resetSent) {
    return (
      <div className="onboard-inner" style={{ justifyContent: "center", textAlign: "center" }}>
        <BrandMark size={72} glow label="MedAnchor Study logo" />
        <h1 className="onboard-heading" style={{ marginTop: "var(--sp-6)" }}>
          Check your email
        </h1>
        <p className="onboard-sub" style={{ maxWidth: "34ch" }}>
          If an account exists for {email.trim()}, a reset link is on its way. It expires in an hour.
        </p>
        <button
          className="onboard-skip"
          onClick={() => {
            setResetSent(false);
            setFormError("");
          }}
          type="button"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  if (welcomed) {
    return (
      <div className="onboard-inner" style={{ justifyContent: "center", textAlign: "center" }}>
        <BrandMark size={96} glow label="MedAnchor Study logo" />
        <h1 className="onboard-heading" style={{ marginTop: "var(--sp-6)" }}>
          Welcome, {welcomed}.
        </h1>
      </div>
    );
  }

  return (
    <div className="onboard-inner">
      <Link className="onboard-back" href="/welcome" aria-label="Back to welcome">
        ←
      </Link>
      <div style={{ marginTop: "var(--sp-4)" }}>
        <BrandMark size={56} label="MedAnchor Study logo" />
      </div>

      <h1 className="onboard-heading">{mode === "create" ? "Create your account" : "Welcome back"}</h1>
      <p className="onboard-sub">
        {mode === "create" ? "Start studying in a minute." : "Pick up where you left off."}
      </p>

      <div className="onboard-switch" role="group" aria-label="Create account or sign in">
        <button data-on={mode === "create"} onClick={() => { setMode("create"); setFormError(""); }} type="button">
          Create account
        </button>
        <button data-on={mode === "signin"} onClick={() => { setMode("signin"); setFormError(""); }} type="button">
          Sign in
        </button>
      </div>

      <form className="onboard-form" onSubmit={submit} noValidate>
        {mode === "create" ? (
          <div className="onboard-field">
            <label htmlFor="first-name">First name</label>
            <input
              id="first-name"
              className="onboard-input"
              placeholder="What should we call you?"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
            />
          </div>
        ) : null}

        <div className="onboard-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="onboard-input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <p className="onboard-error">{emailError}</p>
        </div>

        <div className="onboard-field">
          <label htmlFor="password">Password</label>
          <div style={{ position: "relative" }}>
            <input
              id="password"
              className="onboard-input"
              style={{ paddingRight: 64 }}
              type={show ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "create" ? "new-password" : "current-password"}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide password" : "Show password"}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: 0,
                color: "rgba(234,246,251,0.65)",
                cursor: "pointer",
                fontSize: "var(--fs-sm)",
              }}
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
          {mode === "create" ? (
            <>
              <div className="onboard-meter" aria-live="polite">
                <span className="progress-line">
                  <i style={{ width: `${meter.pct}%` }} />
                </span>
                <span>{meter.label}</span>
              </div>
              <p className="hint" style={{ color: "rgba(234,246,251,0.55)", marginTop: 4 }}>
                At least 8 characters.
              </p>
            </>
          ) : (
            <div className="row-between" style={{ marginTop: 4 }}>
              <span />
              <button
                type="button"
                onClick={forgot}
                disabled={busy}
                style={{
                  background: "none",
                  border: 0,
                  padding: 0,
                  textDecoration: "underline",
                  color: "rgba(234,246,251,0.65)",
                  cursor: "pointer",
                  fontSize: "var(--fs-xs)",
                }}
              >
                Forgot password?
              </button>
            </div>
          )}
          <p className="onboard-error">{passwordError}</p>
        </div>

        {formError ? <div className="alert alert-danger">{formError}</div> : null}

        <button className="btn-brand" disabled={busy} type="submit">
          {busy ? "One moment…" : mode === "create" ? "Create account" : "Sign in"}
        </button>
      </form>

      <div className="divider-or" style={{ width: "100%", color: "rgba(234,246,251,0.4)" }}>
        <span>or</span>
      </div>
      <button className="btn-outline-light" onClick={google} type="button">
        Continue with Google
      </button>

      <p className="fineprint" style={{ color: "rgba(234,246,251,0.5)" }}>
        By continuing, you agree to the <a href="/terms" style={{ color: "inherit" }}>Terms</a> and{" "}
        <a href="/privacy" style={{ color: "inherit" }}>Privacy Policy</a>.
      </p>

      <div className="onboard-gap" style={{ minHeight: "var(--sp-6)" }} />
      <div className="onboard-dots" aria-label="Page 2 of 3">
        <i data-on="false" />
        <i data-on="true" />
        <i data-on="false" />
      </div>
    </div>
  );
}
