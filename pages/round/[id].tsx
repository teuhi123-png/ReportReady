import Link from "next/link";
import Button from "../../components/ui/Button";

export default function LegacyDetailPage() {
  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 760 }}>
        <section className="card">
          <div className="card-body" style={{ display: "grid", gap: 14 }}>
            <h1 className="h1" style={{ margin: 0 }}>
              Legacy Page
            </h1>
            <p className="muted" style={{ margin: 0 }}>
              This screen is no longer in use. Continue in Uploads or Chat.
            </p>
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
