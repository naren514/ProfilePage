import { buildExport } from "@/lib/writing/export";
import { writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Everything the Studio stores, as one ZIP of open formats (PRD §22). */
export async function GET() {
  return writingRoute(async () => {
    const { zip, filename } = await buildExport();
    return new Response(zip as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
