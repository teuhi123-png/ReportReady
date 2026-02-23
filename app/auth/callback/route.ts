import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"

  if (!code) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Collect every cookie Supabase wants to set during the token exchange.
  // We forward them directly onto the redirect response so the browser
  // receives them in the same HTTP round-trip and never loses the session.
  const cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }> = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read the PKCE code_verifier (set by the browser during sign-in).
        getAll() {
          return request.cookies.getAll()
        },
        // Collect session cookies — do NOT try to write them via cookieStore
        // here because this response is a redirect and cookieStore writes
        // don't propagate to NextResponse.redirect().
        setAll(cookies) {
          cookiesToSet.push(...cookies)
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error("OAuth callback error:", error.message)
    return NextResponse.redirect(new URL("/login?error=oauth_failed", request.url))
  }

  // Build the redirect and attach every session cookie to it directly.
  const response = NextResponse.redirect(new URL(next, origin))
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
  })

  return response
}
