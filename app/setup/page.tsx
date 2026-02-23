"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function SetupPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [status, setStatus] = useState<"checking" | "connected" | "error">("checking");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function checkConnection() {
      try {
        const { error } = await supabase.auth.getSession();

        if (!active) return;

        if (error) {
          setStatus("error");
          setErrorMessage(error.message);
          return;
        }

        setStatus("connected");
      } catch (error) {
        if (!active) return;
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Failed to connect to Supabase.");
      }
    }

    void checkConnection();

    return () => {
      active = false;
    };
  }, [supabase]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <section className="mx-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Supabase Setup Check</h1>
        <p className="mt-2 text-sm text-slate-600">
          Verifying NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
        </p>

        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          {status === "checking" ? <p className="text-slate-700">Checking Supabase connection...</p> : null}

          {status === "connected" ? (
            <p className="font-medium text-emerald-700">Connected to Supabase</p>
          ) : null}

          {status === "error" ? (
            <div className="space-y-1">
              <p className="font-medium text-red-700">Could not connect to Supabase</p>
              <p className="text-red-600">{errorMessage}</p>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
