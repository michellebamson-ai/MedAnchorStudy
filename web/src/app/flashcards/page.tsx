import { Placeholder } from "@/components/placeholder";

export const metadata = { title: "Flashcards" };

export default function PlaceholderPage() {
  return (
    <Placeholder
      title="Flashcards"
      lede="Adaptive active recall lives in Materials now — decks per material, reviews on schedule."
      points={[]}
      links={[{ href: "/materials?tab=flashcards", label: "Open flashcards" }]}
    />
  );
}
