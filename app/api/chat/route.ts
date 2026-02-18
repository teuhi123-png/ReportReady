import { NextRequest } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { question, pdfUrl } = body;

    if (!pdfUrl) {
      return Response.json(
        {
          error: "Missing pdfUrl",
        },
        { status: 400 }
      );
    }

    const res = await fetch(pdfUrl);

    const buffer = Buffer.from(await res.arrayBuffer());

    const mod = await import("pdf-parse");
    const pdf = (mod as any).default ?? (mod as any);
    const data = await pdf(buffer);

    const pdfText = data.text;

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",

      messages: [
        {
          role: "system",
          content: "You are a construction plan analysis AI.",
        },

        {
          role: "user",
          content: `
BUILDING PLAN TEXT:


${pdfText}


QUESTION:


${question}
          `,
        },
      ],
    });

    return Response.json({
      answer: completion.choices[0].message.content,
    });
  } catch (e: any) {
    return Response.json(
      {
        error: e.message,
      },
      { status: 500 }
    );
  }
}
