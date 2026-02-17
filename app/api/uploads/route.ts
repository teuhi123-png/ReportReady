import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await list();
    return NextResponse.json({
      success: true,
      blobs: result.blobs.map((blob) => ({
        pathname: blob.pathname,
        url: blob.url,
        size: blob.size,
      })),
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
