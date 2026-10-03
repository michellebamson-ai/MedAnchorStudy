import { Placeholder } from "@/components/placeholder";

export const metadata = { title: "Progress" };

export default function PlaceholderPage() {
  return (
    <Placeholder
      title="Progress"
      lede="How you're developing — strengths, weaknesses and what to do next."
      points={["Multi-signal mastery, not single scores", "Action recommendations, not just graphs", "Study consistency over time"]}
      links={[{ href: "/dashboard", label: "See progress now" }]}
    />
  );
}
