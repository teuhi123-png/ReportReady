import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._@-]/g, "_");
}

type BlobUploadBody = {
  filename?: string;
  contentType?: string;
  userEmail?: string;
};

export async function POST(req: Request) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return Response.json(
        { success: false, error: "Missing BLOB_READ_WRITE_TOKEN" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as BlobUploadBody;
    const filename = String(body.filename || "").trim();
    const contentType = String(body.contentType || "").trim();
    const safeEmail = safePathSegment(String(body.userEmail || "anonymous").trim() || "anonymous");

    if (!filename) {
      return Response.json({ success: false, error: "filename is required" }, { status: 400 });
    }

    const lowerName = filename.toLowerCase();
    if (contentType !== "application/pdf" && !lowerName.endsWith(".pdf")) {
      return Response.json({ success: false, error: "Only PDF uploads are allowed" }, { status: 400 });
    }

    const safeFileName = safePathSegment(filename);
    const pathname = `uploads/${safeEmail}/${Date.now()}-${safeFileName}`;

    const clientToken = await generateClientTokenFromReadWriteToken({
      token: process.env.BLOB_READ_WRITE_TOKEN,
      pathname,
      addRandomSuffix: false,
      allowedContentTypes: ["application/pdf"],
      maximumSizeInBytes: 500 * 1024 * 1024,
      validUntil: Date.now() + 10 * 60 * 1000,
    });

    return Response.json({
      success: true,
      clientToken,
      pathname,
    });
  } catch (error: any) {
    console.error("BLOB UPLOAD TOKEN ERROR:", error);
    return Response.json(
      { success: false, error: error?.message || "Failed to create upload token" },
      { status: 500 }
    );
  }
}
