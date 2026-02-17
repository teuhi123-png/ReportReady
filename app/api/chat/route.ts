import OpenAI from "openai";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";

type ChatBody = {
  question?: string;
  pdfUrl?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatBody;
    const question = (body.question ?? "").trim();
    const pdfUrl = (body.pdfUrl ?? "").trim();

    if (!question) {
      return Response.json({ success: false, error: "question is required" }, { status: 400 });
    }

    if (!pdfUrl) {
      return Response.json({ success: false, error: "pdfUrl is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { success: false, error: "OPENAI_API_KEY is missing in server environment" },
        { status: 500 }
      );
    }

    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      return Response.json(
        { success: false, error: `Failed to fetch PDF (${pdfResponse.status})` },
        { status: 400 }
      );
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

    const parser = new PDFParse({ data: pdfBuffer });
    let pdfText = "";
    try {
      const parsed = await parser.getText();
      pdfText = (parsed.text ?? "").trim();
    } finally {
      await parser.destroy();
    }

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Answer questions using the site plan text.",
        },
        {
          role: "user",
          content: `
Site plan:
${pdfText}

Question:
${question}
`,
        },
      ],
    });

    return Response.json({
      success: true,
      answer: completion.choices[0]?.message?.content ?? "",
    });
  } catch (error) {
    console.error("CHAT ERROR:", error);
    const message = error instanceof Error ? error.message : "Failed to process request";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
