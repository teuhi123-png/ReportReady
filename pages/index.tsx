import Link from "next/link";
import Button from "../components/ui/Button";

const features = [
  {
    title: "Upload",
    description: "Bring in construction plans as PDFs in seconds.",
  },
  {
    title: "Ask",
    description: "Ask natural-language questions about rooms, dimensions, and notes.",
  },
  {
    title: "Answer",
    description: "Receive instant responses grounded in your plan documents.",
  },
];

export default function HomePage() {
  return (
    <main className="landing">
      <div className="landing-container">
        <section className="landing-hero card">
          <div className="card-body landing-hero-body">
            <p className="pill">SiteMind AI Assistant</p>
            <h1 className="landing-title">Understand building plans instantly.</h1>
            <p className="landing-subtitle">Upload plans. Ask questions. Get answers in seconds.</p>
            <div className="landing-cta">
              <Link href="/uploads">
                <Button>Upload a plan</Button>
              </Link>
              <Link href="/chat">
                <Button variant="secondary">Try demo</Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="landing-grid">
          {features.map((feature) => (
            <article key={feature.title} className="card landing-feature-card">
              <div className="card-body">
                <p className="label">Step</p>
                <h2 className="h2">{feature.title}</h2>
                <p className="muted">{feature.description}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="landing-pricing">
          <article className="card pricing-card">
            <div className="card-body">
              <p className="label">Starter</p>
              <h3 className="pricing-amount">$29</h3>
              <p className="muted">Perfect for solo builders and small project reviews.</p>
              <Button variant="secondary">Choose Starter</Button>
            </div>
          </article>
          <article className="card pricing-card pricing-card-pro">
            <div className="card-body">
              <p className="label">Pro</p>
              <h3 className="pricing-amount">$79</h3>
              <p className="muted">For teams handling multiple plan sets and detailed Q&A.</p>
              <Button>Choose Pro</Button>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
