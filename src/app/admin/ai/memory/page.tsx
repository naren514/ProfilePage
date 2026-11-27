import type { Metadata } from "next";
import { MemoryManager } from "@/components/writing/memory-manager";

export const metadata: Metadata = { title: "What it learned | AI" };

export default function Page() {
  return <MemoryManager bare />;
}
