import type { Metadata } from "next";
import { ReadingItems } from "@/components/reading/reading-inbox";

export const metadata: Metadata = { title: "Inbox | Reading" };

export default function Page() {
  return <ReadingItems status="inbox" capture />;
}
