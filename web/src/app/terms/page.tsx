import { Placeholder } from "@/components/placeholder";

export const metadata = { title: "Terms" };

export default function PlaceholderPage() {
  return (
    <Placeholder
      title="Terms"
      lede="The short version: MedAnchor is a study companion. Your work stays yours."
      points={["Your materials and data are private to your account", "Delete anything, any time, from Settings"]}
      links={[{ href: "/welcome", label: "Back to welcome" }]}
    />
  );
}
