import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    return Response.json({
      ok: true,
      handler: "APP_ROUTER_CHAT_V1",
      received: body,
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        handler: "APP_ROUTER_CHAT_V1",
        error: "Invalid JSON",
      },
      { status: 400 }
    );
  }
}

export async function GET() {
  return Response.json(
    {
      ok: false,
      handler: "APP_ROUTER_CHAT_V1",
      error: "Use POST",
    },
    { status: 405 }
  );
}
