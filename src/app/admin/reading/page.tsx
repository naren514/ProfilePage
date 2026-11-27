import type { Metadata } from "next";
import { Discover } from "@/components/reading/workspace/discover";

export const metadata: Metadata = { title: "Discover | Reading" };

export default function Page() {
  return <Discover />;
}
