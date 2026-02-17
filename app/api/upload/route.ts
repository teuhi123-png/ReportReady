import { put } from "@vercel/blob";
import pdfParse from "pdf-parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadedFile = {
  name: string;
  url: string;
  size: number;
  pathname: string;
};

type PlanTextStore = Record<string, Record<string, string>>;
type PlanSelectionStore = Record<string, string>;

declare global {
  // eslint-disable-next-line no-var
  var __PLAN_TEXT_STORE__: PlanTextStore | undefined;
  // eslint-disable-next-line no-var
  var __PLAN_SELECTION_STORE__: PlanSelectionStore | undefined;
}

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
      const parsed = await pdfParse(fileBuffer);
      const pdfText = (parsed.text || "").trim();

      const blob = await put(pathname, entry, { access: "public" });
      await put(`${pathname}.txt`, new Blob([pdfText], { type: "text/plain" }), { access: "public" });

      globalThis.__PLAN_TEXT_STORE__ = globalThis.__PLAN_TEXT_STORE__ || {};
      globalThis.__PLAN_TEXT_STORE__[safeEmail] = globalThis.__PLAN_TEXT_STORE__[safeEmail] || {};
      globalThis.__PLAN_TEXT_STORE__[safeEmail][safeFileName] = pdfText;
      globalThis.__PLAN_SELECTION_STORE__ = globalThis.__PLAN_SELECTION_STORE__ || {};
      globalThis.__PLAN_SELECTION_STORE__[safeEmail] = safeFileName;

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
