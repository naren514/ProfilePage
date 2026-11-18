import { isProviderConfigured } from "@/lib/llm";
import { aiSettingsSchema, getAiSettings, monthToDate, saveAiSettings } from "@/lib/writing/ai/settings";
import { json, parseBody, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

/** AI settings plus this month's spend. The API key itself never leaves the server. */
export async function GET() {
  return writingRoute(async () => {
    const [settings, usage] = await Promise.all([getAiSettings(), monthToDate()]);
    return json({ settings, usage, providerConfigured: isProviderConfigured() });
  });
}

export async function PUT(request: Request) {
  return writingRoute(async (user) => {
    const body = await parseBody(request, aiSettingsSchema);
    if ("error" in body) return body.error;
    await saveAiSettings(body.data, user.email ?? "admin");
    return json({ settings: body.data });
  });
}
