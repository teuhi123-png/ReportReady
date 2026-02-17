import type { NextApiRequest, NextApiResponse } from "next";
import { savePdfUploadRequest } from "../../lib/uploadPlans";

type UploadResponse =
  | { ok: true; files: Array<{ name: string; uploadedAt: string; projectName: string; url: string }> }
  | { ok: false; error: string };

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse>
): Promise<void> {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      res.status(405).json({ ok: false, error: "Method not allowed" });
      return;
    }

    const files = await savePdfUploadRequest(req);
    res.status(200).json({ ok: true, files });
  } catch (error) {
    console.error("Upload API error:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    const status = message.includes("Method not allowed") ? 405 : 400;
    res.status(status).json({ ok: false, error: message });
  }
}
