import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import pdf from "pdf-parse";

type ChatBody = {
  message?: string;
  pdfUrl?: string;
};

type ChatResponse = {
  success: boolean;
  answer?: string;
  error?: string;
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse<ChatResponse>): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({ success: false, error: "OPENAI_API_KEY is not configured" });
      return;
    }

    const body = req.body as ChatBody;
    const message = String(body?.message ?? "").trim();
    const pdfUrl = String(body?.pdfUrl ?? "").trim();

    if (!message) {
      res.status(400).json({ success: false, error: "No message provided" });
      return;
    }

    if (!pdfUrl) {
      res.status(400).json({ success: false, error: "No PDF URL provided" });
      return;
    }

    const dataBuffer = await fetch(pdfUrl).then((response) => response.arrayBuffer());
    const parsed = await (pdf as any)(Buffer.from(dataBuffer));
    const text = String(parsed?.text ?? "").trim();

    if (!text) {
      res.status(400).json({ success: false, error: "Could not extract text from PDF" });
      return;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a building plan assistant. Answer using the PDF content.",
        },
        {
          role: "user",
          content: `PDF CONTENT:\n${text}\n\nQUESTION:\n${message}`,
        },
      ],
    });

    res.status(200).json({
      success: true,
      answer: completion.choices[0]?.message?.content ?? "Not stated in the plan.",
    });
  } catch (error: unknown) {
    console.error("CHAT ERROR:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
}
