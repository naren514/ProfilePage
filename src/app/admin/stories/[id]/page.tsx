import type { Metadata } from "next";
import { StudioEditorPage } from "@/components/writing/studio-editor";

export const metadata: Metadata = { title: "Writing Studio | Admin" };

export default function StudioDocumentPage({ params }: { params: { id: string } }) {
  return <StudioEditorPage id={params.id} />;
}
