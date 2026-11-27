import type { Metadata } from "next";
import { RunPage } from "@/components/writing/agent/activity";

export const metadata: Metadata = { title: "Workflow | Admin" };

export default async function AgentRunPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <RunPage runId={params.id} />;
}
