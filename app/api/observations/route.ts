import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

type SubjectValue = "reading" | "maths" | "general";
type RatingValue = "needs_support" | "on_track" | "excelling";

const SUBJECTS: SubjectValue[] = ["reading", "maths", "general"];
const RATINGS: RatingValue[] = ["needs_support", "on_track", "excelling"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);

  const student_id = String(payload?.student_id || "").trim();
  const subject = String(payload?.subject || "").trim() as SubjectValue;
  const rating = String(payload?.rating || "").trim() as RatingValue;
  const noteValue = payload?.note;
  const note = typeof noteValue === "string" ? noteValue.trim() || null : null;
  const term = Number(payload?.term);
  const year = Number(payload?.year);
  const created_at = String(payload?.created_at || "").trim();

  if (!student_id || !SUBJECTS.includes(subject) || !RATINGS.includes(rating)) {
    return NextResponse.json({ error: "Invalid observation payload." }, { status: 400 });
  }

  if (!Number.isInteger(term) || term < 1 || term > 4) {
    return NextResponse.json({ error: "Invalid term." }, { status: 400 });
  }

  if (!Number.isInteger(year) || year < 2000 || year > 3000) {
    return NextResponse.json({ error: "Invalid year." }, { status: 400 });
  }

  if (!created_at || Number.isNaN(Date.parse(created_at))) {
    return NextResponse.json({ error: "Invalid created_at." }, { status: 400 });
  }

  const { error } = await supabase.from("observations").insert({
    student_id,
    subject,
    rating,
    note,
    term,
    year,
    created_at,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
