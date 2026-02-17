import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const question = body.question || "";
    void question;

    return NextResponse.json({
      answer: "Test answer: The garage is 6m x 6m."
    });

  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
