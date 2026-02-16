import type { NextApiRequest, NextApiResponse } from "next";
import { createUploadedFileStream, hasUploadedFile } from "../../../lib/uploadPlans";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const nameParam = req.query.name;
  const fileName = typeof nameParam === "string" ? nameParam : "";
  if (!fileName) {
    res.status(400).json({ error: "Missing file name" });
    return;
  }

  if (!(await hasUploadedFile(fileName))) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
  const stream = createUploadedFileStream(fileName);
  stream.on("error", () => {
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to stream file" });
    } else {
      res.end();
    }
  });
  stream.pipe(res);
}
