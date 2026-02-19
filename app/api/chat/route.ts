// app/api/chat/route.ts
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const BUILD_STAMP = "chat-uint8-deploy-check-v1";

type Body = {
  question?: string;
  pdfUrl?: string; // must be a direct, publicly fetchable URL (e.g., Vercel Blob public url)
};

 async function extractTextFromPdf(buffer: Uint8Array): Promise<string>
{
  // Server-safe PDF parser for Vercel
  const { extractText } = await import("unpdf");
  const { text } = await extractText(buffer, { mergePages: true });
  return (text ?? "").trim();
}

export async function GET() {
  return Response.json({ error: "Method not allowed. Use POST." }, { status: 405 });
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "Missing OPENAI_API_KEY on server." },
        { status: 500 }
      );
    }

    const body = (await req.json()) as Body;
    const question = body?.question?.trim();
    const pdfUrl = body?.pdfUrl?.trim();

    if (!question || !pdfUrl) {
      return Response.json(
        { error: "Missing required fields: question and pdfUrl" },
        { status: 400 }
      );
    }

    // Basic URL sanity check
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(pdfUrl);
    } catch {
      return Response.json({ error: "pdfUrl is not a valid URL" }, { status: 400 });
    }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return Response.json({ error: "pdfUrl must be http/https" }, { status: 400 });
    }

    // Fetch PDF bytes
    const pdfResponse = await fetch(pdfUrl, {
      // blob URLs can be cached; no-store avoids weird stale fetches while testing
      cache: "no-store",
    });

    if (!pdfResponse.ok) {
      return Response.json(
        { error: `Failed to fetch PDF (${pdfResponse.status})` },
        { status: 400 }
      );
    }

    const contentType = pdfResponse.headers.get("content-type") || "";
    // Not always reliable, but helps catch wrong URLs
    if (!contentType.toLowerCase().includes("pdf")) {
      // still allow it if it *is* a pdf but served without proper header
      // just proceed; worst case parsing fails and we return a clean error
    }

    const arrayBuffer = await pdfResponse.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // Extract text
    const pdfText = await extractTextFromPdf(uint8);


    if (!pdfText) {
      return Response.json(
        { error: "Could not extract any text from the PDF (might be scanned images)." },
        { status: 422 }
      );
    }

    // Optional safety: cap huge PDFs so you don't blow tokens
    const MAX_CHARS = 120_000; // ~roughly 30k tokens depending on content
    const clippedText = pdfText.length > MAX_CHARS ? pdfText.slice(0, MAX_CHARS) : pdfText;

    const system = `You are a helpful assistant. Answer using ONLY the provided PDF text.
If the PDF does not contain the answer, say you can't find it in the PDF.`;

    const user = `PDF TEXT:
"""
${clippedText}
"""

QUESTION:
${question}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const answer = completion.choices?.[0]?.message?.content?.trim() || "";

    return Response.json({
      answer,
      buildStamp: BUILD_STAMP,
      meta: {
        charsUsed: clippedText.length,
        clipped: pdfText.length > MAX_CHARS,
      },
    });
  } catch (err: any) {
    // Keep the error message simple but useful
    const message =
      typeof err?.message === "string" ? err.message : "Unexpected server error";
    return Response.json({ error: message, buildStamp: BUILD_STAMP }, { status: 500 });
  }
}
