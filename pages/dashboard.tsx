import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import Button from "../components/ui/Button";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get the current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        void router.replace("/login");
      } else {
        setUser(session.user);
        setLoading(false);
      }
    });

    // Listen for auth state changes (e.g. magic link callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        void router.replace("/login");
      } else {
        setUser(session.user);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  async function handleSignOut(): Promise<void> {
    await supabase.auth.signOut();
    void router.replace("/login");
  }

  if (loading) {
    return (
      <main className="page">
        <div className="container" style={{ maxWidth: 640 }}>
          <p className="muted">Loading…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <section className="card">
          <div className="card-body" style={{ display: "grid", gap: 20 }}>
            <div>
              <h1 className="h1" style={{ marginBottom: 6 }}>
                Welcome to ReportReady
              </h1>
              <p className="muted" style={{ margin: 0 }}>
                Signed in as <strong>{user?.email}</strong>
              </p>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <Button onClick={() => void router.push("/classes/new")}>
                Create Class
              </Button>
              <Button onClick={() => void router.push("/classes")}>
                View Classes
              </Button>
            </div>

            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                style={{
                  background: "none",
                  border: "none",
                  color: "#6b7280",
                  fontSize: 14,
                  cursor: "pointer",
                  padding: 0,
                  textDecoration: "underline",
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
