import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isUnauthorizedResponse } from "@/lib/firebase/server-auth";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (isUnauthorizedResponse(authResult)) {
    return authResult;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    let text = "";

    // Handle different file types
    if (file.type === "text/plain") {
      text = await file.text();
    } else if (file.type === "application/pdf") {
      // For PDF, we'll extract text using pdf-parse or similar
      // For now, return an error asking to paste text
      return NextResponse.json(
        {
          error:
            "PDF parsing requires additional setup. Please copy and paste the text content directly.",
        },
        { status: 400 }
      );
    } else if (
      file.type === "application/msword" ||
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      // For Word docs, extract text from the XML structure (basic approach for .docx)
      if (
        file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        try {
          // .docx files are ZIP archives containing XML
          const arrayBuffer = await file.arrayBuffer();
          const JSZip = (await import("jszip")).default;
          const zip = await JSZip.loadAsync(arrayBuffer);

          // Extract text from document.xml
          const documentXml = await zip.file("word/document.xml")?.async("text");
          if (documentXml) {
            // Simple text extraction - remove XML tags and get text content
            text = documentXml
              .replace(/<w:p[^>]*>/g, "\n") // Paragraph breaks
              .replace(/<[^>]+>/g, "") // Remove all XML tags
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&amp;/g, "&")
              .replace(/&quot;/g, '"')
              .replace(/&apos;/g, "'")
              .replace(/\n\s*\n/g, "\n\n") // Clean up multiple newlines
              .trim();
          }
        } catch (err) {
          console.error("Error parsing docx:", err);
          return NextResponse.json(
            {
              error:
                "Failed to parse Word document. Please copy and paste the text content directly.",
            },
            { status: 400 }
          );
        }
      } else {
        // .doc files (older format) are harder to parse
        return NextResponse.json(
          {
            error:
              "Old Word format (.doc) is not supported. Please save as .docx or copy and paste the text.",
          },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 400 }
      );
    }

    if (!text.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from file" },
        { status: 400 }
      );
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error("Text extraction error:", error);
    return NextResponse.json(
      { error: "Failed to extract text from file" },
      { status: 500 }
    );
  }
}
