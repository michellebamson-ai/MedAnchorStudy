import { Placeholder } from "@/components/placeholder";

export const metadata = { title: "Evidence" };

export default function PlaceholderPage() {
  return (
    <Placeholder
      title="Evidence"
      lede="Find and understand reliable health evidence — with limits stated honestly."
      points={["Peer-reviewed sources first", "Uploaded material vs external evidence, always labelled", "Disagreements shown, not hidden"]}
      links={[{ href: "/materials?tab=analyze", label: "Analyze a paper" }]}
    />
  );
}
