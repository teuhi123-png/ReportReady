import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function ClassesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: classes, error } = await supabase
    .from("classes")
    .select("id, name, year_level, subject, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700">ReportReady</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Your Classes</h1>
          </div>
          <Link
            href="/classes/new"
            className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800"
          >
            Create Class
          </Link>
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error.message}
          </p>
        )}

        {!error && (!classes || classes.length === 0) && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="text-sm text-slate-500">No classes yet.</p>
            <Link
              href="/classes/new"
              className="mt-3 inline-block text-sm font-medium text-emerald-700 hover:underline"
            >
              Create your first class →
            </Link>
          </div>
        )}

        {classes && classes.length > 0 && (
          <div className="space-y-3">
            {classes.map((cls) => (
              <Link
                key={cls.id}
                href={`/classes/${cls.id}`}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
              >
                <div>
                  <p className="font-semibold text-slate-900">{cls.name}</p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {cls.year_level} · {cls.subject}
                  </p>
                </div>
                <span className="text-slate-400">→</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
