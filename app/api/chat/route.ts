import OpenAI from "openai";
import { getUploadedPlanByNameOrLatest } from "../../../lib/uploadPlans";

export const runtime = "nodejs";

type ChatSuccess = { answer: string };
type ChatError = { error: string };

type RankedChunk = {
  text: string;
  score: number;
};

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function chunkText(input: string, size = 1000): string[] {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  for (let i = 0; i < normalized.length; i += size) {
    chunks.push(normalized.slice(i, i + size));
  }
  return chunks;
}

function keywordOverlapScore(questionTokens: Set<string>, chunk: string): number {
  const chunkTokens = new Set(tokenize(chunk));
  if (chunkTokens.size === 0 || questionTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of questionTokens) {
    if (chunkTokens.has(token)) overlap += 1;
  }

  return overlap / questionTokens.size;
}

function topRelevantChunks(question: string, extractedText: string): string[] {
  const chunks = chunkText(extractedText, 1000);
  const questionTokens = new Set(tokenize(question));

  const ranked: RankedChunk[] = chunks.map((chunk) => ({
    text: chunk,
    score: keywordOverlapScore(questionTokens, chunk),
  }));

  return ranked
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.text);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      question?: string;
      pdfId?: string | null;
    };

    const question = (body.question ?? "").trim();
    const pdfId = typeof body.pdfId === "string" ? body.pdfId.trim() : "";

    if (!question) {
      return Response.json({ error: "Question is required." } satisfies ChatError, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "OPENAI_API_KEY is missing in server environment." } satisfies ChatError, {
        status: 500,
      });
    }

    if (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN) {
      return Response.json({ error: "BLOB_READ_WRITE_TOKEN is required in production." } satisfies ChatError, {
        status: 500,
      });
    }

    const latestPlan = await getUploadedPlanByNameOrLatest(pdfId || undefined);
    if (!latestPlan) {
      return Response.json({ answer: "No documents uploaded yet." } satisfies ChatSuccess);
    }

    const relevantChunks = topRelevantChunks(question, latestPlan.extractedText);
    if (relevantChunks.length === 0) {
      return Response.json({ answer: "I can't find it in the uploaded plans." } satisfies ChatSuccess);
    }

    const context = relevantChunks
      .map((chunk, index) => `[chunk ${index + 1}]\n${chunk}`)
      .join("\n\n");

    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            "Answer ONLY from context. If not found, say you can't find it in the uploaded plans.",
        },
        {
          role: "user",
          content: `Selected file: ${latestPlan.name}\nQuestion: ${question}\n\nContext:\n${context}`,
        },
      ],
    });

    const answer = completion.choices?.[0]?.message?.content?.trim() || "I can't find it in the uploaded plans.";
    return Response.json({ answer } satisfies ChatSuccess);
  } catch (error) {
    console.error("Chat route error:", error);
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return Response.json({ error: message } satisfies ChatError, { status: 500 });
  }
}
