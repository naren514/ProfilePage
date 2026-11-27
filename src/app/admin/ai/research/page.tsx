import type { Metadata } from "next";
import { DeepResearchStart } from "@/components/writing/agent/deep-research-start";

export const metadata: Metadata = { title: "Deep research | AI" };

export default function Page() {
  return <DeepResearchStart />;
}
