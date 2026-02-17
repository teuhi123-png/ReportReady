import { NextRequest } from "next/server";
import { put, list } from "@vercel/blob";

export const runtime = "nodejs"; // important for blob + formData
export const dynamic = "force-dynamic";

function safeName(name: string) {
  // basic cleanup to avoid weird paths
  return name.replace(/[^\w.\-() ]+/g, "_");
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const userEmail = String(formData.get("userEmail") || "");
    const projectName = String(formData.get("projectName") || "");

    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return Response.json({ success: false, error: "No files provided" }, { status: 400 });
    }

    // Upload all PDFs
    const uploaded = await Promise.all(
      files.map(async (file) => {
        if (!(file instanceof File)) {
          throw new Error("Invalid file in FormData");
        }

        if (file.type !== "application/pdf") {
          throw new Error(`Only PDFs allowed. Got: ${file.type || "unknown"}`);
        }

        // optional: force reading to ensure it's real
        await file.arrayBuffer();

        const filename = safeName(file.name);
        const keyParts = [
          "uploads",
          userEmail || "anonymous",
          projectName ? safeName(projectName) : "no-project",
          `${Date.now()}-${filename}`,
        ];
        const pathname = keyParts.join("/");

        const blob = await put(pathname, file, { access: "public" });

        return {
          url: blob.url,
          pathname: blob.pathname,
          size: file.size,
          name: file.name,
          type: file.type,
        };
      })
    );

    return Response.json({ success: true, uploaded });
  } catch (err: any) {
    console.error("UPLOAD ERROR:", err);
    return Response.json({ success: false, error: err?.message || "Upload failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userEmail = searchParams.get("userEmail") || "anonymous";

    // list only this user's folder
    const prefix = `uploads/${userEmail}/`;

    const results = await list({ prefix, limit: 100 });

    // return newest first
    const files = (results.blobs || [])
      .map((b) => {
        const parts = b.pathname.split("/");
        const filename = parts[parts.length - 1] ?? b.pathname;
        const projectName = parts[2] && parts[2] !== "no-project" ? parts[2] : "Untitled Project";

        return {
          name: filename.replace(/^\d+-/, ""),
          projectName,
          url: b.url,
          pathname: b.pathname,
          size: b.size,
          uploadedAt: b.uploadedAt,
        };
      })
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    return Response.json({ success: true, files });
  } catch (err: any) {
    console.error("LIST ERROR:", err);
    return Response.json({ success: false, error: err?.message || "List failed" }, { status: 500 });
  }
}
