import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Button from "../components/ui/Button";
import DashboardShell from "../components/DashboardShell";
import { clearSignedInEmail, readSignedInEmail } from "../lib/auth";

let pdfjsLibCache: any = null;

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

function renderAssistantMessage(text: string): ReactNode {
  const match = text.match(/\s*\((Page\s+\d+)\)\s*$/i);
  if (!match) return renderWithBold(text);

  const pageRef = match[1];
  const body = text.replace(/\s*\((Page\s+\d+)\)\s*$/i, "").trim();
  return (
    <>
      {body ? renderWithBold(body) : null}{" "}
      <span className="page-ref">({pageRef})</span>
    </>
  );
}

function looksLikeJson(response: Response): boolean {
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.toLowerCase().includes("application/json");
}

async function renderFirstPageToCanvas(pdfUrl: string, canvas: HTMLCanvasElement): Promise<void> {
  const pdfjsLib = pdfjsLibCache ?? (await import("pdfjs-dist"));
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  pdfjsLibCache = pdfjsLib;

  const loadingTask = pdfjsLib.getDocument({ url: pdfUrl });
  const doc = await loadingTask.promise;
  const firstPage = await doc.getPage(1);
  const viewport = firstPage.getViewport({ scale: 1.15 });
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  await firstPage.render({ canvas, canvasContext: ctx, viewport }).promise;
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
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState("");
  const planCanvasRef = useRef<HTMLCanvasElement | null>(null);

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
      setPdfFromQuery(planUrl);
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

  useEffect(() => {
    if (!selectedPdf?.url || !planCanvasRef.current) return;
    let cancelled = false;

    const run = async () => {
      setViewerLoading(true);
      setViewerError("");
      try {
        await renderFirstPageToCanvas(selectedPdf.url, planCanvasRef.current as HTMLCanvasElement);
      } catch (error) {
        if (!cancelled) {
          setViewerError(error instanceof Error ? error.message : "Could not render plan preview.");
        }
      } finally {
        if (!cancelled) setViewerLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [selectedPdf?.url]);

  async function onAsk(prefilled?: string): Promise<void> {
    if (isAsking) return;
    const input = (prefilled ?? message).trim();
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
      <div className="chat-split">
        <aside className="card plan-preview-panel">
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
            <div className="plan-preview-wrap">
              {viewerError ? <div className="alert-card">{viewerError}</div> : null}
              {viewerLoading ? <div className="muted">Loading plan preview...</div> : null}
              {!selectedPdf?.url ? <div className="muted">No PDF selected.</div> : null}
              <canvas ref={planCanvasRef} className="plan-preview-canvas" />
            </div>
          </div>
        </aside>

        <section className="card chat-main chat-panel">
          <div className="card-body chat-layout">
            {status ? <div className="alert-card">{status}</div> : null}
            <div className="panel-block">
              <div className="label">Status</div>
              <div className={`status-chip ${isAsking ? "status-active" : ""}`.trim()}>
                {isAsking ? loadingText : "Ready"}
              </div>
            </div>

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
                    <div>
                      {entry.role === "assistant"
                        ? renderAssistantMessage(entry.content)
                        : renderWithBold(entry.content)}
                    </div>
                  </article>
                ))
              )}
            </div>

            <div className="chat-input-wrap">
              <div className="quick-actions">
                <button
                  type="button"
                  className="quick-action-btn"
                  onClick={() => {
                    const prompt = "Summarise this building plan.";
                    setMessage(prompt);
                    void onAsk(prompt);
                  }}
                  disabled={isAsking}
                >
                  Summarise Plan
                </button>
                <button
                  type="button"
                  className="quick-action-btn"
                  onClick={() => {
                    const prompt = "What materials are specified?";
                    setMessage(prompt);
                    void onAsk(prompt);
                  }}
                  disabled={isAsking}
                >
                  List Materials
                </button>
                <button
                  type="button"
                  className="quick-action-btn"
                  onClick={() => {
                    const prompt = "What structural details are included?";
                    setMessage(prompt);
                    void onAsk(prompt);
                  }}
                  disabled={isAsking}
                >
                  Find Structural Notes
                </button>
              </div>
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
                <Button onClick={() => void onAsk()} loading={false} disabled={isAsking}>
                  Ask
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
      <style jsx>{`
        .chat-split {
          display: grid;
          grid-template-columns: 3fr 2fr;
          gap: 16px;
          height: calc(100vh - 100px);
          overflow: hidden;
        }
        .plan-preview-panel,
        .chat-panel {
          height: calc(100vh - 100px);
          min-height: 0;
          overflow: hidden;
        }
        .plan-preview-panel .card-body {
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-height: 0;
          height: 100%;
          overflow: hidden;
        }
        .plan-preview-wrap {
          flex: 1;
          min-height: 0;
          border: 1px solid #1f2937;
          border-radius: 12px;
          background: #020617;
          overflow: auto;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 14px;
        }
        .plan-preview-canvas {
          width: 100%;
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          border: 1px solid #1f2937;
          background: white;
        }
        .page-ref {
          color: #94a3b8;
          font-size: 0.8em;
        }
        .chat-panel .card-body {
          height: 100%;
          overflow: auto;
        }
        .quick-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .quick-action-btn {
          border: 1px solid #334155;
          border-radius: 999px;
          background: #0f172a;
          color: #e5e7eb;
          padding: 0.35rem 0.75rem;
          font-size: 0.82rem;
          line-height: 1.2;
          cursor: pointer;
        }
        .quick-action-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        @media (max-width: 1024px) {
          .chat-split {
            grid-template-columns: 1fr;
            grid-template-rows: auto 1fr;
            height: auto;
            min-height: calc(100vh - 100px);
            overflow: visible;
          }
          .plan-preview-panel,
          .chat-panel {
            height: auto;
          }
          .plan-preview-wrap {
            min-height: 320px;
          }
        }
      `}</style>
    </DashboardShell>
  );
}
