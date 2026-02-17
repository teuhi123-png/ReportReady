import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

export async function GET(req: Request) {
  try {

    const { searchParams } = new URL(req.url);
    const userEmail = searchParams.get("userEmail");

    if (!userEmail) {
      return NextResponse.json([]);
    }

    const blobs = await list();

    const userFiles = blobs.blobs.filter(blob =>
      blob.pathname.includes(userEmail)
    );

    return NextResponse.json(userFiles);

  } catch (error) {

    console.error("UPLOADS ERROR:", error);

    return NextResponse.json(
      { error: "Failed to fetch uploads" },
      { status: 500 }
    );

  }
}
