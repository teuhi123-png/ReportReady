import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default async function NewClassPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  async function createClass(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const name = (formData.get("name") as string).trim();
    const year_level = (formData.get("year_level") as string).trim();
    const subject = (formData.get("subject") as string).trim();

    const { data, error } = await supabase
      .from("classes")
      .insert({ name, year_level, subject, user_id: user.id })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    redirect(`/classes/${data.id}`);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <section className="mx-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-emerald-700">ReportReady</p>
        <Link
          href="/classes"
          className="mt-1 inline-block text-xs text-slate-500 hover:text-emerald-700"
        >
          ← Back to classes
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">Create Class</h1>

        <form action={createClass} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Class name</span>
            <input
              name="name"
              type="text"
              required
              placeholder="Room 12"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none ring-emerald-200 transition focus:border-emerald-600 focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Year level</span>
            <input
              name="year_level"
              type="text"
              required
              placeholder="Year 4"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none ring-emerald-200 transition focus:border-emerald-600 focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Subject</span>
            <input
              name="subject"
              type="text"
              required
              placeholder="Literacy"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none ring-emerald-200 transition focus:border-emerald-600 focus:ring-2"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800"
          >
            Create
          </button>
        </form>
      </section>
    </main>
  );
}
