import fs from "fs";
import { readFile } from "fs/promises";
import path from "path";
import type { NextApiRequest, NextApiResponse } from "next";
import { PDFParse } from "pdf-parse";
import OpenAI from "openai";
import { getUploadedFileUrl, getUploadsDir, listUploadedPlans } from "../../lib/uploadPlans";

type ChatResponse = { answer: string } | { error: string };

type Chunk = {
  id: string;
  fileName: string;
  projectName: string;
  page: number;
  text: string;
};

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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatResponse>
): Promise<void> {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    if (!question) {
      res.status(400).json({ error: "Question is required" });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "OPENAI_API_KEY missing" });
      return;
    }

    const uploadsDir = getUploadsDir();
    console.log("uploadsDir", uploadsDir);
    console.log("uploads exists", fs.existsSync(uploadsDir));

    const uploads = await listUploadedPlans();
    const files = uploads.map((entry) => entry.name);
    console.log("pdf files", files);
    if (uploads.length === 0) {
      res.status(400).json({ error: "No uploaded PDFs found in /uploads" });
      return;
    }

    const chunks: Chunk[] = [];
    for (const file of uploads) {
      const blobUrl = await getUploadedFileUrl(file.name);
      const buffer = blobUrl
        ? Buffer.from(await (await fetch(blobUrl)).arrayBuffer())
        : await readFile(path.join(uploadsDir, file.name));
      const parser = new PDFParse({ data: buffer });
      const parsed = await parser.getText();
      await parser.destroy();
      const pages = splitIntoPages(parsed.text ?? "");
      pages.forEach((pageText, idx) => {
        chunks.push(...chunkPageText(file.name, file.projectName, idx + 1, pageText));
      });
    }

    if (chunks.length === 0) {
      res.status(400).json({ error: "Uploaded PDFs did not contain readable text." });
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
    res.status(200).json({ answer });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: String((err as { message?: string })?.message || err) });
  }
}
