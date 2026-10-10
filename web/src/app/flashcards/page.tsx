import { redirect } from "next/navigation";

/**
 * Moved into its hub. Kept as a permanent redirect so old links keep working:
 * flashcards lives in /materials?tab=flashcards.
 */
export default function LegacyFlashcards() {
  redirect("/materials?tab=flashcards");
}