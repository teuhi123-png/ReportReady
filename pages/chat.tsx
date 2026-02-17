import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Button from "../components/ui/Button";
import { clearSignedInEmail, readSignedInEmail } from "../lib/auth";

type ChatApiResponse = {
  ok?: boolean;
  answer?: string;
  error?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

function loadingLabel(count: number): string {
  const dots = ".".repeat((count % 3) + 1);
  return `Thinking${dots}`;
}

function renderWithBold(text: string): ReactNode {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, lineIdx) => {
        const parts = line.split("**");
        return (
          <span key={`line-${lineIdx}`}>
            {parts.map((part, idx) =>
              idx % 2 === 1 ? <strong key={`part-${lineIdx}-${idx}`}>{part}</strong> : part
            )}
            {lineIdx < lines.length - 1 && <br />}
          </span>
        );
      })}
    </>
  );
}

async function requestChat(payload: { question: string }): Promise<ChatApiResponse> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  let data: ChatApiResponse | null = null;

  try {
    data = raw ? (JSON.parse(raw) as ChatApiResponse) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    console.error("CHAT ERROR", response.status, raw);
    throw new Error(data?.error || raw || `HTTP ${response.status}`);
  }

  if (!data) {
    throw new Error("Empty response from server");
  }

  return data;
}

export default function ChatPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [tick, setTick] = useState(0);
  const [history, setHistory] = useState<ChatMessage[]>([]);

  useEffect(() => {
    const signedInEmail = readSignedInEmail();
    if (!signedInEmail) {
      void router.replace(`/login?next=${encodeURIComponent("/chat")}`);
      return;
    }
    setEmail(signedInEmail);
  }, [router]);

  useEffect(() => {
    if (!isAsking) return;
    const interval = window.setInterval(() => {
      setTick((value) => value + 1);
    }, 320);
    return () => window.clearInterval(interval);
  }, [isAsking]);

  const loadingText = useMemo(() => loadingLabel(tick), [tick]);

  async function onAsk(): Promise<void> {
    const trimmed = question.trim();
    if (!trimmed || isAsking) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };
    setHistory((prev) => [...prev, userMessage]);
    setQuestion("");
    setIsAsking(true);
    setStatus("");
    setTick(0);

    try {
      const payload = await requestChat({ question: trimmed });

      if (typeof payload.answer !== "string") {
        console.error("Chat API invalid JSON payload:", payload);
        throw new Error(payload.error ?? "Chat returned an invalid response.");
      }

      setHistory((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: payload.answer,
          createdAt: Date.now(),
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      setStatus(message);
    } finally {
      setIsAsking(false);
    }
  }

  function onLogout(): void {
    clearSignedInEmail();
    void router.push("/login?next=/chat");
  }

  return (
    <main className="page">
      <div className="container">
        <section className="card">
          <div className="card-body" style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <h1 className="h1" style={{ marginBottom: 8 }}>
                  SiteMind AI Assistant
                </h1>
                <p className="muted" style={{ margin: 0 }}>
                  Signed in as {email || "..."}.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Link href="/uploads">
                  <Button variant="secondary">Go to Uploads</Button>
                </Link>
                <Button variant="secondary" onClick={onLogout}>
                  Log out
                </Button>
              </div>
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
              <Button onClick={onAsk} loading={false} disabled={!question.trim() || isAsking}>
                Ask
              </Button>
              <Link href="/uploads">
                <Button variant="secondary">Go to Uploads</Button>
              </Link>
            </div>

            {isAsking && <div className="muted">{loadingText}</div>}
            {status && <div className="error">{status}</div>}
          </div>
        </section>

        <section className="card">
          <div className="card-body" style={{ display: "grid", gap: 10 }}>
            <div className="h2" style={{ marginBottom: 0 }}>
              Chat History
            </div>
            {history.length === 0 ? (
              <div className="muted">No messages yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {history.map((message) => (
                  <div
                    key={message.id}
                    className="card"
                    style={{
                      borderRadius: 12,
                      boxShadow: "none",
                      borderColor:
                        message.role === "assistant"
                          ? "rgba(34, 197, 94, 0.35)"
                          : "rgba(37, 99, 235, 0.35)",
                    }}
                  >
                    <div className="card-body" style={{ padding: "12px 14px", display: "grid", gap: 6 }}>
                      <div className="label" style={{ marginBottom: 0 }}>
                        {message.role === "assistant" ? "Assistant" : "You"} -{" "}
                        {new Date(message.createdAt).toLocaleTimeString()}
                      </div>
                      <div style={{ lineHeight: 1.5 }}>{renderWithBold(message.content)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
