import type { Metadata } from "next";
import { WeeklyListPage } from "@/components/writing/agent/weekly-list";

export const metadata: Metadata = { title: "Weekly list | Admin" };

export default function Page() {
  return <WeeklyListPage />;
}
