import { redirect } from "next/navigation";

/**
 * Study Plan and the dashboard link to /teach/<topic>. Keep those working by
 * redirecting to the tutor with the topic preselected.
 */
export default async function TeachTopicRedirect({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic } = await params;
  redirect(`/teach?topic=${encodeURIComponent(topic)}`);
}