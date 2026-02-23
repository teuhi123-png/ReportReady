"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type Subject = "reading" | "writing" | "maths";

const SUBJECTS: Subject[] = ["reading", "writing", "maths"];

type Student = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
};

type StudentRow = Student & {
  levels: Partial<Record<Subject, string>>;
};

export default function ClassOverviewPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const classId = params.id;
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [rows, setRows] = useState<StudentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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

      // 1. Fetch all students in this class, sorted alphabetically
      const { data: students, error: studentsError } = await supabase
        .from("students")
        .select("id, first_name, last_name, preferred_name")
        .eq("class_id", classId)
        .order("last_name", { ascending: true });

      if (!active) return;

      if (studentsError) {
        setError(studentsError.message);
        setIsLoading(false);
        return;
      }

      if (!students || students.length === 0) {
        setRows([]);
        setIsLoading(false);
        return;
      }

      // 2. Fetch all assessments for those students in one query (newest first)
      const studentIds = students.map((s) => s.id);

      const { data: assessments, error: assessmentsError } = await supabase
        .from("assessments")
        .select("student_id, subject, level, created_at")
        .in("student_id", studentIds)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (assessmentsError) {
        setError(assessmentsError.message);
        setIsLoading(false);
        return;
      }

      // 3. Derive the latest level per student per subject.
      //    Because assessments are sorted newest-first, the first entry we see
      //    for each (student_id, subject) pair is always the current level.
      const latestMap = new Map<string, Partial<Record<Subject, string>>>();

      for (const a of assessments ?? []) {
        if (!latestMap.has(a.student_id)) {
          latestMap.set(a.student_id, {});
        }
        const levels = latestMap.get(a.student_id)!;
        if (!levels[a.subject as Subject]) {
          levels[a.subject as Subject] = a.level;
        }
      }

      setRows(
        students.map((s) => ({
          ...s,
          levels: latestMap.get(s.id) ?? {},
        })),
      );
      setIsLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [classId, router, supabase]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <section className="mx-auto w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-emerald-700">ReportReady</p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold text-slate-900">Class Overview</h1>
          <Link
            href={`/classes/${classId}/students`}
            className="shrink-0 text-sm font-medium text-emerald-700 hover:underline"
          >
            Manage students →
          </Link>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {isLoading ? (
          <p className="mt-6 text-sm text-slate-500">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">
            No students yet.{" "}
            <Link
              href={`/classes/${classId}/students`}
              className="text-emerald-700 underline"
            >
              Add students
            </Link>
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Reading</th>
                  <th className="px-4 py-3 font-medium">Writing</th>
                  <th className="px-4 py-3 font-medium">Maths</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((student) => {
                  const displayName =
                    student.preferred_name || student.first_name;
                  return (
                    <tr
                      key={student.id}
                      className="border-t border-slate-200 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/classes/${classId}/students/${student.id}`}
                          className="font-medium text-slate-900 hover:text-emerald-700"
                        >
                          {displayName} {student.last_name}
                        </Link>
                      </td>
                      {SUBJECTS.map((sub) => (
                        <td key={sub} className="px-4 py-3 text-slate-700">
                          {student.levels[sub] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
