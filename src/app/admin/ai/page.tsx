import type { Metadata } from "next";
import { StylesManager } from "@/components/writing/styles-manager";

export const metadata: Metadata = { title: "Your voice | AI" };

export default function Page() {
  return <StylesManager section="styles" />;
}
