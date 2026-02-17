import { list } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._@-]/g, "_");
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userEmail = searchParams.get("userEmail") || "";
    const safeEmail = safePathSegment(userEmail);

    const { blobs } = await list({
      prefix: `uploads/${safeEmail}/`,
    });

    const files = blobs
      .filter((blob) => blob.pathname.toLowerCase().endsWith(".pdf"))
      .map((blob) => {
        const cleanName = (blob.pathname.split("/").pop() ?? blob.pathname).replace(/^\d+-/, "");

        return {
          url: blob.url,
          pdfFileName: cleanName,
          pdfKey: blob.pathname,
          pathname: blob.pathname,
          name: cleanName,
          size: blob.size,
          uploadedAt: blob.uploadedAt,
        };
      });

    return Response.json({
      success: true,
      files,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch uploads";
    console.error("UPLOADS LIST ERROR:", error);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
