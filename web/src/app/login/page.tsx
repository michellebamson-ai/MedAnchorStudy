import { Shell } from "@/components/shell";
import { Alert, PageHead } from "@/components/ui";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Shell section="dashboard">
      <div style={{ maxWidth: 460 }}>
        <PageHead
          eyebrow="Welcome"
          title="Sign in to MedAnchor"
          lede="Your progress, uploads and plans are private to your account."
        />

        <div className="card stack">
          <Alert tone="info">
            Authentication is wired to Better Auth with database-backed sessions. This page is a
            placeholder while the session flow is built in the next step.
          </Alert>

          <form className="stack" action="#">
            <div className="field">
              <label className="label" htmlFor="email">
                Email
              </label>
              <input className="input" id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="field">
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                className="input"
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                minLength={8}
                required
              />
              <span className="hint">At least 8 characters.</span>
            </div>
            <button className="btn btn-primary btn-block" type="submit">
              Sign in
            </button>
          </form>

          <p className="hint" style={{ textAlign: "center" }}>
            No account yet? Registration opens with the same form.
          </p>
        </div>
      </div>
    </Shell>
  );
}
