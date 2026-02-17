import OpenAI from "openai";
import { list } from "@vercel/blob";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { message, pdfUrl } = await req.json();


    if (!message) {
      return Response.json(
        { success: false, error: "No message provided" },
        { status: 400 }
      );
    }

    let selectedPdfUrl = String(pdfUrl ?? "").trim();

    if (!selectedPdfUrl) {
      const { blobs } = await list({ limit: 100 });
      const latest = [...blobs].sort(
        (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      )[0];
      selectedPdfUrl = latest?.url ?? "";
    }

    if (!selectedPdfUrl) {
      return Response.json(
        { success: false, error: "No uploaded PDF found" },
        { status: 400 }
      );
    }

    const pdfResponse = await fetch(selectedPdfUrl);
    if (!pdfResponse.ok) {
      return Response.json(
        { success: false, error: `Failed to fetch selected PDF (${pdfResponse.status})` },
        { status: 400 }
      );
    }

    const parser = new PDFParse({ data: Buffer.from(await pdfResponse.arrayBuffer()) });
    let pdfText = "";
    try {
      const parsed = await parser.getText();
      pdfText = (parsed.text ?? "").trim();
    } finally {
      await parser.destroy();
    }

    if (!pdfText) {
      return Response.json(
        { success: false, error: "Selected PDF has no readable text" },
        { status: 400 }
      );
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a building plan assistant. Answer ONLY using the provided plan.",
        },
        {
          role: "system",
          content: pdfText,
        },
        {
          role: "user",
          content: message,
        },
      ],
    });


    return Response.json({
      reply: completion.choices[0]?.message?.content ?? "",
    });
  } catch (error: unknown) {
    console.error("CHAT ERROR:", error);
    return Response.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
