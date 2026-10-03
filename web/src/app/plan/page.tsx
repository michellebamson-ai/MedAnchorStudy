import { Placeholder } from "@/components/placeholder";

export const metadata = { title: "Study Plan" };

export default function PlaceholderPage() {
  return (
    <Placeholder
      title="Study Plan"
      lede="Schedule, time-aware sessions and recovery — built from your exams, deadlines and weaknesses."
      points={["Exam countdowns and milestones", "Daily goals that adapt", "Missed sessions rescheduled, never piled on"]}
      links={[{ href: "/dashboard", label: "See today's plan" }]}
    />
  );
}
