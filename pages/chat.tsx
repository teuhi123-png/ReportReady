import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Button from "../components/ui/Button";
import DashboardShell from "../components/DashboardShell";
import { clearSignedInEmail, readSignedInEmail } from "../lib/auth";

type ChatApiResponse = {
  ok?: boolean;
  handler?: string;
  received?: {
    question?: string;
  };
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
  const [selectedPdf, setSelectedPdf] = useState<UploadedPlan | null>(null);
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
        setSelectedPdf(first ?? null);
      } catch (error) {
        console.error("Failed to load latest uploaded PDF:", error);
        setSelectedFileName("No PDF selected");
        setSelectedPdf(null);
      }
    };

    void loadLatestUpload();
  }, [email, pdfFromQuery]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const pdfFileName = params.get("pdfFileName");
    const planName = params.get("name");
    const planUrl = params.get("planUrl");

    if (pdfFileName) {
      setPdfFromQuery(pdfFileName);
      setSelectedPdf((prev) => ({
        name: prev?.name ?? pdfFileName,
        url: prev?.url ?? "",
        pdfFileName,
      }));
    }
    if (planName) {
      setSelectedFileName(planName);
      setActivePlanName(planName);
    }
    if (planUrl) {
      setSelectedPdf((prev) => ({
        name: prev?.name ?? pdfFileName ?? planName ?? "Selected plan",
        url: planUrl,
        pdfFileName: prev?.pdfFileName ?? pdfFileName ?? undefined,
      }));
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
      if (!selectedPdf) {
        throw new Error("No plan selected. Go to Uploads and choose a PDF.");
      }
      if (!selectedPdf.url) {
        throw new Error("No plan URL available. Re-open the plan from Uploads.");
      }

      const question = input;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pdfUrl: selectedPdf?.url,
          question,
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

      const assistantText = data?.answer ?? data?.reply ?? data?.received?.question;
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
    if (!pdfFromQuery || !selectedPdf || !selectedPdf.url || isAsking || history.length > 0) return;

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
        const question = autoQuestion;

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pdfUrl: selectedPdf?.url,
            question,
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
  }, [pdfFromQuery, selectedPdf, isAsking, history.length]);

  function onLogout(): void {
    clearSignedInEmail();
    void router.push("/login?next=/chat");
  }

  return (
    <DashboardShell
      pageTitle="Plan Chat"
      email={email}
      statusText={isAsking ? "Analysing..." : "Ready"}
      actions={
        <>
          <Link href="/uploads">
            <Button variant="secondary">Go to Uploads</Button>
          </Link>
          <Button variant="secondary" onClick={onLogout}>
            Log out
          </Button>
        </>
      }
    >
      <div className="dashboard-grid">
        <aside className="card side-panel">
          <div className="card-body">
            <div className="panel-block">
              <div className="label">Selected PDF</div>
              <div className="panel-value">{selectedFileName}</div>
              {selectedPdf?.url ? (
                <Link
                  href={`/plans/${encodeURIComponent(selectedPdf.pdfFileName ?? selectedFileName)}?planUrl=${encodeURIComponent(selectedPdf.url)}&name=${encodeURIComponent(selectedFileName)}`}
                  className="panel-link"
                >
                  View Plan
                </Link>
              ) : null}
              {activePlanName ? <div className="muted">Analysing: {activePlanName}</div> : null}
            </div>
            <div className="panel-block">
              <div className="label">Status</div>
              <div className={`status-chip ${isAsking ? "status-active" : ""}`.trim()}>
                {isAsking ? loadingText : "Ready"}
              </div>
            </div>
            <div className="tips-box">
              <div className="label">Tips</div>
              <ul>
                <li>What are the key dimensions in this plan?</li>
                <li>Summarize structural notes and materials.</li>
                <li>List rooms and any labeled areas.</li>
              </ul>
            </div>
          </div>
        </aside>

        <section className="card chat-main">
          <div className="card-body chat-layout">
            {status ? <div className="alert-card">{status}</div> : null}

            <div className="chat-history">
              {history.length === 0 ? (
                <div className="muted">No messages yet.</div>
              ) : (
                history.map((entry) => (
                  <article
                    key={entry.id}
                    className={`chat-bubble ${entry.role === "assistant" ? "chat-assistant" : "chat-user"}`.trim()}
                  >
                    <div className="chat-meta">
                      {entry.role === "assistant" ? "Assistant" : "You"} ·{" "}
                      {new Date(entry.createdAt).toLocaleTimeString()}
                    </div>
                    <div>{renderWithBold(entry.content)}</div>
                  </article>
                ))
              )}
            </div>

            <div className="chat-input-wrap">
              <label className="input-field" htmlFor="chat-question">
                <div className="label">Question</div>
                <textarea
                  id="chat-question"
                  className="input chat-textarea"
                  rows={5}
                  placeholder="Ask about dimensions, notes, or plan details..."
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
              </label>
              <div className="chat-actions">
                <Link href="/uploads">
                  <Button variant="secondary">Go to Uploads</Button>
                </Link>
                <Button onClick={onAsk} loading={false} disabled={isAsking}>
                  Ask
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
