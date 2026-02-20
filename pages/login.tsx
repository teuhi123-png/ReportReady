import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Button from "../components/ui/Button";

type Status = "idle" | "loading" | "success" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function onSubmit(): Promise<void> {
    const trimmed = email.trim().toLowerCase();
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (!isValid) {
      setStatus("error");
      setErrorMessage("Enter a valid email address.");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
    } else {
      setStatus("success");
    }
  }

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 520 }}>
        <section className="card">
          <div className="card-body" style={{ display: "grid", gap: 14 }}>
            <div>
              <h1 className="h1" style={{ marginBottom: 8 }}>
                ReportReady Login
              </h1>
              <p className="muted" style={{ margin: 0 }}>
                Enter your email to receive a magic link and sign in.
              </p>
            </div>

            {status === "success" ? (
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 8,
                  background: "#ecfdf5",
                  color: "#065f46",
                  fontSize: 14,
                  lineHeight: 1.5,
                }}
              >
                <strong>Check your inbox!</strong> We sent a magic link to{" "}
                <strong>{email.trim().toLowerCase()}</strong>. Click it to sign in.
              </div>
            ) : (
              <>
                <label className="input-field" htmlFor="login-email">
                  <div className="label">Email</div>
                  <input
                    id="login-email"
                    className={`input ${status === "error" ? "input-error" : ""}`.trim()}
                    placeholder="you@school.edu"
                    type="email"
                    value={email}
                    disabled={status === "loading"}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (status === "error") {
                        setStatus("idle");
                        setErrorMessage("");
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && email.trim()) void onSubmit();
                    }}
                  />
                  {status === "error" && errorMessage && (
                    <div className="error">{errorMessage}</div>
                  )}
                </label>

                <Button
                  onClick={() => void onSubmit()}
                  disabled={!email.trim() || status === "loading"}
                >
                  {status === "loading" ? "Sending…" : "Send Magic Link"}
                </Button>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
