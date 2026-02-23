"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function NewClassPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [name, setName] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [term, setTerm] = useState("1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Class name is required.");
      return;
    }

    if (!Number.isInteger(year) || year < 1900 || year > 3000) {
      setError("Enter a valid year.");
      return;
    }

    if (!["1", "2", "3", "4"].includes(term)) {
      setError("Term must be 1, 2, 3, or 4.");
      return;
    }

    setIsSubmitting(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setIsSubmitting(false);
      setError(userError?.message ?? "Auth session missing. Please log in again.");
      router.replace("/login");
      return;
    }

    let insertResult = await supabase
      .from("classes")
      .insert({
        name: name.trim(),
        year,
        term: Number(term),
        owner_id: user.id,
      })
      .select("id")
      .single();

    // Support either `name` or `class_name` schema naming.
    if (insertResult.error && insertResult.error.message.toLowerCase().includes("name")) {
      insertResult = await supabase
        .from("classes")
        .insert({
          class_name: name.trim(),
          year,
          term: Number(term),
          owner_id: user.id,
        })
        .select("id")
        .single();
    }

    if (insertResult.error) {
      setError(insertResult.error.message);
      setIsSubmitting(false);
      return;
    }

    router.push(`/classes/${insertResult.data.id}/students`);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <section className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-emerald-700">ReportReady</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Create Class</h1>
        <p className="mt-2 text-sm text-slate-600">Set up a class to start tracking students and plans.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Class name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="English 10A"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-emerald-200 transition focus:border-emerald-600 focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Year</span>
            <input
              type="number"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-emerald-200 transition focus:border-emerald-600 focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Term</span>
            <select
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-emerald-200 transition focus:border-emerald-600 focus:ring-2"
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Creating..." : "Create"}
          </button>
        </form>
      </section>
    </main>
  );
}
