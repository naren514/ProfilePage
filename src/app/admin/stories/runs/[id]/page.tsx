import type { Metadata } from "next";
import { RunPage } from "@/components/writing/agent/activity";

export const metadata: Metadata = { title: "Workflow | Admin" };

export default function AgentRunPage({ params }: { params: { id: string } }) {
  return <RunPage runId={params.id} />;
}
