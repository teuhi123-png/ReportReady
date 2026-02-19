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
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1.15 });
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
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
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [pendingSpeechSubmit, setPendingSpeechSubmit] = useState<string | null>(null);
  const [voiceRepliesEnabled, setVoiceRepliesEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showVoiceNotice, setShowVoiceNotice] = useState(false);
  const [speechUnlocked, setSpeechUnlocked] = useState(false);
  const planCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const speechFinalRef = useRef("");
  const messageRef = useRef("");
  const lastAutoSpokenMessageIdRef = useRef("");

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
    messageRef.current = message;
  }, [message]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const enabled = window.localStorage.getItem("voiceRepliesEnabled");
    if (enabled === "true") {
      setVoiceRepliesEnabled(true);
    }
  }, []);

  function isIOSDevice(): boolean {
    if (typeof window === "undefined") return false;
    const ua = window.navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
  }

  function prepareSpeechText(input: string): string {
    return input.replace(/\s+/g, " ").trim().slice(0, 2500);
  }

  function pickSpeechVoice(): SpeechSynthesisVoice | null {
    if (typeof window === "undefined" || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    const preferred = ["en-NZ", "en-AU", "en-GB", "en-US"];
    for (const lang of preferred) {
      const voice = voices.find((v) => v.lang?.toLowerCase().startsWith(lang.toLowerCase()));
      if (voice) return voice;
    }
    const fallback = voices.find((v) => v.lang?.toLowerCase().startsWith("en"));
    return fallback ?? null;
  }

  function stopSpeaking(): void {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }

  async function speakPremium(text: string) {

 try {

  const res = await fetch("/api/tts", {
   method: "POST",
   headers: { "Content-Type": "application/json" },
   body: JSON.stringify({ text }),
  });

  if (!res.ok) return;

  const blob = await res.blob();

  const url = URL.createObjectURL(blob);

  const audio = new Audio(url);

  audio.play();

 } catch {}

}

  function speakText(rawText: string, fromUserGesture = false): boolean {
    if (typeof window === "undefined" || !window.speechSynthesis) return false;
    const text = prepareSpeechText(rawText);
    if (!text) return false;

    if (fromUserGesture) {
      setSpeechUnlocked(true);
      setShowVoiceNotice(false);
    }

    if (!fromUserGesture && isIOSDevice() && !speechUnlocked) {
      setShowVoiceNotice(true);
      return false;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickSpeechVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    return true;
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const RecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!RecognitionCtor) return;

    const recognition = new RecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      speechFinalRef.current = "";
      setIsListening(true);
      setStatus("");
    };

    recognition.onresult = (event: any) => {
      let finals = speechFinalRef.current;
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) {
          finals = `${finals} ${transcript}`.trim();
        } else {
          interim = `${interim} ${transcript}`.trim();
        }
      }

      speechFinalRef.current = finals;
      const combined = `${finals} ${interim}`.trim();
      setMessage(combined);
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      setStatus(event?.error ? `Voice input error: ${event.error}` : "Voice input error.");
    };

    recognition.onend = () => {
      setIsListening(false);
      const transcript = (speechFinalRef.current || messageRef.current).trim();
      speechFinalRef.current = "";
      if (transcript) {
        setPendingSpeechSubmit(transcript);
      }
    };

    recognitionRef.current = recognition;
    setSpeechSupported(true);
  }, []);

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
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
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
      if (voiceRepliesEnabled) {
        speakPremium(assistantText);
      }

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
    if (!pendingSpeechSubmit || isAsking) return;
    const text = pendingSpeechSubmit.trim();
    setPendingSpeechSubmit(null);
    if (!text) return;
    void onAsk(text);
  }, [pendingSpeechSubmit, isAsking]);

  useEffect(() => {
    if (!voiceRepliesEnabled) return;
    const latest = history[history.length - 1];
    if (!latest || latest.role !== "assistant") return;
    if (lastAutoSpokenMessageIdRef.current === latest.id) return;
    lastAutoSpokenMessageIdRef.current = latest.id;
  }, [history, voiceRepliesEnabled, speechUnlocked]);

  function onMicToggle(): void {
    if (!speechSupported) {
      setStatus("Voice input is not supported on this browser.");
      return;
    }

    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (isListening) {
      recognition.stop();
      setIsListening(false);
      return;
    }

    speechFinalRef.current = "";
    setPendingSpeechSubmit(null);
    recognition.start();
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
        if (voiceRepliesEnabled) {
          speakPremium(assistantContent);
        }
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
              <div className="preview-main">
              {viewerError ? <div className="alert-card">{viewerError}</div> : null}
              {viewerLoading ? <div className="muted">Loading plan preview...</div> : null}
              {!selectedPdf?.url ? <div className="muted">No PDF selected.</div> : null}
              <canvas ref={planCanvasRef} className="plan-preview-canvas" />
              </div>
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
                    {entry.role === "assistant" ? (
                      <div className="bubble-actions">
                        <button
                          type="button"
                          className="view-in-plan-btn"
                          onClick={() => {
                            speakText(entry.content, true);
                          }}
                        >
                          🔊 Speak
                        </button>
                      </div>
                    ) : null}
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
              <div className="voice-toggle-row">
                <label className="voice-toggle-label">
                  <input
                    type="checkbox"
                    checked={voiceRepliesEnabled}
                    onChange={(event) => {
                      const enabled = event.target.checked;
                      setVoiceRepliesEnabled(enabled);
                      if (typeof window !== "undefined") {
                        window.localStorage.setItem("voiceRepliesEnabled", enabled ? "true" : "false");
                      }
                      if (enabled && isIOSDevice() && !speechUnlocked) {
                        setShowVoiceNotice(true);
                      }
                      if (!enabled) {
                        stopSpeaking();
                      }
                    }}
                  />
                  <span>Voice replies</span>
                </label>
                {showVoiceNotice ? (
                  <span className="voice-notice">On iPhone, tap Speak once to enable audio.</span>
                ) : null}
              </div>
              <div className="chat-actions">
                <Link href="/uploads">
                  <Button variant="secondary">Go to Uploads</Button>
                </Link>
                <button
                  type="button"
                  className={`mic-btn ${isListening ? "mic-btn-listening" : ""}`.trim()}
                  onClick={onMicToggle}
                  disabled={isAsking}
                  aria-label="Use voice input"
                  title="Use voice input"
                >
                  Mic
                </button>
                <Button onClick={() => void onAsk()} loading={false} disabled={isAsking}>
                  Ask
                </Button>
                {isSpeaking ? (
                  <button type="button" className="stop-speech-btn" onClick={stopSpeaking}>
                    Stop
                  </button>
                ) : null}
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
        .preview-main {
          flex: 1;
          min-width: 0;
          display: flex;
          justify-content: center;
          align-items: flex-start;
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
        .bubble-actions {
          margin-top: 8px;
        }
        .view-in-plan-btn {
          border: 1px solid #334155;
          border-radius: 999px;
          background: #0f172a;
          color: #93c5fd;
          padding: 0.25rem 0.7rem;
          font-size: 0.78rem;
          line-height: 1.2;
          cursor: pointer;
        }
        .chat-panel .card-body {
          height: 100%;
          overflow: auto;
        }
        .voice-toggle-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .voice-toggle-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #cbd5e1;
          font-size: 0.88rem;
        }
        .voice-notice {
          color: #94a3b8;
          font-size: 0.78rem;
        }
        .stop-speech-btn {
          border: 1px solid #ef4444;
          border-radius: 999px;
          background: rgba(127, 29, 29, 0.3);
          color: #fecaca;
          padding: 0.35rem 0.8rem;
          font-size: 0.82rem;
          line-height: 1.2;
          cursor: pointer;
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
        .mic-btn {
          border: 1px solid #334155;
          border-radius: 999px;
          background: #0f172a;
          color: #e5e7eb;
          padding: 0.45rem 0.9rem;
          font-size: 0.82rem;
          line-height: 1.2;
          cursor: pointer;
        }
        .mic-btn-listening {
          color: #fecaca;
          border-color: #ef4444;
          background: rgba(127, 29, 29, 0.4);
          animation: micPulse 1s ease-in-out infinite;
        }
        .mic-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        @keyframes micPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.35);
          }
          100% {
            box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
          }
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
