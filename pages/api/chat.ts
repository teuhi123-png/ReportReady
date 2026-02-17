import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

type ChatResponse = {
  reply: string;
  error?: string;
};

type ChatBody = {
  message?: string;
  pdfKey?: string;
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function isSafePdfKey(pdfKey: string): boolean {
  if (!pdfKey.startsWith("uploads/")) return false;
  if (pdfKey.includes("..")) return false;
  return true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ChatResponse>): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ reply: "", error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body as ChatBody;
    const message = String(body?.message ?? "").trim();
    const pdfKey = String(body?.pdfKey ?? "").trim();

    if (!message) {
      res.status(400).json({ reply: "", error: "message is required" });
      return;
    }

    if (!pdfKey) {
      res.status(400).json({ reply: "", error: "pdfKey is required" });
      return;
    }

    if (!isSafePdfKey(pdfKey)) {
      res.status(400).json({ reply: "", error: "Invalid pdfKey path" });
      return;
    }

    const txtPath = path.join(process.cwd(), `${pdfKey}.txt`);
    if (!fs.existsSync(txtPath)) {
      res.status(404).json({
        reply: "",
        error: `Extracted plan text file is missing at ${txtPath}`,
      });
      return;
    }

    const pdfText = fs.readFileSync(txtPath, "utf8").trim();
    if (!pdfText) {
      res.status(400).json({ reply: "", error: "Extracted plan text file is empty" });
      return;
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

    res.status(200).json({
      reply: completion.choices[0]?.message?.content ?? "Not stated in the plan.",
    });
  } catch (error: unknown) {
    res.status(500).json({
      reply: "",
      error: error instanceof Error ? error.message : "Server error",
    });
  }
}
