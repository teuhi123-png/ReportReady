import { put } from "@vercel/blob";

export const runtime = "nodejs";

type UploadedFile = {
  name: string;
  url: string;
  size: number;
  pathname: string;
};

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const entries = formData.getAll("files");

    if (!entries.length) {
      return Response.json({ success: false, error: "No files received" }, { status: 400 });
    }

    const uploadedFiles: UploadedFile[] = [];

    for (const entry of entries) {
      if (!(entry instanceof File)) {
        return Response.json({ success: false, error: "Invalid file payload" }, { status: 400 });
      }

      const blob = await put(entry.name, entry, { access: "public" });

      uploadedFiles.push({
        name: entry.name,
        url: blob.url,
        size: entry.size,
        pathname: blob.pathname,
      });
    }

    return Response.json({ success: true, files: uploadedFiles });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload failed";
    console.error("UPLOAD ERROR:", error);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
