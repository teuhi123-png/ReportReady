import Link from "next/link";
import Button from "../components/ui/Button";

export default function HomePage() {
  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 960 }}>
        <section
          className="card"
          style={{
            overflow: "hidden",
            borderColor: "rgba(37, 99, 235, 0.35)",
            background:
              "radial-gradient(circle at 10% 0%, rgba(37,99,235,0.25), transparent 38%), radial-gradient(circle at 90% 100%, rgba(34,197,94,0.18), transparent 42%)",
          }}
        >
          <div className="card-body" style={{ display: "grid", gap: 22, padding: "28px 24px" }}>
            <div style={{ display: "grid", gap: 10 }}>
              <p className="pill" style={{ margin: 0, width: "fit-content" }}>
                AI Site Intelligence
              </p>
              <h1 className="h1" style={{ margin: 0, fontSize: "clamp(2rem, 5vw, 3rem)" }}>
                SiteMind AI Assistant
              </h1>
              <p className="muted" style={{ margin: 0, maxWidth: 680, fontSize: "1.05rem", lineHeight: 1.6 }}>
                Upload site plan PDFs, then ask questions in plain language to get fast, contextual answers
                from your project documents.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/uploads">
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
