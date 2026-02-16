import type { IncomingMessage } from "http";
import { createReadStream } from "fs";
import { mkdir, readdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";

export type UploadedPlan = {
  name: string;
  uploadedAt: string;
  projectName: string;
};

type ParsedFilePart = {
  filename: string;
  contentType: string;
  data: Buffer;
};

type ParsedMultipartData = {
  files: ParsedFilePart[];
  fields: Record<string, string>;
};

type UploadMetadataEntry = {
  projectName: string;
  uploadedAt: string;
};

type UploadMetadata = Record<string, UploadMetadataEntry>;

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const METADATA_FILE = "metadata.json";

export function getUploadsDir(): string {
  if (process.env.VERCEL) return "/tmp/uploads";
  return path.join(process.cwd(), "uploads");
}

function getMetadataPath(uploadsDir: string): string {
  return path.join(uploadsDir, METADATA_FILE);
}

function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[^\w.\- ]+/g, "_").trim();
  return base.length > 0 ? base : "upload.pdf";
}

function sanitizeProjectName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized.slice(0, 120) : "Untitled Project";
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

function parseMultipartData(body: Buffer, boundary: string): ParsedMultipartData {
  const boundaryToken = `--${boundary}`;
  const raw = body.toString("latin1");
  const segments = raw.split(boundaryToken);
  const files: ParsedFilePart[] = [];
  const fields: Record<string, string> = {};

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
    const nameMatch = disposition.match(/name="([^"]*)"/i);
    const fieldName = nameMatch?.[1];

    if (filenameMatch && filenameMatch[1]) {
      const contentType = headers.get("content-type") ?? "application/octet-stream";
      files.push({
        filename: filenameMatch[1],
        contentType,
        data: Buffer.from(dataRaw, "latin1"),
      });
      continue;
    }

    if (fieldName) {
      fields[fieldName] = Buffer.from(dataRaw, "latin1").toString("utf8").trim();
    }
  }

  return { files, fields };
}

async function readMetadata(uploadsDir: string): Promise<UploadMetadata> {
  try {
    const metadataText = await readFile(getMetadataPath(uploadsDir), "utf8");
    const parsed = JSON.parse(metadataText) as UploadMetadata;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return {};
    return {};
  }
}

async function writeMetadata(uploadsDir: string, metadata: UploadMetadata): Promise<void> {
  await writeFile(getMetadataPath(uploadsDir), JSON.stringify(metadata, null, 2), "utf8");
}

export async function ensureUploadsDir(): Promise<string> {
  const uploadsDir = getUploadsDir();
  await mkdir(uploadsDir, { recursive: true });
  return uploadsDir;
}

export function getUploadedFilePath(fileName: string): string {
  const safeName = path.basename(fileName);
  return path.join(getUploadsDir(), safeName);
}

export async function listUploadedPlans(): Promise<UploadedPlan[]> {
  const uploadsDir = await ensureUploadsDir();
  const metadata = await readMetadata(uploadsDir);
  const entries = await readdir(uploadsDir, { withFileTypes: true });
  const pdfEntries = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"));

  const plans = await Promise.all(
    pdfEntries.map(async (entry) => {
      const filePath = path.join(uploadsDir, entry.name);
      const fileStat = await stat(filePath);
      const meta = metadata[entry.name];
      return {
        name: entry.name,
        uploadedAt: meta?.uploadedAt ?? fileStat.mtime.toISOString(),
        projectName: meta?.projectName ?? "Untitled Project",
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
  const parsed = parseMultipartData(body, boundary);

  if (parsed.files.length === 0) {
    throw new Error("No files were uploaded");
  }

  const nonPdf = parsed.files.find((file) => !isPdfFile(file.contentType, file.filename));
  if (nonPdf) {
    throw new Error("Only PDF files are allowed");
  }

  const uploadsDir = await ensureUploadsDir();
  const metadata = await readMetadata(uploadsDir);
  const projectName = sanitizeProjectName(parsed.fields.projectName ?? "");

  const saved = await Promise.all(
    parsed.files.map(async (file) => {
      const safeName = sanitizeFilename(file.filename);
      const finalName = safeName.toLowerCase().endsWith(".pdf") ? safeName : `${safeName}.pdf`;
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${finalName}`;
      const outputPath = path.join(uploadsDir, uniqueName);

      await writeFile(outputPath, file.data);
      const fileStat = await stat(outputPath);
      const uploadedAt = fileStat.mtime.toISOString();

      metadata[uniqueName] = {
        projectName,
        uploadedAt,
      };

      return {
        name: uniqueName,
        uploadedAt,
        projectName,
      };
    })
  );

  await writeMetadata(uploadsDir, metadata);
  saved.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  return saved;
}

export async function hasUploadedFile(fileName: string): Promise<boolean> {
  try {
    const filePath = getUploadedFilePath(fileName);
    const fileStat = await stat(filePath);
    return fileStat.isFile() && fileName.toLowerCase().endsWith(".pdf");
  } catch {
    return false;
  }
}

export function createUploadedFileStream(fileName: string) {
  return createReadStream(getUploadedFilePath(fileName));
}
