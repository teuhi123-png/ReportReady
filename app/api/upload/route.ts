import { put } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadedFile = {
  name: string;
  url: string;
  size: number;
  pathname: string;
  txtPathname: string;
  txtUrl: string;
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
      return Response.json({ success: false, error: "No files received" }, { status: 400 });
    }

    const uploadedFiles: UploadedFile[] = [];

    for (const entry of entries) {
      if (!(entry instanceof File)) {
        return Response.json({ success: false, error: "Invalid file payload" }, { status: 400 });
      }

      const safeEmail = safePathSegment(userEmail || "anonymous");
      const safeFileName = safePathSegment(entry.name);
      const pathname = `uploads/${safeEmail}/${Date.now()}-${safeFileName}`;
      const textKey = `text:${entry.name}`;
      const directText = formData.get(textKey);
      const textsPayloadRaw = String(formData.get("texts") || "").trim();
      let mapText = "";
      if (textsPayloadRaw) {
        try {
          const parsedMap = JSON.parse(textsPayloadRaw) as Record<string, string>;
          mapText = String(parsedMap?.[entry.name] || "");
        } catch {
          mapText = "";
        }
      }
      const pdfText = String(directText || mapText || "").trim();

      if (!pdfText) {
        return Response.json({ success: false, error: "No extracted text received" }, { status: 400 });
      }

      const blob = await put(pathname, entry, { access: "public" });
      const textBlob = await put(`${pathname}.txt`, pdfText, { access: "public" });

      uploadedFiles.push({
        name: safeFileName,
        url: blob.url,
        size: entry.size,
        pathname: blob.pathname,
        txtPathname: textBlob.pathname,
        txtUrl: textBlob.url,
      });
    }

    return Response.json({ success: true, files: uploadedFiles });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload failed";
    console.error("UPLOAD ERROR:", error);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
