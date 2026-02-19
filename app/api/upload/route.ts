import { put } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadedFile = {
  name: string;
  url: string;
  size: number;
  pathname: string;
};

function safePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._@-]/g, "_");
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const userEmail = String(formData.get("userEmail") || "").trim();
    const entries = formData.getAll("files");

    if (!entries.length) {
      const blobUrl = String(formData.get("blobUrl") || "").trim();
      const blobPathname = String(formData.get("blobPathname") || "").trim();
      const filename = String(formData.get("filename") || "").trim();
      const size = Number(formData.get("size") || 0);

      if (!blobUrl || !blobPathname || !filename) {
        return Response.json({ success: false, error: "No files received" }, { status: 400 });
      }

      const safeName = safePathSegment(filename);
      return Response.json({
        success: true,
        files: [
          {
            name: safeName,
            url: blobUrl,
            size: Number.isFinite(size) ? size : 0,
            pathname: blobPathname,
          },
        ],
      });
    }

    const uploadedFiles: UploadedFile[] = [];

    for (const entry of entries) {
      if (!(entry instanceof File)) {
        return Response.json({ success: false, error: "Invalid file payload" }, { status: 400 });
      }

      const safeEmail = safePathSegment(userEmail || "anonymous");
      const safeFileName = safePathSegment(entry.name);
      const pathname = `uploads/${safeEmail}/${Date.now()}-${safeFileName}`;

      const blob = await put(pathname, entry, { access: "public" });

      uploadedFiles.push({
        name: safeFileName,
        url: blob.url,
        size: entry.size,
        pathname: blob.pathname,
      });
    }

    return Response.json({ success: true, files: uploadedFiles });
  } catch (error: any) {
    console.error("UPLOAD ERROR:", error);
    return Response.json(
      { error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}
