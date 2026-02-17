import type { NextApiRequest, NextApiResponse } from "next";
import { listUploadedPlans } from "../../lib/uploadPlans";

type UploadsResponse =
  | { files: Array<{ name: string; uploadedAt: string; projectName: string; url: string }> }
  | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadsResponse>
): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const files = await listUploadedPlans();
    res.status(200).json({ files });
  } catch {
    res.status(500).json({ error: "Failed to read uploads directory" });
  }
}
