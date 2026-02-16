import type { IncomingMessage } from "http";
import { mkdir, readdir, stat, writeFile } from "fs/promises";
import path from "path";

export type UploadedPlan = {
  name: string;
  uploadedAt: string;
};

type ParsedFilePart = {
  filename: string;
  contentType: string;
  data: Buffer;
};

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[^\w.\- ]+/g, "_").trim();
  return base.length > 0 ? base : "upload.pdf";
}

function isPdfFile(contentType: string, filename: string): boolean {
  const normalizedType = contentType.toLowerCase();
  const normalizedName = filename.toLowerCase();
  return normalizedType === "application/pdf" || normalizedName.endsWith(".pdf");
}

async function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of req) {
    const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += chunkBuffer.length;
    if (total > MAX_UPLOAD_BYTES) {
      throw new Error("Upload payload is too large");
    }
    chunks.push(chunkBuffer);
  }

  return Buffer.concat(chunks);
}

function parseMultipartParts(body: Buffer, boundary: string): ParsedFilePart[] {
  const boundaryToken = `--${boundary}`;
  const raw = body.toString("latin1");
  const segments = raw.split(boundaryToken);
  const files: ParsedFilePart[] = [];

  for (const segment of segments) {
    const part = segment.trim();
    if (!part || part === "--") continue;

    const normalizedPart = part.startsWith("\r\n") ? part.slice(2) : part;
    const headerEnd = normalizedPart.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;

    const headersRaw = normalizedPart.slice(0, headerEnd);
    const bodyRaw = normalizedPart.slice(headerEnd + 4);
    const dataRaw = bodyRaw.endsWith("\r\n") ? bodyRaw.slice(0, -2) : bodyRaw;

    const headers = new Map<string, string>();
    for (const line of headersRaw.split("\r\n")) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      headers.set(line.slice(0, idx).trim().toLowerCase(), line.slice(idx + 1).trim());
    }

    const disposition = headers.get("content-disposition") ?? "";
    const filenameMatch = disposition.match(/filename="([^"]*)"/i);
    if (!filenameMatch || !filenameMatch[1]) continue;

    const contentType = headers.get("content-type") ?? "application/octet-stream";
    files.push({
      filename: filenameMatch[1],
      contentType,
      data: Buffer.from(dataRaw, "latin1"),
    });
  }

  return files;
}

export async function ensureUploadsDir(): Promise<string> {
  await mkdir(UPLOADS_DIR, { recursive: true });
  return UPLOADS_DIR;
}

export async function listUploadedPlans(): Promise<UploadedPlan[]> {
  await ensureUploadsDir();
  const entries = await readdir(UPLOADS_DIR, { withFileTypes: true });
  const pdfEntries = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"));

  const plans = await Promise.all(
    pdfEntries.map(async (entry) => {
      const filePath = path.join(UPLOADS_DIR, entry.name);
      const fileStat = await stat(filePath);
      return {
        name: entry.name,
        uploadedAt: fileStat.mtime.toISOString(),
      };
    })
  );

  plans.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  return plans;
}

export async function savePdfUploadRequest(req: IncomingMessage): Promise<UploadedPlan[]> {
  const contentType = req.headers["content-type"] ?? "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];

  if (!boundary) {
    throw new Error("Missing multipart boundary");
  }

  const body = await readRequestBody(req);
  const parsedFiles = parseMultipartParts(body, boundary);

  if (parsedFiles.length === 0) {
    throw new Error("No files were uploaded");
  }

  const nonPdf = parsedFiles.find((file) => !isPdfFile(file.contentType, file.filename));
  if (nonPdf) {
    throw new Error("Only PDF files are allowed");
  }

  await ensureUploadsDir();

  const saved = await Promise.all(
    parsedFiles.map(async (file) => {
      const safeName = sanitizeFilename(file.filename);
      const finalName = safeName.toLowerCase().endsWith(".pdf") ? safeName : `${safeName}.pdf`;
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${finalName}`;
      const outputPath = path.join(UPLOADS_DIR, uniqueName);

      await writeFile(outputPath, file.data);
      const fileStat = await stat(outputPath);

      return {
        name: uniqueName,
        uploadedAt: fileStat.mtime.toISOString(),
      };
    })
  );

  saved.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  return saved;
}
