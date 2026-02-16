import Link from "next/link";
import Button from "../components/ui/Button";

export default function HomePage() {
  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 760 }}>
        <section className="card">
          <div className="card-body" style={{ display: "grid", gap: 14 }}>
            <div>
              <h1 className="h1" style={{ marginBottom: 8 }}>
                SiteMind AI Assistant
              </h1>
              <p className="muted" style={{ margin: 0 }}>
                Upload site plan PDFs and chat with AI about dimensions, notes, and project details.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/upload">
                <Button>Open Uploads</Button>
              </Link>
              <Link href="/chat">
                <Button variant="secondary">Open Chat</Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
