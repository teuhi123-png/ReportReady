import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { listUploadedPlans } from "../../../lib/uploadPlans";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userEmail = searchParams.get("userEmail") ?? undefined;
    const projectName = searchParams.get("projectName") ?? undefined;

    const files = await listUploadedPlans({ userEmail, projectName });

    return NextResponse.json({
      success: true,
      files,
    });
  } catch (error) {
    console.error("UPLOADS ERROR:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch uploads";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { success: false, error: "BLOB_READ_WRITE_TOKEN is required." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const files = formData.getAll("files");

    if (files.length === 0) {
      return NextResponse.json(
        { success: false, error: "No files provided." },
        { status: 400 }
      );
    }

    const uploaded = await Promise.all(
      files.map(async (entry) => {
        if (!(entry instanceof File)) {
          throw new Error("Invalid file payload.");
        }

        const bytes = await entry.arrayBuffer();
        const blob = new Blob([bytes], { type: entry.type || "application/octet-stream" });
        const result = await put(entry.name, blob, { access: "public" });

        return {
          pathname: result.pathname,
          url: result.url,
          size: entry.size,
        };
      })
    );

    return NextResponse.json({ success: true, files: uploaded });
  } catch (error) {
    console.error("UPLOADS POST ERROR:", error);
    const message = error instanceof Error ? error.message : "Failed to upload files";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
