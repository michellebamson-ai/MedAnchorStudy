import { Placeholder } from "@/components/placeholder";

export const metadata = { title: "Assignments & Projects" };

export default function PlaceholderPage() {
  return (
    <Placeholder
      title="Assignments & Projects"
      lede="Track every assignment and project in one place, with deadlines feeding your plan."
      points={["Status across all coursework", "Deadlines flow into Study Plan", "Deep work happens in the AI Tutor workspace"]}
      links={[{ href: "/teach?tab=assignments", label: "Open assignment workspace" }]}
    />
  );
}
