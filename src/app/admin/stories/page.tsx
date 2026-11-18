import type { Metadata } from "next";
import { DocumentsList } from "@/components/writing/documents-list";

export const metadata: Metadata = { title: "Thoughts | Admin" };

export default function ThoughtsStudioPage() {
  return <DocumentsList />;
}
