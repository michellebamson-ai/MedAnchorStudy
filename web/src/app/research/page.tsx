import { Placeholder } from "@/components/placeholder";

export const metadata = { title: "Research" };

export default function PlaceholderPage() {
  return (
    <Placeholder
      title="Research"
      lede="Biostatistics, research methods and evidence — the shared Research & Evidence Engine."
      points={["Step-by-step statistics coaching", "Study designs, variables and methods", "Evidence discovery with source transparency"]}
      links={[{ href: "/materials?tab=analyze", label: "Analyze a paper" }]}
    />
  );
}
