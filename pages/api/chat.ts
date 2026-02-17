import type { NextApiRequest, NextApiResponse } from "next";
import { PDFParse } from "pdf-parse";
import OpenAI from "openai";
import { listUploadedPlans } from "../../lib/uploadPlans";

type ChatResponse =
  | { ok: true; answer: string }
  | { ok: false; error: string };

type Chunk = {
  id: string;
  fileName: string;
  projectName: string;
  page: number;
  text: string;
};

const NO_DOCUMENTS_ANSWER = "No documents uploaded yet.";

function splitIntoPages(text: string): string[] {
  const pages = text
    .split("\f")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return pages.length > 0 ? pages : [text.trim()];
}

function chunkPageText(fileName: string, projectName: string, page: number, text: string): Chunk[] {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return [];

  const size = 1000;
  const overlap = 180;
  const chunks: Chunk[] = [];
  let start = 0;
  let idx = 0;
  while (start < compact.length) {
    const end = Math.min(compact.length, start + size);
    const slice = compact.slice(start, end);
    chunks.push({
      id: `${fileName}-p${page}-c${idx}`,
      fileName,
      projectName,
      page,
      text: slice,
    });
    idx += 1;
    if (end >= compact.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function sendJson(res: NextApiResponse<ChatResponse>, status: number, payload: ChatResponse): void {
  if (res.headersSent) return;
  res.status(status).json(payload);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatResponse>
): Promise<void> {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      sendJson(res, 405, { ok: false, error: "Method not allowed" });
      return;
    }

    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    if (!question) {
      sendJson(res, 400, { ok: false, error: "Question is required" });
      return;
    }

    if (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN) {
      sendJson(res, 500, { ok: false, error: "BLOB_READ_WRITE_TOKEN is required in production." });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      sendJson(res, 500, { ok: false, error: "OPENAI_API_KEY is missing in server environment." });
      return;
    }

    const uploads = await listUploadedPlans();
    if (uploads.length === 0) {
      sendJson(res, 200, { ok: true, answer: NO_DOCUMENTS_ANSWER });
      return;
    }

    const chunks: Chunk[] = [];
    for (const file of uploads) {
      try {
        const response = await fetch(file.url);
        if (!response.ok) {
          console.error(`Failed fetching PDF blob for ${file.name}: ${response.status}`);
          continue;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const parser = new PDFParse({ data: buffer });

        try {
          const parsed = await parser.getText();
          const pages = splitIntoPages(parsed.text ?? "");
          pages.forEach((pageText, idx) => {
            chunks.push(...chunkPageText(file.name, file.projectName, idx + 1, pageText));
          });
        } finally {
          await parser.destroy();
        }
      } catch (fileError) {
        console.error(`Failed processing PDF ${file.name}:`, fileError);
      }
    }

    if (chunks.length === 0) {
      sendJson(res, 200, { ok: true, answer: "No readable text found in uploaded documents." });
      return;
    }

    const client = new OpenAI({ apiKey });
    const embeddingInputs = [question, ...chunks.map((chunk) => chunk.text)];
    const embeddingResponse = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: embeddingInputs,
    });

    const questionVector = embeddingResponse.data[0]?.embedding ?? [];
    const ranked = chunks
      .map((chunk, idx) => ({
        chunk,
        score: cosineSimilarity(questionVector, embeddingResponse.data[idx + 1]?.embedding ?? []),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    const context = ranked
      .map(
        ({ chunk }) =>
          `[source: ${chunk.fileName} | project: ${chunk.projectName} | page: ${chunk.page}]\n${chunk.text}`
      )
      .join("\n\n");

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a construction plan assistant. Use only the provided plan text. Format with short bullets and bold key values. For every factual item, cite source filename and page like (source: file.pdf p.3). If unknown, say you cannot find it in the provided text.",
        },
        {
          role: "user",
          content: `Question: ${question}\n\nRetrieved plan text:\n${context}`,
        },
      ],
    });

    const answer = completion.choices?.[0]?.message?.content?.trim() ?? "No answer returned.";
    sendJson(res, 200, { ok: true, answer });
  } catch (err: unknown) {
    console.error("Chat API error:", err);
    const message = err instanceof Error ? err.message : "Unexpected server error";
    sendJson(res, 500, { ok: false, error: message });
  }
}
