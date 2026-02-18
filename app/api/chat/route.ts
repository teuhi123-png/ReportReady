export const runtime = "nodejs";


import { NextRequest } from "next/server";
import OpenAI from "openai";


const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


async function getPdfParse() {
  // Handles CommonJS/ESM interop variations
  const mod: any = await import("pdf-parse");
  return mod?.default ?? mod;
}


export async function GET() {
  return Response.json({ error: "Use POST" }, { status: 405 });
}


export async function POST(req: NextRequest) {
  try {
    const { question, pdfUrl } = await req.json();


    if (!question || !pdfUrl) {
      return Response.json(
        { error: "Missing required fields: question and pdfUrl" },
        { status: 400 }
      );
    }


    // Fetch PDF bytes
    const pdfResponse = await fetch(pdfUrl, { cache: "no-store" });
    if (!pdfResponse.ok) {
      return Response.json(
        { error: `Failed to fetch PDF: ${pdfResponse.status} ${pdfResponse.statusText}` },
        { status: 500 }
      );
    }


    const pdfArrayBuffer = await pdfResponse.arrayBuffer();
    const pdfBuffer = Buffer.from(pdfArrayBuffer);


    // Parse PDF -> text
    const pdfParse = await getPdfParse();
    const pdfData = await pdfParse(pdfBuffer);
    const extractedText = String(pdfData?.text ?? "").trim();


    if (!extractedText) {
      return Response.json(
        {
          error:
            "Could not extract text from the PDF. It may be scanned/image-based (needs OCR).",
        },
        { status: 422 }
      );
    }


    // Token safety
    const maxChars = 48000;
    const truncatedText =
      extractedText.length > maxChars
        ? extractedText.slice(0, maxChars) + "\n\n[Document truncated]"
        : extractedText;


    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert building plan analyst. Answer ONLY using the document text. If not stated, say 'Not stated in the plan.'",
        },
        {
          role: "user",
          content: `DOCUMENT TEXT:\n\n${truncatedText}\n\n---\n\nQUESTION: ${question}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 700,
    });


    const answer =
      completion.choices[0]?.message?.content?.trim() ?? "Not stated in the plan.";


    return Response.json({ answer });
  } catch (error: unknown) {
    console.error("[/api/chat] Error:", error);
    const message = error instanceof Error ? error.message : "Server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
