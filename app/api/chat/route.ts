export const runtime = "nodejs";


import { NextRequest } from "next/server";
import OpenAI from "openai";


const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(buffer);
  return result.text ?? "";
}


export async function GET() {
  return Response.json({ error: "Method not allowed. Use POST." }, { status: 405 });
}


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, pdfUrl } = body ?? {};


    if (!question || !pdfUrl) {
      return Response.json(
        { error: "Missing required fields: question and pdfUrl" },
        { status: 400 }
      );
    }


    const pdfResponse = await fetch(pdfUrl, { cache: "no-store" });
    if (!pdfResponse.ok) {
      return Response.json(
        { error: `Failed to fetch PDF: ${pdfResponse.status} ${pdfResponse.statusText}` },
        { status: 502 }
      );
    }


    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());


    let extractedText: string;
    try {
      extractedText = (await extractTextFromPdf(pdfBuffer)).trim();
    } catch (parseError) {
      console.error("[/api/chat] PDF parse error:", parseError);
      return Response.json(
        { error: "Failed to parse PDF." },
        { status: 422 }
      );
    }


    if (!extractedText) {
      return Response.json(
        { error: "No text could be extracted. The PDF may be image-based." },
        { status: 422 }
      );
    }


    const MAX_CHARS = 48000;
    const documentText =
      extractedText.length > MAX_CHARS
        ? extractedText.slice(0, MAX_CHARS) + "\n\n[Document truncated]"
        : extractedText;


    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content:
            "You are an expert building plan analyst. Answer using ONLY the document text. If not stated, say: Not stated in the plan.",
        },
        {
          role: "user",
          content: `DOCUMENT TEXT:\n\n${documentText}\n\n---\n\nQUESTION: ${question}`,
        },
      ],
    });


    const answer =
      completion.choices[0]?.message?.content?.trim() ?? "Not stated in the plan.";


    return Response.json({ answer });
  } catch (error: unknown) {
    console.error("[/api/chat] Unhandled error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
