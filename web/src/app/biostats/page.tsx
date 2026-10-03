import { Placeholder } from "@/components/placeholder";

export const metadata = { title: "Biostatistics" };

export default function PlaceholderPage() {
  return (
    <Placeholder
      title="Biostatistics"
      lede="Reasoning-first statistics coaching — why this test, worked step by step."
      points={["Sensitivity to regression and beyond", "Formula walkthroughs", "Output and table interpretation"]}
      links={[{ href: "/research", label: "Research hub" }]}
    />
  );
}
