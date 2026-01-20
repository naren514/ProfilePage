import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/firebase/server-auth";
import { db } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const settings = await db.select().from(siteSettings);

    // Convert to key-value object
    const settingsMap: Record<string, unknown> = {};
    for (const setting of settings) {
      settingsMap[setting.key] = setting.value;
    }

    return NextResponse.json(settingsMap);
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    const { key, value, category, label, description } = await request.json();

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: "Key and value are required" },
        { status: 400 }
      );
    }

    // Upsert setting
    const existing = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.key, key))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(siteSettings)
        .set({
          value,
          category: category || existing[0].category,
          label: label || existing[0].label,
          description: description || existing[0].description,
          updatedAt: new Date(),
          updatedBy: authResult.uid,
        })
        .where(eq(siteSettings.key, key));
    } else {
      await db.insert(siteSettings).values({
        key,
        value,
        category: category || "general",
        label,
        description,
        updatedBy: authResult.uid,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving setting:", error);
    return NextResponse.json(
      { error: "Failed to save setting" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    const settings = await request.json();

    // Batch update settings
    for (const [key, value] of Object.entries(settings)) {
      const existing = await db
        .select()
        .from(siteSettings)
        .where(eq(siteSettings.key, key))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(siteSettings)
          .set({
            value: value as Record<string, unknown>,
            updatedAt: new Date(),
            updatedBy: authResult.uid,
          })
          .where(eq(siteSettings.key, key));
      } else {
        await db.insert(siteSettings).values({
          key,
          value: value as Record<string, unknown>,
          updatedBy: authResult.uid,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
