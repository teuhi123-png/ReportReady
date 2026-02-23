import { createBrowserClient } from "@supabase/ssr";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  // NEXT_PUBLIC_* vars are inlined at build time by Next.js.
  // Using ! assertions here avoids a throw during server-side rendering of the
  // initial HTML shell (which happens even for "use client" pages at build time).
  // The real values must be set in Vercel project environment variables.
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return browserClient;
}
