import type { Metadata } from "next";
import { StudioEditorPage } from "@/components/writing/studio-editor";

export const metadata: Metadata = { title: "Writing Studio | Admin" };

export default async function StudioDocumentPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <StudioEditorPage id={params.id} />;
}
