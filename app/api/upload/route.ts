import { put } from "@vercel/blob";
import { PDFParse } from "pdf-parse";
import fs from "fs";
import path from "path";

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
      return Response.json({ success: false, error: "No files received" }, { status: 400 });
    }

    const uploadedFiles: UploadedFile[] = [];

    for (const entry of entries) {
      if (!(entry instanceof File)) {
        return Response.json({ success: false, error: "Invalid file payload" }, { status: 400 });
      }

      const safeEmail = safePathSegment(userEmail || "anonymous");
      const safeFileName = safePathSegment(entry.name);
      const pathname = `uploads/${safeEmail}/${safeFileName}`;
      const fileBuffer = Buffer.from(await entry.arrayBuffer());
      const parser = new PDFParse({ data: fileBuffer });
      let pdfText = "";
      try {
        const parsed = await parser.getText();
        pdfText = (parsed.text ?? "").trim();
      } finally {
        await parser.destroy();
      }

      if (!pdfText) {
        return Response.json({ success: false, error: "Could not extract text from PDF" }, { status: 400 });
      }

      const blob = await put(pathname, entry, { access: "public" });
      await put(`${pathname}.txt`, pdfText, { access: "public" });
      const localDir = path.join(process.cwd(), "uploads", safeEmail);
      fs.mkdirSync(localDir, { recursive: true });
      fs.writeFileSync(path.join(localDir, `${safeFileName}.txt`), pdfText, "utf8");

      uploadedFiles.push({
        name: safeFileName,
        url: blob.url,
        size: entry.size,
        pathname: blob.pathname,
      });
    }

    return Response.json({ success: true, files: uploadedFiles });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload failed";
    console.error("UPLOAD ERROR:", error);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
