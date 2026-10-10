import { redirect } from "next/navigation";

/**
 * Moved into its hub. Kept as a permanent redirect so old links keep working:
 * exam lives in /practice?tab=questions.
 */
export default function LegacyExam() {
  redirect("/practice?tab=questions");
}