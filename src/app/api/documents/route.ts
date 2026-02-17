import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/auth/server-auth";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { put } from "@vercel/blob";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const category = (formData.get("category") as string) || "general";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "text/plain",
      "text/markdown",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileExtension = file.name.split(".").pop();
    const uniqueFilename = `${uuidv4()}.${fileExtension}`;

    // Upload to Vercel Blob
    let storagePath: string;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(uniqueFilename, file, {
        access: "public",
      });
      storagePath = blob.url;
    } else {
      // For development without Vercel Blob, store path reference
      storagePath = `/uploads/${uniqueFilename}`;
    }

    // Save document metadata to database
    const [newDocument] = await db
      .insert(documents)
      .values({
        filename: uniqueFilename,
        originalName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        storagePath,
        category,
        uploadedBy: authResult.uid,
      })
      .returning();

    return NextResponse.json({
      documentId: newDocument.id,
      message: "Document uploaded successfully",
    });
  } catch (error) {
    console.error("Document upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (isUnauthorizedResponse(authResult)) {
      return authResult;
    }

    const docs = await db.select().from(documents);
    return NextResponse.json(docs);
  } catch (error) {
    console.error("Get documents error:", error);
    return NextResponse.json(
      { error: "Failed to get documents" },
      { status: 500 }
    );
  }
}
