import { useState } from "react";
import Link from "next/link";
import Button from "../components/ui/Button";

type ChatApiResponse = {
  answer?: string;
  error?: string;
};

export default function ChatPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState("");
  const [isAsking, setIsAsking] = useState(false);

  async function onAsk(): Promise<void> {
    const trimmed = question.trim();
    if (!trimmed || isAsking) return;

    setIsAsking(true);
    setStatus("Thinking...");
    setAnswer("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: trimmed }),
      });

      const payload = (await response.json()) as ChatApiResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Request failed");
      }

      setAnswer(payload.answer ?? "No answer returned.");
      setStatus("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      setStatus(message);
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <main className="page">
      <div className="container">
        <section className="card">
          <div className="card-body" style={{ display: "grid", gap: 14 }}>
            <div>
              <h1 className="h1" style={{ marginBottom: 8 }}>
                SiteMind AI Assistant
              </h1>
              <p className="muted" style={{ margin: 0 }}>
                Ask questions about your uploaded site plan PDFs.
              </p>
            </div>

            <label className="input-field" htmlFor="chat-question">
              <div className="label">Question</div>
              <textarea
                id="chat-question"
                className="input"
                rows={4}
                placeholder="Ask about dimensions, notes, or plan details..."
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
              />
            </label>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button onClick={onAsk} loading={isAsking} disabled={!question.trim()}>
                Ask
              </Button>
              <Link href="/upload">
                <Button variant="secondary">Go to Uploads</Button>
              </Link>
            </div>

            {status && <div className="muted">{status}</div>}

            {answer && (
              <div className="card" style={{ borderRadius: 12 }}>
                <div className="card-body" style={{ padding: "12px 14px" }}>
                  <div className="label">Answer</div>
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{answer}</div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
