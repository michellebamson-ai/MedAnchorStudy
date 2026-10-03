import { Placeholder } from "@/components/placeholder";

export const metadata = { title: "Practice" };

export default function PlaceholderPage() {
  return (
    <Placeholder
      title="Practice"
      lede="Questions, flashcards, cases and review sessions — retrieval and application in one place."
      points={["Flashcards with spaced repetition", "Practice and application questions", "Clinical cases and communication scenarios"]}
      links={[{ href: "/materials?tab=flashcards", label: "Flashcards now" }, { href: "/materials?tab=questions", label: "Practice questions now" }]}
    />
  );
}
