import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth/server-auth";
import { SavePopup } from "@/components/reading/save-popup";
import { rebuildSharedUrl } from "@/lib/reading/url";

export const dynamic = "force-dynamic";
export const metadata = { title: "Save to Reading", robots: { index: false, follow: false } };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Opened by the "+ Reading" bookmarklet. Admin only. */
export default async function ReadingSavePage(
  props: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  const searchParams = await props.searchParams;
  // Keep any of the article link's own parameters that arrived unencoded
  const entries = Object.entries(searchParams).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x] as [string, string]) : [[k, v ?? ""] as [string, string]]));
  const url = rebuildSharedUrl(entries).slice(0, 2000);
  const title = first(searchParams.title).slice(0, 500);
  const quote = first(searchParams.quote).slice(0, 2000);

  const user = await getServerUser();
  if (!user) {
    const back = `/reading-save?${new URLSearchParams({ url, title, quote }).toString()}`;
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }

  return (
    <main className="mx-auto w-full max-w-lg px-6 py-8">
      <p className="mb-6 flex items-center gap-2 text-sm font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-ai" aria-hidden />
        Save to Reading
      </p>
      <SavePopup url={url} title={title} quote={quote} />
    </main>
  );
}
