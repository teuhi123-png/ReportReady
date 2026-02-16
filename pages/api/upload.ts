import type { NextApiRequest, NextApiResponse } from "next";
import { savePdfUploadRequest } from "../../lib/uploadPlans";

type UploadResponse =
  | { ok: true; files: Array<{ name: string; uploadedAt: string; projectName: string }> }
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
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const files = await savePdfUploadRequest(req);
    res.status(200).json({ ok: true, files });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    res.status(400).json({ ok: false, error: message });
  }
}
