"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { resetPassword } from "@/lib/auth-client";
import { strengthOf } from "@/lib/password";

/**
 * Password reset form.
 *
 * Better Auth validates the emailed token at /api/auth/reset-password/:token
 * and then redirects here with ?token=... (or ?error=INVALID_TOKEN when the
 * link is expired, already used, or malformed). This page is the half that was
 * missing entirely: the token used to arrive at /login, which ignored it, so
 * the journey dead-ended after the email.
 */
export function ResetForm({ token, initialError }: { token: string | null; initialError: string | null }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const meter = strengthOf(password);

  // Expired, already used, or simply not a reset link. Say which, because
  // "it didn't work" makes people click the link five more times.
  if (!token) {
    return (
      <div className="onboard-inner" style={{ justifyContent: "center", textAlign: "center" }}>
        <BrandMark size={72} glow label="MedAnchor Study logo" />
        <h1 className="onboard-heading" style={{ marginTop: "var(--sp-6)" }}>
          This link no longer works
        </h1>
        <p className="onboard-sub" style={{ maxWidth: "38ch" }}>
          {initialError
            ? "Reset links last one hour and can only be used once. Request a fresh one below."
            : "This page needs a reset link from your email. Request a new one below."}
        </p>
        <button className="btn-brand" onClick={() => router.push("/login")} type="button">
          Request a new link
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="onboard-inner" style={{ justifyContent: "center", textAlign: "center" }}>
        <BrandMark size={72} glow label="MedAnchor Study logo" />
        <h1 className="onboard-heading" style={{ marginTop: "var(--sp-6)" }}>
          Password changed
        </h1>
        <p className="onboard-sub" style={{ maxWidth: "36ch" }}>
          Every other device has been signed out, for safety. Sign in again with your new password.
        </p>
        <button className="btn-brand" onClick={() => router.push("/login")} type="button">
          Go to sign in
        </button>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError("");
    setFormError("");
    if (password.length < 8) {
      setFieldError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setFieldError("Those two passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await resetPassword({ newPassword: password, token: token! });
      if (res.error) {
        setFormError("That link has expired or was already used. Request a new one from the sign-in page.");
        return;
      }
      setDone(true);
    } catch {
      setFormError("We couldn't change the password. Try again, or request a new link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="onboard-inner">
      <div style={{ marginTop: "var(--sp-4)" }}>
        <BrandMark size={56} label="MedAnchor Study logo" />
      </div>
      <h1 className="onboard-heading">Choose a new password</h1>
      <p className="onboard-sub">Pick something you have not used here before.</p>

      <form className="onboard-form" onSubmit={submit} noValidate>
        <div className="onboard-field">
          <label htmlFor="new-password">New password</label>
          <div style={{ position: "relative" }}>
            <input
              id="new-password"
              className="onboard-input"
              style={{ paddingRight: 64 }}
              type={show ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
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
          <div className="onboard-meter" aria-live="polite">
            <span className="progress-line">
              <i style={{ width: `${meter.pct}%` }} />
            </span>
            <span>{meter.label}</span>
          </div>
        </div>

        <div className="onboard-field">
          <label htmlFor="confirm-password">Confirm new password</label>
          <input
            id="confirm-password"
            className="onboard-input"
            type={show ? "text" : "password"}
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
          <p className="onboard-error">{fieldError}</p>
        </div>

        {formError ? <div className="alert alert-danger">{formError}</div> : null}

        <button className="btn-brand" disabled={busy} type="submit">
          {busy ? "One moment…" : "Change password"}
        </button>
      </form>

      <button className="onboard-skip" onClick={() => router.push("/login")} type="button">
        Back to sign in
      </button>
    </div>
  );
}