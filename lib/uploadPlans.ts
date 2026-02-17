import type { IncomingMessage } from "http";
import { createReadStream } from "fs";
import { mkdir, readdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";
import { head, list, put } from "@vercel/blob";
import { PDFParse } from "pdf-parse";

export type UploadedPlan = {
  name: string;
  pathname: string;
  uploadedAt: string;
  projectName: string;
  url: string;
};

export type UploadedPlanRecord = UploadedPlan & {
  userEmail: string;
  extractedText: string;
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
  name?: string;
  pathname?: string;
  projectName: string;
  uploadedAt: string;
  url?: string;
  userEmail?: string;
  extractedText?: string;
};

type UploadMetadata = Record<string, UploadMetadataEntry>;

type UploadListFilters = {
  userEmail?: string;
  projectName?: string;
};

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const METADATA_FILE = "metadata.json";
const BLOB_UPLOAD_PREFIX = "uploads";
const BLOB_META_PREFIX = `${BLOB_UPLOAD_PREFIX}/meta`;

function usesBlobStorage(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function assertBlobConfigured(): void {
  if (!usesBlobStorage()) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required for uploads.");
  }
}

export function getUploadsDir(): string {
  if (process.env.VERCEL) return "/tmp/uploads";
  return path.join(process.cwd(), "uploads");
}

function getMetadataPath(uploadsDir: string): string {
  return path.join(uploadsDir, METADATA_FILE);
}

function getBlobPdfPath(fileName: string): string {
  return `${BLOB_UPLOAD_PREFIX}/${path.basename(fileName)}`;
}

function getBlobMetaPath(fileName: string): string {
  return `${BLOB_META_PREFIX}/${path.basename(fileName)}.json`;
}

function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[^\w.\- ]+/g, "_").trim();
  return base.length > 0 ? base : "upload.pdf";
}

function sanitizeProjectName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized.slice(0, 120) : "Untitled Project";
}

function sanitizeUserEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized.slice(0, 254) : "";
}

function isPdfFile(contentType: string, filename: string): boolean {
  const normalizedType = contentType.toLowerCase();
  const normalizedName = filename.toLowerCase();
  return normalizedType === "application/pdf" || normalizedName.endsWith(".pdf");
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    return (parsed.text ?? "").replace(/\s+/g, " ").trim();
  } finally {
    await parser.destroy();
  }
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

async function readBlobMetadata(fileName: string): Promise<UploadMetadataEntry | null> {
  const metaPath = getBlobMetaPath(fileName);
  try {
    const info = await head(metaPath);
    const response = await fetch(info.url);
    if (!response.ok) return null;
    const parsed = (await response.json()) as UploadMetadataEntry;
    return parsed;
  } catch {
    return null;
  }
}

function matchesFilters(record: UploadedPlanRecord, filters?: UploadListFilters): boolean {
  if (!filters) return true;

  if (filters.userEmail && record.userEmail !== sanitizeUserEmail(filters.userEmail)) {
    return false;
  }

  if (filters.projectName && record.projectName !== sanitizeProjectName(filters.projectName)) {
    return false;
  }

  return true;
}

async function listUploadedPlanRecords(filters?: UploadListFilters): Promise<UploadedPlanRecord[]> {
  assertBlobConfigured();

  if (usesBlobStorage()) {
    const listed = await list({ prefix: `${BLOB_UPLOAD_PREFIX}/` });
    const pdfBlobs = listed.blobs.filter(
      (blob) => blob.pathname.startsWith(`${BLOB_UPLOAD_PREFIX}/`) && blob.pathname.endsWith(".pdf")
    );

    const records = await Promise.all(
      pdfBlobs.map(async (blob) => {
        const fileName = path.basename(blob.pathname);
        const meta = await readBlobMetadata(fileName);

        const record: UploadedPlanRecord = {
          name: fileName,
          pathname: meta?.pathname ?? blob.pathname,
          uploadedAt: meta?.uploadedAt ?? blob.uploadedAt.toISOString(),
          projectName: meta?.projectName ?? "Untitled Project",
          url: meta?.url ?? blob.url,
          userEmail: sanitizeUserEmail(meta?.userEmail ?? ""),
          extractedText: meta?.extractedText ?? "",
        };

        return record;
      })
    );

    return records
      .filter((record) => matchesFilters(record, filters))
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }

  const uploadsDir = await ensureUploadsDir();
  const metadata = await readMetadata(uploadsDir);
  const entries = await readdir(uploadsDir, { withFileTypes: true });
  const pdfEntries = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"));

  const records = await Promise.all(
    pdfEntries.map(async (entry) => {
      const filePath = path.join(uploadsDir, entry.name);
      const fileStat = await stat(filePath);
      const meta = metadata[entry.name];

      return {
        name: entry.name,
        pathname: meta?.pathname ?? entry.name,
        uploadedAt: meta?.uploadedAt ?? fileStat.mtime.toISOString(),
        projectName: meta?.projectName ?? "Untitled Project",
        url: meta?.url ?? `/api/uploads/${encodeURIComponent(entry.name)}`,
        userEmail: sanitizeUserEmail(meta?.userEmail ?? ""),
        extractedText: meta?.extractedText ?? "",
      } as UploadedPlanRecord;
    })
  );

  return records
    .filter((record) => matchesFilters(record, filters))
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}

