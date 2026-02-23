"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type Subject = "reading" | "writing" | "maths";

const SUBJECTS: Subject[] = ["reading", "writing", "maths"];

const SUBJECT_LABEL: Record<Subject, string> = {
  reading: "Reading",
  writing: "Writing",
  maths: "Maths",
};

type Student = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
};

type Assessment = {
  id: string;
  subject: Subject;
  level: string;
  created_at: string;
};

export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string; studentId: string }>();
  const { id: classId, studentId } = params;
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [student, setStudent] = useState<Student | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  // Add assessment form
  const [subject, setSubject] = useState<Subject>("reading");
  const [level, setLevel] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;
      if (!user) {
        router.replace("/login");
        return;
      }

      const [studentResult, assessmentsResult] = await Promise.all([
        supabase
          .from("students")
          .select("id, first_name, last_name, preferred_name")
          .eq("id", studentId)
          .single(),
        supabase
          .from("assessments")
          .select("id, subject, level, created_at")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false }),
      ]);

      if (!active) return;

      if (studentResult.error || !studentResult.data) {
        setPageError("Student not found.");
        setIsLoading(false);
        return;
      }

      setStudent(studentResult.data as Student);

      if (assessmentsResult.error) {
        setPageError(assessmentsResult.error.message);
      } else {
        setAssessments((assessmentsResult.data ?? []) as Assessment[]);
      }

      setIsLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [studentId, router, supabase]);

  async function onAddAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!level.trim()) {
      setFormError("Level is required.");
      return;
    }

    setIsSubmitting(true);

    const { data, error: insertError } = await supabase
      .from("assessments")
      .insert({ student_id: studentId, subject, level: level.trim() })
      .select("id, subject, level, created_at")
      .single();

    if (insertError) {
      setFormError(insertError.message);
      setIsSubmitting(false);
      return;
    }

    setAssessments((prev) => [data as Assessment, ...prev]);
    setLevel("");
    setIsSubmitting(false);
  }

  // Latest assessment per subject (assessments are already sorted desc by created_at)
  const currentLevels = useMemo(() => {
    const map: Partial<Record<Subject, Assessment>> = {};
    for (const a of assessments) {
      if (!map[a.subject]) map[a.subject] = a;
    }
    return map;
  }, [assessments]);

  const displayName = student
    ? (student.preferred_name || student.first_name)
    : "";
  const fullName = student
    ? `${student.first_name} ${student.last_name}`
    : "";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-2xl space-y-6">

        {/* Header */}
        <div>
          <p className="text-sm font-semibold text-emerald-700">ReportReady</p>
          <Link
            href={`/classes/${classId}/students`}
            className="mt-1 inline-block text-xs text-slate-500 hover:text-emerald-700"
          >
            ← Back to class
          </Link>
          {student && (
            <div className="mt-2">
              <h1 className="text-2xl font-semibold text-slate-900">{displayName}</h1>
              {displayName !== fullName && (
                <p className="text-sm text-slate-500">{fullName}</p>
              )}
            </div>
          )}
        </div>

        {pageError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {pageError}
          </p>
        )}

        {isLoading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : (
          <>
            {/* Current levels */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Current Levels</h2>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {SUBJECTS.map((sub) => {
                  const latest = currentLevels[sub];
                  return (
                    <div
                      key={sub}
                      className="rounded-xl border border-slate-200 p-4 text-center"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {SUBJECT_LABEL[sub]}
                      </p>
                      <p className="mt-2 text-3xl font-bold text-slate-900">
                        {latest ? latest.level : "—"}
                      </p>
                      {latest && (
                        <p className="mt-1 text-xs text-slate-400">
                          {new Date(latest.created_at).toLocaleDateString("en-NZ", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Add assessment */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Add Assessment</h2>
              <form onSubmit={onAddAssessment} className="mt-4 flex flex-wrap gap-3">
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value as Subject)}
                  className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none ring-emerald-200 transition focus:border-emerald-600 focus:ring-2"
                >
                  {SUBJECTS.map((sub) => (
                    <option key={sub} value={sub}>
                      {SUBJECT_LABEL[sub]}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  placeholder="Level (e.g. 3, 2B, Stage 4)"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none ring-emerald-200 transition focus:border-emerald-600 focus:ring-2"
                />

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Saving..." : "Save"}
                </button>
              </form>
              {formError && (
                <p className="mt-2 text-sm text-red-600">{formError}</p>
              )}
            </section>

            {/* Assessment history */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">History</h2>
              {assessments.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  No assessments recorded yet.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="px-3 py-2 font-medium">Subject</th>
                        <th className="px-3 py-2 font-medium">Level</th>
                        <th className="px-3 py-2 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assessments.map((a) => (
                        <tr key={a.id} className="border-t border-slate-200">
                          <td className="px-3 py-2 text-slate-700">
                            {SUBJECT_LABEL[a.subject]}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-900">
                            {a.level}
                          </td>
                          <td className="px-3 py-2 text-slate-500">
                            {new Date(a.created_at).toLocaleDateString("en-NZ", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
