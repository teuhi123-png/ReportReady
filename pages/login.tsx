import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import Button from "../components/ui/Button";
import { writeSignedInEmail } from "../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const nextPath = useMemo(() => {
    const raw = typeof router.query.next === "string" ? router.query.next : "/upload";
    return raw.startsWith("/") ? raw : "/upload";
  }, [router.query.next]);

  function onSubmit(): void {
    const trimmed = email.trim().toLowerCase();
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (!isValid) {
      setError("Enter a valid email address.");
      return;
    }

    writeSignedInEmail(trimmed);
    void router.push(nextPath);
  }

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 520 }}>
        <section className="card">
          <div className="card-body" style={{ display: "grid", gap: 14 }}>
            <div>
              <h1 className="h1" style={{ marginBottom: 8 }}>
                SiteMind Login
              </h1>
              <p className="muted" style={{ margin: 0 }}>
                Sign in with your email to access uploads and AI chat.
              </p>
            </div>

            <label className="input-field" htmlFor="login-email">
              <div className="label">Email</div>
              <input
                id="login-email"
                className={`input ${error ? "input-error" : ""}`.trim()}
                placeholder="you@example.com"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (error) setError("");
                }}
              />
              {error && <div className="error">{error}</div>}
            </label>

            <Button onClick={onSubmit} disabled={!email.trim()}>
              Continue
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
