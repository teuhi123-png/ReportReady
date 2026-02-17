import { NextResponse } from "next/server";
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
