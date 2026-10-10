import { redirect } from "next/navigation";

/**
 * Moved into its hub. Kept as a permanent redirect so old links keep working:
 * evidence lives in /research?tab=evidence.
 */
export default function LegacyEvidence() {
  redirect("/research?tab=evidence");
}