import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase";
import ObservationLoggerForm from "./ObservationLoggerForm";

export const dynamic = "force-dynamic";

type SubjectValue = "reading" | "maths" | "general";

function normalizeDefaultSubject(input?: string | null): SubjectValue {
  const value = String(input || "").toLowerCase();
  if (value.includes("read")) return "reading";
  if (value.includes("math")) return "maths";
  return "general";
}

function toText(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function pickFirst(student: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = toText(student[key]);
    if (value) return value;
  }
  return null;
}

function getGroupLevels(student: Record<string, unknown>) {
  return {
    reading: pickFirst(student, [
      "reading_group_level",
      "reading_level",
      "reading_group",
      "literacy_group_level",
    ]),
    maths: pickFirst(student, [
      "maths_group_level",
      "math_group_level",
      "maths_level",
      "math_level",
      "numeracy_group_level",
    ]),
    general: pickFirst(student, ["general_group_level", "general_level", "group_level"]),
  };
}

export default async function StudentObservationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: studentId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("*")
    .eq("id", studentId)
    .single<Record<string, unknown>>();

  if (studentError || !student) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto w-full max-w-md">
          <p className="text-sm text-red-600">Student not found.</p>
          <Link href="/classes" className="mt-2 inline-block text-sm text-emerald-700 hover:underline">
            ← Back to classes
          </Link>
        </div>
      </main>
    );
  }

  const classId = String(student.class_id || "");
  if (!classId) redirect("/classes");

  const { data: cls } = await supabase
    .from("classes")
    .select("id, subject, year_level")
    .eq("id", classId)
    .single();

  const firstName = toText(student.first_name) || "Student";

  return (
    <ObservationLoggerForm
      studentId={studentId}
      classId={classId}
      studentFirstName={firstName}
      classYearLevel={toText(cls?.year_level)}
      defaultSubject={normalizeDefaultSubject(cls?.subject)}
      groupLevels={getGroupLevels(student)}
    />
  );
}
