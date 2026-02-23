"use client";

export const dynamic = "force-dynamic";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type StudentRow = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  reading_group: number | null;
  maths_group: number | null;
};

export default function StudentsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const classId = params.id;
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const firstNameInputRef = useRef<HTMLInputElement | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [readingGroup, setReadingGroup] = useState("1");
  const [mathsGroup, setMathsGroup] = useState("1");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadStudents() {
      setError("");
      setIsLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error: loadError } = await supabase
        .from("students")
        .select("id, first_name, last_name, preferred_name, reading_group, maths_group")
        .eq("class_id", classId)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (loadError) {
        setError(loadError.message);
        setStudents([]);
      } else {
        setStudents((data ?? []) as StudentRow[]);
      }

      setIsLoading(false);
      firstNameInputRef.current?.focus();
    }

    void loadStudents();

    return () => {
      active = false;
    };
  }, [classId, router, supabase]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      class_id: classId,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      preferred_name: preferredName.trim() ? preferredName.trim() : null,
      reading_group: Number(readingGroup),
      maths_group: Number(mathsGroup),
    };

    const { data, error: insertError } = await supabase
      .from("students")
      .insert(payload)
      .select("id, first_name, last_name, preferred_name, reading_group, maths_group")
      .single();

    if (insertError) {
      setError(insertError.message);
      setIsSubmitting(false);
      return;
    }

    setStudents((previous) => [data as StudentRow, ...previous]);
    setFirstName("");
    setLastName("");
    setPreferredName("");
    setIsSubmitting(false);
    firstNameInputRef.current?.focus();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <section className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-emerald-700">ReportReady</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Add Students</h1>
        <p className="mt-1 text-sm text-slate-600">
          Class ID: {classId} | Fast entry: type names and press Enter to add.
        </p>

        <form onSubmit={onSubmit} className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-12">
          <input
            ref={firstNameInputRef}
            type="text"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            placeholder="First name"
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none ring-emerald-200 transition focus:border-emerald-600 focus:ring-2 md:col-span-2"
          />
          <input
            type="text"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            placeholder="Last name"
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none ring-emerald-200 transition focus:border-emerald-600 focus:ring-2 md:col-span-2"
          />
          <input
            type="text"
            value={preferredName}
            onChange={(event) => setPreferredName(event.target.value)}
            placeholder="Preferred (optional)"
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none ring-emerald-200 transition focus:border-emerald-600 focus:ring-2 md:col-span-3"
          />
          <select
            value={readingGroup}
            onChange={(event) => setReadingGroup(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none ring-emerald-200 transition focus:border-emerald-600 focus:ring-2 md:col-span-2"
          >
            <option value="1">Reading 1</option>
            <option value="2">Reading 2</option>
            <option value="3">Reading 3</option>
            <option value="4">Reading 4</option>
          </select>
          <select
            value={mathsGroup}
            onChange={(event) => setMathsGroup(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none ring-emerald-200 transition focus:border-emerald-600 focus:ring-2 md:col-span-2"
          >
            <option value="1">Maths 1</option>
            <option value="2">Maths 2</option>
            <option value="3">Maths 3</option>
            <option value="4">Maths 4</option>
          </select>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-1"
          >
            {isSubmitting ? "Adding..." : "Add"}
          </button>
        </form>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6">
          <h2 className="text-lg font-semibold text-slate-900">Students ({students.length})</h2>
          {isLoading ? <p className="mt-2 text-sm text-slate-600">Loading students...</p> : null}

          {!isLoading && students.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">No students yet. Add your first student above.</p>
          ) : null}

          {!isLoading && students.length > 0 ? (
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-3 py-2 font-medium">First name</th>
                    <th className="px-3 py-2 font-medium">Last name</th>
                    <th className="px-3 py-2 font-medium">Preferred</th>
                    <th className="px-3 py-2 font-medium">Reading</th>
                    <th className="px-3 py-2 font-medium">Maths</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id} className="border-t border-slate-200">
                      <td className="px-3 py-2 text-slate-900">{student.first_name}</td>
                      <td className="px-3 py-2 text-slate-900">{student.last_name}</td>
                      <td className="px-3 py-2 text-slate-700">{student.preferred_name || "-"}</td>
                      <td className="px-3 py-2 text-slate-700">{student.reading_group ?? "-"}</td>
                      <td className="px-3 py-2 text-slate-700">{student.maths_group ?? "-"}</td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/classes/${classId}/students/${student.id}`}
                          className="text-xs font-medium text-emerald-700 hover:underline"
                        >
                          Assessments →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
