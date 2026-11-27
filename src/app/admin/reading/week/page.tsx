import type { Metadata } from "next";
import { ThisWeek } from "@/components/reading/workspace/this-week";

export const metadata: Metadata = { title: "This week | Reading" };

export default function Page() {
  return <ThisWeek />;
}