export async function listUploadedPlans(filters?: UploadListFilters): Promise<UploadedPlan[]> {
  const records = await listUploadedPlanRecords(filters);
  return records.map(({ name, pathname, uploadedAt, projectName, url }) => ({
    name,
    pathname,
    uploadedAt,
    projectName,
    url,
  }));
}

export async function getLatestUploadedPlanForUser(
  userEmail: string,
  projectName?: string
): Promise<UploadedPlanRecord | null> {
  const normalizedEmail = sanitizeUserEmail(userEmail);
  if (!normalizedEmail) return null;

  const records = await listUploadedPlanRecords({ userEmail: normalizedEmail, projectName });
  return records[0] ?? null;
}

export async function getUploadedPlanByNameOrLatest(planName?: string): Promise<UploadedPlanRecord | null> {
  const records = await listUploadedPlanRecords();
  if (records.length === 0) return null;

  if (planName) {
    const found = records.find((record) => record.name === planName);
    if (found) return found;
  }

  return records[0] ?? null;
}

export async function savePdfUploadRequest(req: IncomingMessage): Promise<UploadedPlan[]> {
  assertBlobConfigured();

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

  const projectName = sanitizeProjectName(parsed.fields.projectName ?? "");
  const userEmail = sanitizeUserEmail(parsed.fields.userEmail ?? "");
  if (!userEmail) {
    throw new Error("User email is required for uploads");
  }

  if (usesBlobStorage()) {
    const saved = await Promise.all(
      parsed.files.map(async (file) => {
        const safeName = sanitizeFilename(file.filename);
        const finalName = safeName.toLowerCase().endsWith(".pdf") ? safeName : `${safeName}.pdf`;
        const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${finalName}`;
        const uploadedAt = new Date().toISOString();
        const extractedText = await extractPdfText(file.data);

        const pathname = getBlobPdfPath(uniqueName);
        const uploaded = await put(pathname, file.data, {
          access: "public",
          addRandomSuffix: false,
          contentType: "application/pdf",
        });
        const url = uploaded.url;

        await put(
          getBlobMetaPath(uniqueName),
          JSON.stringify(
            {
              name: uniqueName,
              pathname,
              projectName,
              uploadedAt,
              url,
              userEmail,
              extractedText,
            } satisfies UploadMetadataEntry
          ),
          {
            access: "public",
            addRandomSuffix: false,
            contentType: "application/json",
          }
        );

        return {
          name: uniqueName,
          pathname,
          uploadedAt,
          projectName,
          url,
        };
      })
    );

    saved.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    return saved;
  }

  const uploadsDir = await ensureUploadsDir();
  const metadata = await readMetadata(uploadsDir);

  const saved = await Promise.all(
    parsed.files.map(async (file) => {
      const safeName = sanitizeFilename(file.filename);
      const finalName = safeName.toLowerCase().endsWith(".pdf") ? safeName : `${safeName}.pdf`;
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${finalName}`;
      const outputPath = path.join(uploadsDir, uniqueName);
      const extractedText = await extractPdfText(file.data);

      await writeFile(outputPath, file.data);
      const fileStat = await stat(outputPath);
      const uploadedAt = fileStat.mtime.toISOString();

      metadata[uniqueName] = {
        name: uniqueName,
        pathname: uniqueName,
        projectName,
        uploadedAt,
        url: `/api/uploads/${encodeURIComponent(uniqueName)}`,
        userEmail,
        extractedText,
      };

      return {
        name: uniqueName,
        pathname: uniqueName,
        uploadedAt,
        projectName,
        url: `/api/uploads/${encodeURIComponent(uniqueName)}`,
      };
    })
  );

  await writeMetadata(uploadsDir, metadata);
  saved.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  return saved;
}

export async function hasUploadedFile(fileName: string): Promise<boolean> {
  assertBlobConfigured();

  if (usesBlobStorage()) {
    try {
      await head(getBlobPdfPath(fileName));
      return true;
    } catch {
      return false;
    }
  }

  try {
    const filePath = getUploadedFilePath(fileName);
    const fileStat = await stat(filePath);
    return fileStat.isFile() && fileName.toLowerCase().endsWith(".pdf");
  } catch {
    return false;
  }
}

export async function getUploadedFileUrl(fileName: string): Promise<string | null> {
  assertBlobConfigured();

  if (usesBlobStorage()) {
    try {
      const info = await head(getBlobPdfPath(fileName));
      return info.url;
    } catch {
      return null;
    }
  }

  return null;
}

export function createUploadedFileStream(fileName: string) {
  return createReadStream(getUploadedFilePath(fileName));
}
