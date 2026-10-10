import { redirect } from "next/navigation";

/**
 * Moved into its hub. Kept as a permanent redirect so old links keep working:
 * communicate lives in /practice?tab=communicate.
 */
export default function LegacyCommunicate() {
  redirect("/practice?tab=communicate");
}