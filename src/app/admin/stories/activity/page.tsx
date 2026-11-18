import type { Metadata } from "next";
import { ActivityList } from "@/components/writing/agent/activity";

export const metadata: Metadata = { title: "Agent activity | Admin" };

export default function ActivityPage() {
  return <ActivityList />;
}
