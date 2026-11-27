import type { Metadata } from "next";
import { ReadingSettings } from "@/components/reading/workspace/settings";

export const metadata: Metadata = { title: "Settings | Reading" };

export default function Page() {
  return <ReadingSettings />;
}
