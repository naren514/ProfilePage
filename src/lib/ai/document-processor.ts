import { GoogleAIFileManager } from "@google/generative-ai/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Lazy initialization to avoid issues during build time
let fileManager: GoogleAIFileManager | null = null;
let genAI: GoogleGenerativeAI | null = null;

function getFileManager(): GoogleAIFileManager {
  if (!fileManager) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);
  }
  return fileManager;
}

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

// Supported MIME types for the Files API
const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/html",
  "text/css",
  "text/javascript",
  "application/json",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
  "audio/wav",
  "audio/mp3",
  "audio/aiff",
  "audio/aac",
  "audio/ogg",
  "audio/flac",
  "video/mp4",
  "video/mpeg",
  "video/mov",
  "video/avi",
  "video/x-flv",
  "video/mpg",
  "video/webm",
  "video/wmv",
  "video/3gpp",
];

export function isSupportedMimeType(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.includes(mimeType);
}

interface UploadedFile {
  uri: string;
  mimeType: string;
  name: string;
  displayName: string;
}

/**
 * Upload a file to Gemini Files API
 */
export async function uploadFileToGemini(
  filePath: string,
  mimeType: string,
  displayName?: string
): Promise<UploadedFile> {
  const fm = getFileManager();
  const uploadResult = await fm.uploadFile(filePath, {
    mimeType,
    displayName: displayName || filePath.split("/").pop() || "document",
  });

  // Poll for file processing completion
  let file = await fm.getFile(uploadResult.file.name);
  while (file.state === "PROCESSING") {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    file = await fm.getFile(uploadResult.file.name);
  }

  if (file.state === "FAILED") {
    throw new Error(`File processing failed: ${file.name}`);
  }

  return {
    uri: file.uri,
    mimeType: file.mimeType,
    name: file.name,
    displayName: file.displayName || displayName || "document",
  };
}

/**
 * Upload a file from a Buffer (uses inline data approach)
 */
export async function uploadBufferToGemini(
  buffer: Buffer,
  mimeType: string,
  displayName: string
): Promise<UploadedFile> {
  // Create a data URI for inline processing
  // The Files API requires a file path, so we use inline data for buffers
  const base64Data = buffer.toString("base64");

  return {
    uri: `data:${mimeType};base64,${base64Data}`,
    mimeType,
    name: displayName,
    displayName,
  };
}

/**
 * Extract text content from a PDF or other document using Gemini
 */
export async function extractTextFromDocument(
  fileUri: string,
  mimeType: string
): Promise<string> {
  const model = getGenAI().getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  const isDataUri = fileUri.startsWith("data:");

  let content;
  if (isDataUri) {
    // For data URIs (inline data)
    const base64Data = fileUri.split(",")[1];
    content = {
      inlineData: {
        data: base64Data,
        mimeType,
      },
    };
  } else {
    // For Files API URIs
    content = {
      fileData: {
        fileUri,
        mimeType,
      },
    };
  }

  const result = await model.generateContent([
    content,
    {
      text: `Extract all text content from this document.
Maintain the original structure and formatting as much as possible.
If this is a resume, identify sections like:
- Contact Information
- Summary/Objective
- Experience
- Education
- Skills
- Certifications
- Projects

Return the extracted text in a clean, readable format.`,
    },
  ]);

  return result.response.text();
}

/**
 * Process a PDF document and extract structured information
 */
export async function processDocument(
  fileUri: string,
  mimeType: string
): Promise<{
  text: string;
  summary: string;
  sections: Array<{ title: string; content: string }>;
}> {
  const model = getGenAI().getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  const isDataUri = fileUri.startsWith("data:");

  let content;
  if (isDataUri) {
    const base64Data = fileUri.split(",")[1];
    content = {
      inlineData: {
        data: base64Data,
        mimeType,
      },
    };
  } else {
    content = {
      fileData: {
        fileUri,
        mimeType,
      },
    };
  }

  const result = await model.generateContent([
    content,
    {
      text: `Analyze this document and provide:
1. Full text extraction
2. A brief summary (2-3 sentences)
3. Identified sections with their content

Return as JSON:
{
  "text": "full extracted text",
  "summary": "brief summary",
  "sections": [
    {"title": "section name", "content": "section content"}
  ]
}

Only return the JSON, nothing else.`,
    },
  ]);

  const responseText = result.response.text();

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // If JSON parsing fails, return raw text
  }

  return {
    text: responseText,
    summary: responseText.slice(0, 200) + "...",
    sections: [],
  };
}

/**
 * Delete a file from Gemini Files API
 */
export async function deleteGeminiFile(fileName: string): Promise<void> {
  try {
    await getFileManager().deleteFile(fileName);
  } catch (error) {
    console.error("Failed to delete Gemini file:", error);
  }
}

/**
 * List all uploaded files
 */
export async function listGeminiFiles(): Promise<
  Array<{
    name: string;
    displayName: string;
    mimeType: string;
    state: string;
    uri: string;
  }>
> {
  const response = await getFileManager().listFiles();
  return (response.files || []).map((file) => ({
    name: file.name,
    displayName: file.displayName || file.name,
    mimeType: file.mimeType,
    state: file.state,
    uri: file.uri,
  }));
}
