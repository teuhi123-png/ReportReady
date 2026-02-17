export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const question = body.question || "";
    void question;

    return Response.json({
      ok: true,
      answer: "Test answer: The garage is 6m x 6m.",
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
