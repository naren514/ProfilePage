import type { Metadata } from "next";
import { AutomationsPage } from "@/components/writing/agent/automations";

export const metadata: Metadata = { title: "Helpers | AI" };

export default function Page() {
  return <AutomationsPage bare />;
}
