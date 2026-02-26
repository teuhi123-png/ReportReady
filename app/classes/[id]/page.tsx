import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function ClassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: classId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: cls, error: classError } = await supabase
    .from("classes")
    .select("id, name, year_level, subject")
    .eq("id", classId)
    .single();

  if (classError || !cls) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto w-full max-w-3xl">
          <p className="text-sm text-red-600">Class not found.</p>
          <Link href="/classes" className="mt-2 inline-block text-sm text-emerald-700 hover:underline">
            ← Back to classes
          </Link>
        </div>
      </main>
    );
  }

  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name, created_at")
    .eq("class_id", classId)
    .order("created_at", { ascending: true });

  async function addStudent(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const first_name = (formData.get("first_name") as string).trim();
    const last_name = (formData.get("last_name") as string).trim();
    const class_id = formData.get("class_id") as string;
    const reading_group_level = Number(formData.get("reading_group_level"));
    const maths_group_level = Number(formData.get("maths_group_level"));

    if (!first_name || !last_name || !class_id) return;

    await supabase.from("students").insert({
      class_id,
      first_name,
      last_name,
      reading_group_level,
      maths_group_level,
    });

    revalidatePath(`/classes/${class_id}`);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">

        {/* Header */}
        <div>
          <p className="text-sm font-semibold text-emerald-700">ReportReady</p>
          <Link
            href="/classes"
            className="mt-1 inline-block text-xs text-slate-500 hover:text-emerald-700"
          >
            ← Back to classes
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">{cls.name}</h1>
          <p className="text-sm text-slate-500">{cls.year_level} · {cls.subject}</p>
        </div>

        {/* Add student */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Add Student</h2>
          <form action={addStudent} className="mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="class_id" value={classId} />
            <input
              name="first_name"
              type="text"
              required
              placeholder="First name"
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none ring-emerald-200 transition focus:border-emerald-600 focus:ring-2"
            />
            <input
              name="last_name"
              type="text"
              required
              placeholder="Last name"
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none ring-emerald-200 transition focus:border-emerald-600 focus:ring-2"
            />
            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">Reading group</span>
              <select
                name="reading_group_level"
                defaultValue="2"
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none ring-emerald-200 transition focus:border-emerald-600 focus:ring-2"
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
              </select>
            </label>
            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">Maths group</span>
              <select
                name="maths_group_level"
                defaultValue="2"
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none ring-emerald-200 transition focus:border-emerald-600 focus:ring-2"
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
              </select>
            </label>
            <button
              type="submit"
              className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800"
            >
              Add
            </button>
          </form>
        </section>

        {/* Students list */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Students ({students?.length ?? 0})
          </h2>

          {!students || students.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No students yet. Add one above.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 font-medium">First name</th>
                    <th className="px-4 py-3 font-medium">Last name</th>
                    <th className="px-4 py-3 font-medium text-right">Observe</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id} className="border-t border-slate-200">
                      <td className="px-4 py-3 text-slate-900">{student.first_name}</td>
                      <td className="px-4 py-3 text-slate-900">{student.last_name}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/students/${student.id}`}
                          className="inline-flex rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                        >
                          Log
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
