import { LoginForm } from "@/components/onboarding/login-form";
import { googleReady } from "@/lib/auth";

export const metadata = { title: "Sign in" };

/**
 * Page 2: Login and Setup (ONBOARDING_SPEC.md).
 * No menu, no search, no bottom bar — the teal flow owns the whole screen.
 */
export default function LoginPage() {
  // Evaluated on the server so the button is never rendered unless Google is
  // genuinely configured. Offering it and failing at Google's redirect is
  // worse than not offering it.
  return (
    <div className="onboard">
      <LoginForm google={googleReady()} />
    </div>
  );
}
