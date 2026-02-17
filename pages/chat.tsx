import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Button from "../components/ui/Button";
import { clearSignedInEmail, readSignedInEmail } from "../lib/auth";

type ChatApiResponse = {
  ok?: boolean;
  answer?: string;
  reply?: string;
  error?: string;
};

type UploadedPlan = {
  name: string;
  pdfFileName?: string;
  pdfKey?: string;
  pathname?: string;
  uploadedAt?: string;
  projectName?: string;
  url: string;
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

function looksLikeJson(response: Response): boolean {
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.toLowerCase().includes("application/json");
}

export default function ChatPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [tick, setTick] = useState(0);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [selectedFileName, setSelectedFileName] = useState("No PDF selected");
  const [selectedPdf, setSelectedPdf] = useState("");
  const [activePlanName, setActivePlanName] = useState("");
  const [pdfFromQuery, setPdfFromQuery] = useState("");

  useEffect(() => {
    const signedInEmail = readSignedInEmail();
    if (!signedInEmail) {
      void router.replace(`/login?next=${encodeURIComponent("/chat")}`);
      return;
    }
    setEmail(signedInEmail);
  }, [router]);

  useEffect(() => {
    if (!email) return;

    const loadLatestUpload = async () => {
      if (pdfFromQuery) return;

      try {
        const response = await fetch(`/api/uploads?userEmail=${encodeURIComponent(email)}`);
        const raw = await response.text();
        let parsed: { files?: UploadedPlan[]; error?: string } | null = null;
        if (looksLikeJson(response)) {
          try {
            parsed = raw ? (JSON.parse(raw) as { files?: UploadedPlan[]; error?: string }) : null;
          } catch {
            parsed = null;
          }
        }

        if (!response.ok) {
          throw new Error(parsed?.error || raw || "Could not load uploaded PDFs.");
        }

        const first = parsed?.files?.[0];
        setSelectedFileName(first?.name ?? "No PDF selected");
        setSelectedPdf(first?.pdfFileName ?? first?.name ?? "");
      } catch (error) {
        console.error("Failed to load latest uploaded PDF:", error);
        setSelectedFileName("No PDF selected");
        setSelectedPdf("");
      }
    };

    void loadLatestUpload();
  }, [email, pdfFromQuery]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const pdfFileName = params.get("pdfFileName");
    const planName = params.get("name");

    if (pdfFileName) {
      setPdfFromQuery(pdfFileName);
      setSelectedPdf(pdfFileName);
    }
    if (planName) {
      setSelectedFileName(planName);
      setActivePlanName(planName);
    }
  }, []);

  useEffect(() => {
    if (!isAsking) return;
    const interval = window.setInterval(() => {
      setTick((value) => value + 1);
    }, 320);
    return () => window.clearInterval(interval);
  }, [isAsking]);

  const loadingText = useMemo(() => loadingLabel(tick), [tick]);

  async function onAsk(): Promise<void> {
    if (isAsking) return;
    const input = message.trim();
    if (!input) {
      setStatus("Please enter a message.");
      return;
    }

    setIsAsking(true);
    setStatus("");
    setTick(0);

    try {
      const selectedPdfName = selectedPdf.trim();
      if (!selectedPdfName) {
        throw new Error("No plan selected. Go to Uploads and choose a PDF.");
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: input,
          pdfFileName: selectedPdf || selectedFileName,
          userEmail: email,
        }),
      });

      const contentType = (res.headers.get("content-type") || "").toLowerCase();
      const raw = await res.text();
      let data: ChatApiResponse | null = null;
      if (contentType.includes("application/json")) {
        try {
          data = raw ? (JSON.parse(raw) as ChatApiResponse) : null;
        } catch {
          data = null;
        }
      }

      if (!res.ok) {
        throw new Error(data?.error || raw || `HTTP ${res.status}`);
      }

      const assistantText = data?.answer ?? data?.reply;
      if (!assistantText) throw new Error("Empty response from server");

      setHistory((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: input,
          createdAt: Date.now(),
        },
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: assistantText,
          createdAt: Date.now(),
        },
      ]);
      setMessage("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      setStatus(message);
    } finally {
      setIsAsking(false);
    }
  }

  useEffect(() => {
    if (!pdfFromQuery || !selectedPdf || isAsking || history.length > 0) return;

    const autoQuestion = "Analyse this building plan and summarise key construction details.";
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: autoQuestion,
      createdAt: Date.now(),
    };

    const runAutoAnalysis = async () => {
      setHistory((prev) => [...prev, userMessage]);
      setIsAsking(true);
      setStatus("");
      setTick(0);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: autoQuestion,
            pdfFileName: selectedPdf || selectedFileName,
            userEmail: email,
          }),
        });

        const raw = await res.text();
        let payload: ChatApiResponse | null = null;
        if (raw) {
          try {
            payload = JSON.parse(raw) as ChatApiResponse;
          } catch {
            payload = null;
          }
        }

        if (!res.ok) {
          throw new Error(payload?.error ?? raw ?? `HTTP ${res.status}`);
        }

        const assistantContent = payload?.answer ?? payload?.reply ?? payload?.error ?? "Request failed";
        setHistory((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: assistantContent,
            createdAt: Date.now(),
          },
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Request failed";
        setStatus(message);
      } finally {
        setIsAsking(false);
      }
    };

    void runAutoAnalysis();
  }, [pdfFromQuery, selectedPdf, isAsking, history.length, email]);

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
                <p className="muted" style={{ margin: "6px 0 0" }}>
                  Selected PDF: {selectedFileName}
                </p>
                {activePlanName && (
                  <p className="muted" style={{ margin: "6px 0 0" }}>
                    Analysing: {activePlanName}
                  </p>
                )}
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
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
            </label>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button onClick={onAsk} loading={false} disabled={isAsking}>
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
