import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { getDocument } from "@/lib/writing/documents";
import { documentToHtml } from "@/lib/writing/content";
import { ThoughtArticle } from "@/components/thoughts/thought-article";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Preview | Admin", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The saved draft, rendered exactly as the public post page would show it. */
export default async function StudioPreviewPage({ params }: { params: { id: string } }) {
  noStore();
  if (!UUID.test(params.id)) notFound();
  const found = await getDocument(params.id);
  if (!found) notFound();
  const { doc, story } = found;

  return (
    <div className="-m-8 min-h-screen bg-background">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-amber-500/10 px-6 py-2 text-sm backdrop-blur">
        <span>
          <strong>Preview.</strong> This is the saved draft{doc.status === "PUBLISHED" ? "; the live post may differ" : " and isn't published"}.
        </span>
        <Link href={`/admin/stories/${doc.id}`} className="underline underline-offset-2">
          Back to editing
        </Link>
      </div>
      <div className="pt-12 pb-20">
        <ThoughtArticle
          backHref="/thoughts"
          post={{
            title: doc.title || "Untitled",
            summary: doc.excerpt,
            html: documentToHtml(doc.bodyJson),
            date: doc.postDate,
            tags: doc.tags,
            company: story?.company,
            role: story?.role,
            situation: story?.situation,
            task: story?.task,
            result: story?.result,
            lessonsLearned: story?.lessonsLearned,
          }}
        />
      </div>
    </div>
  );
}
