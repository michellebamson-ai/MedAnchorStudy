import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

/**
 * Entry point: new students meet Page 1 (welcome); signed-in students go
 * straight to their dashboard (ONBOARDING_SPEC.md).
 */
export default async function Home() {
  const user = await getCurrentUser().catch(() => null);
  redirect(user ? "/dashboard" : "/welcome");
}
