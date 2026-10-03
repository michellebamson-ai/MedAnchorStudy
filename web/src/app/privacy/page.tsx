import { Placeholder } from "@/components/placeholder";

export const metadata = { title: "Privacy Policy" };

export default function PlaceholderPage() {
  return (
    <Placeholder
      title="Privacy Policy"
      lede="What we collect and why — in plain words."
      points={["Study activity, to personalize learning and track mastery", "Uploaded materials, to build your study tools", "Nothing is shared. Delete your account and it is all gone."]}
      links={[{ href: "/welcome", label: "Back to welcome" }]}
    />
  );
}
