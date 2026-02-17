import Link from "next/link";
import Button from "../components/ui/Button";

const features = [
  {
    title: "Upload PDFs",
    description: "Securely upload construction plan sets and keep project files organized.",
  },
  {
    title: "Ask questions",
    description: "Use natural language to find dimensions, notes, and scope details quickly.",
  },
  {
    title: "Get instant answers",
    description: "Get fast, contextual responses grounded in your uploaded plan documents.",
  },
];

export default function HomePage() {
  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 980, justifyItems: "center" }}>
        <section
          className="card"
          style={{
            width: "100%",
            overflow: "hidden",
            textAlign: "center",
            borderColor: "rgba(59, 130, 246, 0.4)",
            background:
              "radial-gradient(circle at 20% 0%, rgba(37, 99, 235, 0.28), transparent 42%), radial-gradient(circle at 80% 100%, rgba(14, 165, 233, 0.18), transparent 44%)",
          }}
        >
          <div className="card-body" style={{ display: "grid", gap: 30, padding: "52px 24px 44px" }}>
            <div style={{ display: "grid", gap: 12, justifyItems: "center" }}>
              <p className="pill" style={{ margin: 0 }}>
                SiteMind AI
              </p>
              <h1 className="h1" style={{ margin: 0, fontSize: "clamp(2.1rem, 5vw, 3.25rem)" }}>
                AI Site Plan Assistant
              </h1>
              <p
                className="muted"
                style={{ margin: 0, maxWidth: 700, fontSize: "1.08rem", lineHeight: 1.6, color: "#cbd5e1" }}
              >
                Upload construction plans and ask questions instantly.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 14,
                width: "100%",
              }}
            >
              {features.map((feature) => (
                <article
                  key={feature.title}
                  className="card"
                  style={{ boxShadow: "none", borderColor: "rgba(255, 255, 255, 0.12)", textAlign: "left" }}
                >
                  <div className="card-body" style={{ padding: 16 }}>
                    <h2 className="h2" style={{ margin: "0 0 6px", fontSize: 18 }}>
                      {feature.title}
                    </h2>
                    <p className="muted" style={{ margin: 0, color: "#cbd5e1" }}>
                      {feature.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <Link href="/login">
                <Button>Start Free →</Button>
              </Link>
              <Link href="/chat">
                <Button variant="secondary">View Demo →</Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
