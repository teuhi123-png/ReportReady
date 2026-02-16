import fs from "fs";
import { readdir, readFile } from "fs/promises";
import path from "path";
import type { NextApiRequest, NextApiResponse } from "next";
import { PDFParse } from "pdf-parse";
import OpenAI from "openai";

type ChatResponse = { answer: string } | { error: string };

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

    const uploadsDir = path.join(process.cwd(), "uploads");
    console.log("uploadsDir", uploadsDir);
    console.log("uploads exists", fs.existsSync(uploadsDir));

    let entries: Array<import("fs").Dirent> = [];
    try {
      entries = await readdir(uploadsDir, { withFileTypes: true });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        throw error;
      }
    }

    const files = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))
      .map((entry) => entry.name);
    console.log("pdf files", files);

    if (files.length === 0) {
      res.status(400).json({ error: "No uploaded PDFs found in /uploads" });
      return;
    }

    const chunks = await Promise.all(
      files.map(async (fileName) => {
        const fullPath = path.join(uploadsDir, fileName);
        const buffer = await readFile(fullPath);
        const parser = new PDFParse({ data: buffer });
        const parsed = await parser.getText();
        await parser.destroy();
        return `File: ${fileName}\n${parsed.text.trim()}`;
      })
    );

    const pdfText = chunks.join("\n\n---\n\n");
    const context = pdfText.slice(0, 120000);
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "You are a construction plan assistant. Use only the provided plan text.",
        },
        {
          role: "user",
          content: `Plan text:\n${context}\n\nQuestion: ${question}`,
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
