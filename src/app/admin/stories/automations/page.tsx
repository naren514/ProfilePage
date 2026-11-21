import type { Metadata } from "next";
import { AutomationsPage } from "@/components/writing/agent/automations";

export const metadata: Metadata = { title: "Automations | Admin" };

export default function Page() {
  return <AutomationsPage />;
}
