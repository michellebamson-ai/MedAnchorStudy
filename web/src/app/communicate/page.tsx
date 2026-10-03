import { Placeholder } from "@/components/placeholder";

export const metadata = { title: "Communication Practice" };

export default function PlaceholderPage() {
  return (
    <Placeholder
      title="Communication Practice"
      lede="Role-play histories, health education and difficult conversations with feedback."
      points={["Patient, caregiver and community roles", "Clarity, questioning and empathy scored", "SOAP-note practice"]}
      links={[{ href: "/teach", label: "Prepare with the tutor" }]}
    />
  );
}
