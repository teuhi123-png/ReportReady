import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

async function logout() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-16">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold tracking-wide text-emerald-700">ReportReady</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">{user.email}</p>

        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/classes"
            className="inline-flex items-center justify-center rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800"
          >
            View Classes
          </Link>

          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Log out
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
