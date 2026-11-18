import type { Metadata } from "next";
import { MemoryManager } from "@/components/writing/memory-manager";

export const metadata: Metadata = { title: "Writing memory | Admin" };

export default function MemoryPage() {
  return <MemoryManager />;
}
