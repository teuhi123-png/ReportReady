export const runtime = "nodejs";


import { NextRequest } from "next/server";
import OpenAI from "openai";


const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


async function extractTextFromPdf(buffer: Uint8Array): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.js");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "";
  const loadingTask = pdfjsLib.getDocument({
    data: buffer,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  const pages = await Promise.all(
    Array.from({ length: pdf.numPages }, async (_, i) => {
      const page = await pdf.getPage(i + 1);
      const content = await page.getTextContent();
      return content.items.map((item: any) => ("str" in item ? item.str : "")).join(" ");
    })
  );
  return pages.join("\n");
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


    // Fetch PDF from Vercel Blob
    const pdfResponse = await fetch(pdfUrl, { cache: "no-store" });
    if (!pdfResponse.ok) {
      return Response.json(
        {
          error: `Failed to fetch PDF: ${pdfResponse.status} ${pdfResponse.statusText}`,
        },
        { status: 502 }
      );
    }


    const pdfArrayBuffer = await pdfResponse.arrayBuffer();
    const pdfBuffer = new Uint8Array(pdfArrayBuffer);


    // Extract text
    let extractedText: string;
    try {
      extractedText = (await extractTextFromPdf(pdfBuffer)).trim();
    } catch (parseError) {
      console.error("[/api/chat] PDF parse error:", parseError);
      return Response.json(
        { error: "Failed to parse PDF. The file may be corrupted or password-protected." },
        { status: 422 }
      );
    }


    if (!extractedText) {
      return Response.json(
        {
          error:
            "No text could be extracted. The PDF may be scanned/image-based and requires OCR.",
        },
        { status: 422 }
      );
    }


    // Truncate to stay within token limits (~48k chars ≈ ~12k tokens)
    const MAX_CHARS = 48_000;
    const documentText =
      extractedText.length > MAX_CHARS
        ? extractedText.slice(0, MAX_CHARS) + "\n\n[Document truncated due to length]"
        : extractedText;


    // Send to OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content:
            "You are an expert building plan analyst. Answer questions using ONLY the document text provided. If the answer is not in the document, respond with: 'Not stated in the plan.'",
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
