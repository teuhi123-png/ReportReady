import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatBody = {
  message?: string;
  pdfUrl?: string;
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ success: false, error: "OPENAI_API_KEY is not configured" }, { status: 500 });
    }

    const body = (await req.json()) as ChatBody;
    const message = String(body.message ?? "").trim();
    const pdfUrl = String(body.pdfUrl ?? "").trim();

    if (!message) {
      return Response.json({ success: false, error: "No message provided" }, { status: 400 });
    }

    if (!pdfUrl) {
      return Response.json({ success: false, error: "No PDF URL provided" }, { status: 400 });
    }

    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      return Response.json(
        { success: false, error: `Failed to fetch PDF (${pdfResponse.status})` },
        { status: 500 }
      );
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    const mod = await import("pdf-parse");
    const pdfParse = (mod as any).default ?? (mod as any);
    const parsed = await pdfParse(pdfBuffer);
    const pdfText = String(parsed?.text ?? "").trim();

    if (!pdfText) {
      return Response.json({ success: false, error: "Could not extract text from PDF" }, { status: 400 });
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
          content: `PDF CONTENT:\n${pdfText}\n\nQUESTION:\n${message}`,
        },
      ],
    });

    return Response.json({
      success: true,
      answer: completion.choices[0]?.message?.content ?? "Not stated in the plan.",
    });
  } catch (error: unknown) {
    console.error("CHAT ERROR:", error);
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
