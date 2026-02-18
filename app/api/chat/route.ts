import { NextRequest } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, pdfUrl } = body;

    if (!pdfUrl) {
      return Response.json(
        {
          error: "No PDF URL provided",
        },
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You analyse building plans and answer questions.",
        },
        {
          role: "user",
          content: `
PDF URL:
${pdfUrl}


Question:
${question}
`,
        },
      ],
    });

    return Response.json({
      answer: completion.choices[0].message.content,
    });
  } catch (err: any) {
    return Response.json(
      {
        error: err.message,
      },
      { status: 500 }
    );
  }
}
