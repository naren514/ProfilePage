import type { Metadata } from "next";
import { Published } from "@/components/reading/workspace/published";

export const metadata: Metadata = { title: "Published | Reading" };

export default function Page() {
  return <Published />;
}
