import type { Metadata } from "next";
import { StylesManager } from "@/components/writing/styles-manager";

export const metadata: Metadata = { title: "Settings & cost | AI" };

export default function Page() {
  return <StylesManager section="ai" />;
}
