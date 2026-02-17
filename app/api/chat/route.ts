import OpenAI from "openai";
import { list } from "@vercel/blob";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ChatRequestBody = {
  message?: string;
  pdfKey?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatRequestBody;
    const message = (body.message ?? "").trim();
    const pdfKey = (body.pdfKey ?? "").trim();

    if (!message) {
      return Response.json({ reply: "", error: "message is required" }, { status: 400 });
    }

    if (!pdfKey) {
      return Response.json({ reply: "", error: "pdfKey is required" }, { status: 400 });
    }

    const txtKey = `${pdfKey}.txt`;
    const { blobs } = await list({ prefix: txtKey, limit: 5 });
    const txtBlob = blobs.find((blob) => blob.pathname === txtKey);

    if (!txtBlob) {
      return Response.json({ reply: "", error: "Plan text not found for selected PDF" }, { status: 404 });
    }

    const txtResponse = await fetch(txtBlob.url);
    if (!txtResponse.ok) {
      return Response.json({ reply: "", error: "Failed to load plan text" }, { status: 500 });
    }

    const pdfText = (await txtResponse.text()).trim();
    if (!pdfText) {
      return Response.json({ reply: "", error: "Selected plan has no extracted text" }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Answer ONLY from plan text. If missing, say 'Not stated in the plan.'",
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
      reply: completion.choices[0]?.message?.content ?? "Not stated in the plan.",
    });
  } catch (error: unknown) {
    console.error("CHAT ERROR:", error);
    return Response.json(
      { reply: "", error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
