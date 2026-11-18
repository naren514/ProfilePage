import type { Metadata } from "next";
import { StylesManager } from "@/components/writing/styles-manager";

export const metadata: Metadata = { title: "Styles & AI | Admin" };

export default function StylesPage() {
  return <StylesManager />;
}
