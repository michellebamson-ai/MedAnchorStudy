import { redirect } from "next/navigation";

/**
 * Retired as a destination by the seven-tab sidebar (ONBOARDING_SPEC.md).
 * Its topic-picker role now lives on the AI Tutor page; grouped discovery
 * lives in the sidebar itself.
 */
export default function LearnRedirect() {
  redirect("/teach");
}
