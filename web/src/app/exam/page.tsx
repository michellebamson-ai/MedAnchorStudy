import { Placeholder } from "@/components/placeholder";

export const metadata = { title: "Exam Preparation" };

export default function PlaceholderPage() {
  return (
    <Placeholder
      title="Exam Preparation"
      lede="Model papers, blueprints and annotated feedback against your exam goals."
      points={["Practice sets with full explanations", "Coverage against your blueprint", "Wrong answers become flashcards"]}
      links={[{ href: "/materials?tab=questions", label: "Practice now" }]}
    />
  );
}
