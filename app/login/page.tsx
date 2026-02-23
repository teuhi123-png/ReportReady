"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type AuthMode = "sign_in" | "sign_up";

async function getPostLoginPath(user: any) {
  const supabase = getSupabaseBrowserClient();
  const hasLoggedIn = Boolean(user?.user_metadata?.has_logged_in);

  if (hasLoggedIn) {
    return "/classes";
  }

  const { error } = await supabase.auth.updateUser({
    data: { has_logged_in: true },
  });

  if (error) {
    throw error;
  }

  return "/classes/new";
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function bootstrap() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!isActive) return;
      if (userError) {
        setError(userError.message);
        return;
      }

      if (user) {
        const path = await getPostLoginPath(user);
        router.replace(path);
      }
    }

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        return;
      }

      try {
        const path = await getPostLoginPath(session.user);
        router.replace(path);
      } catch (redirectError) {
        setError(redirectError instanceof Error ? redirectError.message : "Could not complete login redirect.");
      }
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  async function onGoogleLogin() {
    setError("");
    setMessage("");
    setIsLoading(true);

    const origin = window.location.origin;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setIsLoading(false);
      return;
    }
  }

  async function onEmailPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }

    setIsLoading(true);

    try {
      if (mode === "sign_in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) throw signInError;
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });

        if (signUpError) throw signUpError;

        if (!data.session) {
          setMessage("Check your email to confirm your account, then sign in.");
          setIsLoading(false);
          return;
        }
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed.");
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-16">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold tracking-wide text-emerald-700">ReportReady</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Log in to your account</h1>
        <p className="mt-2 text-sm text-slate-600">Use Google or email/password to continue.</p>

        <button
          type="button"
          onClick={onGoogleLogin}
          disabled={isLoading}
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          <span>or</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="mb-4 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("sign_in")}
            className={`rounded-md px-3 py-2 ${mode === "sign_in" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("sign_up")}
            className={`rounded-md px-3 py-2 ${mode === "sign_up" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={onEmailPasswordSubmit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-emerald-200 transition focus:border-emerald-600 focus:ring-2"
              placeholder="you@school.edu"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-emerald-200 transition focus:border-emerald-600 focus:ring-2"
              placeholder="••••••••"
            />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Please wait..." : mode === "sign_in" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-500">
          By continuing, you agree to your school&apos;s account policy.
          <span className="ml-1">
            <Link href="/" className="text-slate-700 underline">
              Back to home
            </Link>
          </span>
        </p>
      </section>
    </main>
  );
}
