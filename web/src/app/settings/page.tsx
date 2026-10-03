import { Placeholder } from "@/components/placeholder";

export const metadata = { title: "Settings" };

export default function PlaceholderPage() {
  return (
    <Placeholder
      title="Settings"
      lede="Academic level, courses, explanation depth, teaching style, reminders and theme."
      points={["Personalization that shapes every feature", "Reminder preferences", "Data export and deletion controls"]}
      links={[{ href: "/dashboard", label: "Dashboard" }]}
    />
  );
}
