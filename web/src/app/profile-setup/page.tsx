import { ProfileForm } from "@/components/onboarding/profile-form";

export const metadata = { title: "Your profile" };

/**
 * Page 3: Your Profile (ONBOARDING_SPEC.md). No exams, no uploads, no menu —
 * just the facts that make the app feel personal.
 */
export default function ProfileSetupPage() {
  return (
    <div className="onboard">
      <ProfileForm />
    </div>
  );
}
