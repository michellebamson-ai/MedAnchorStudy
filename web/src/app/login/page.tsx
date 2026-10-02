import { LoginForm } from "@/components/onboarding/login-form";

export const metadata = { title: "Sign in" };

/**
 * Page 2: Login and Setup (ONBOARDING_SPEC.md).
 * No menu, no search, no bottom bar — the teal flow owns the whole screen.
 */
export default function LoginPage() {
  return (
    <div className="onboard">
      <LoginForm />
    </div>
  );
}
