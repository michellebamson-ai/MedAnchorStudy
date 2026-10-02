import { redirect } from "next/navigation";

/**
 * Retired as a destination by the seven-tab sidebar (ONBOARDING_SPEC.md).
 * Specialised spaces are now grouped in the sidebar: Practice and Research
 * lead to their hubs, Materials/Plan/Progress stand alone.
 */
export default function ExploreRedirect() {
  redirect("/dashboard");
}
