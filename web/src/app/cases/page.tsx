import { redirect } from "next/navigation";

/**
 * Moved into its hub. Kept as a permanent redirect so old links keep working:
 * cases lives in /practice?tab=cases.
 */
export default function LegacyCases() {
  redirect("/practice?tab=cases");
}