import { Placeholder } from "@/components/placeholder";

export const metadata = { title: "Clinical Cases" };

export default function PlaceholderPage() {
  return (
    <Placeholder
      title="Clinical Cases"
      lede="Step-by-step clinical and public-health scenarios with expert feedback."
      points={["History-taking to management plans", "Outbreak and community scenarios", "Reasoning graded, not just answers"]}
      links={[{ href: "/teach", label: "Prepare with the tutor" }]}
    />
  );
}
