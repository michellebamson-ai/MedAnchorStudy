import { redirect } from "next/navigation";

/**
 * Moved into its hub. Kept as a permanent redirect so old links keep working:
 * assignments lives in /teach?tab=assignments.
 */
export default function LegacyAssignments() {
  redirect("/teach?tab=assignments");
}