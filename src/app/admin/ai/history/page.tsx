import type { Metadata } from "next";
import { ActivityList } from "@/components/writing/agent/activity";

export const metadata: Metadata = { title: "History | AI" };

export default function Page() {
  return <ActivityList bare />;
}
