import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { list } from "@vercel/blob";

type ChatResponse = {
  answer: string;
  error?: string;
};

type ChatBody = {
  message?: string;
  pdfFileName?: string;
  userEmail?: string;
};

type PlanTextStore = Record<string, Record<string, string>>;
type PlanSelectionStore = Record<string, string>;

declare global {
  // eslint-disable-next-line no-var
  var __PLAN_TEXT_STORE__: PlanTextStore | undefined;
  // eslint-disable-next-line no-var
  var __PLAN_SELECTION_STORE__: PlanSelectionStore | undefined;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function safePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._@-]/g, "_");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ChatResponse>): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ answer: "", error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body as ChatBody;
    const message = String(body?.message ?? "").trim();
    const safeEmail = safePathSegment(String(body?.userEmail ?? "anonymous").trim() || "anonymous");
    const requestedPdfName = String(body?.pdfFileName ?? "").trim();
    const safeRequestedPdfName = requestedPdfName ? safePathSegment(requestedPdfName) : "";

    if (!message) {
      res.status(400).json({ answer: "", error: "message is required" });
      return;
    }

    const selectedPdfName =
      safeRequestedPdfName || globalThis.__PLAN_SELECTION_STORE__?.[safeEmail] || "";

    if (!selectedPdfName) {
      res.status(400).json({
        answer: "",
        error: "No PDF selected. Choose a PDF first.",
      });
      return;
    }

    let planText = globalThis.__PLAN_TEXT_STORE__?.[safeEmail]?.[selectedPdfName];

    if (!planText) {
      const prefix = `uploads/${safeEmail}/`;

      const { blobs } = await list({ prefix });

      const txtName = `${selectedPdfName}.txt`;

      const txtBlob = blobs.find(
        (b) => b.pathname === `${prefix}${txtName}`
      );

      if (!txtBlob) {
        res.status(400).json({
          answer: "",
          error: `Missing extracted text in Blob: ${prefix}${txtName}`,
        });
        return;
      }

      const txtRes = await fetch(txtBlob.url);

      if (!txtRes.ok) {
        res.status(500).json({
          answer: "",
          error: `Failed to fetch plan text (${txtRes.status})`,
        });
        return;
      }

      planText = (await txtRes.text()).trim();

      globalThis.__PLAN_TEXT_STORE__ = globalThis.__PLAN_TEXT_STORE__ || {};
      globalThis.__PLAN_TEXT_STORE__[safeEmail] =
        globalThis.__PLAN_TEXT_STORE__[safeEmail] || {};

      globalThis.__PLAN_TEXT_STORE__[safeEmail][selectedPdfName] = planText;
    }

    globalThis.__PLAN_SELECTION_STORE__ = globalThis.__PLAN_SELECTION_STORE__ || {};
    globalThis.__PLAN_SELECTION_STORE__[safeEmail] = selectedPdfName;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Answer ONLY from plan text. If missing, say 'Not stated in the plan.'",
        },
        {
          role: "system",
          content: planText,
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    res.status(200).json({
      answer: completion.choices[0]?.message?.content ?? "Not stated in the plan.",
    });
  } catch (error: unknown) {
    res.status(500).json({
      answer: "",
      error: error instanceof Error ? error.message : "Server error",
    });
  }
}
