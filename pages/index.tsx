import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  deleteRound,
  exportRounds,
  getRounds,
  importRounds,
  saveRound,
  updateRound,
} from "../lib/storage";
import type { Round } from "../types/golf";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { buildRoundBreakdown } from "../lib/roundBreakdown";

export default function Home() {
  const router = useRouter();
  const [course, setCourse] = useState("");
  const [targetHoles, setTargetHoles] = useState<9 | 18>(18);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [expandedActionsRoundId, setExpandedActionsRoundId] = useState<string | null>(null);

  useEffect(() => {
    setRounds(getRounds());
    if (typeof window !== "undefined") {
      const seen = window.localStorage.getItem("sg_onboarding_seen");
      if (!seen) setShowOnboarding(true);
    }
  }, []);

  function refreshRounds() {
    setRounds(getRounds());
  }

  function onStart() {
    const round: Round = {
      id: crypto.randomUUID(),
      courseName: course.trim() || undefined,
      createdAt: Date.now(),
      targetHoles,
      holes: targetHoles,
      shots: [],
    };

    saveRound(round);
    refreshRounds();
    setCourse("");
    void router.push(`/round/${round.id}`);
  }

  function markOnboardingSeen() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sg_onboarding_seen", "1");
    }
    setShowOnboarding(false);
  }

  function resetOnboarding() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("sg_onboarding_seen");
    }
    setShowOnboarding(true);
  }

  function onEdit(round: Round) {
    setEditingId(round.id);
    setEditingName(round.courseName ?? "");
  }

  function onSaveEdit(round: Round) {
    updateRound({
      ...round,
      courseName: editingName.trim() || undefined,
    });
    setEditingId(null);
    setEditingName("");
    refreshRounds();
  }

  function onDelete(id: string) {
    const ok = confirm("Delete this round? This cannot be undone.");
    if (!ok) return;
    deleteRound(id);
    refreshRounds();
  }

  function onExport() {
    const data = exportRounds();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "strokes-gained-rounds.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImport(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const updated = importRounds(text, "merge");
      setRounds(updated);
    };
    reader.readAsText(file);
  }

  const latestRound = rounds[0] ?? null;
  const latestSnapshot = useMemo(() => {
    if (!latestRound) return null;
    const totals = { OTT: 0, APP: 0, ARG: 0, PUTT: 0 };
    let hasValues = false;
    for (const hole of buildRoundBreakdown(latestRound)) {
      for (const shot of hole.shots) {
        if (shot.strokesGained === null) continue;
        totals[shot.category] += shot.strokesGained;
        hasValues = true;
      }
    }
    const totalSG = totals.OTT + totals.APP + totals.ARG + totals.PUTT;
    return { totals, totalSG, hasValues };
  }, [latestRound]);

  return (
    <main className="page">
      <div className="container">
        <section className="home-header">
          <div className="home-header-row">
            <div className="home-header-title">Strokes Gained</div>
            <div className="home-header-pill">Tour-level</div>
          </div>
          <div className="home-header-subtext">
            Track every shot and compare your round against Tour baselines.
          </div>
        </section>

        {latestRound && (
          <section className="card home-snapshot">
            <div className="card-body">
              <div className="label">Last Round</div>
              <div className="home-snapshot-headline">{latestRound.courseName || "Unnamed course"}</div>
              <div className="muted">{new Date(latestRound.createdAt).toLocaleString()}</div>
              <div className="home-snapshot-total">
                {latestSnapshot && latestSnapshot.totalSG >= 0 ? "+" : ""}
                {latestSnapshot ? latestSnapshot.totalSG.toFixed(2) : "—"}
              </div>
              <div className="muted home-snapshot-total-label">Total SG</div>
              <div className="home-snapshot-chips">
                {(["OTT", "APP", "ARG", "PUTT"] as const).map((cat) => (
                  <span key={`snapshot-${cat}`} className="home-snapshot-chip">
                    {cat}
                    {latestSnapshot?.hasValues ? ` ${latestSnapshot.totals[cat].toFixed(2)}` : ""}
                  </span>
                ))}
              </div>
              <div className="home-snapshot-actions">
                <Link href={`/summary/${latestRound.id}`}>
                  <Button>View Summary</Button>
                </Link>
                <Link href={`/round/${latestRound.id}`}>
                  <Button variant="secondary">Continue Round</Button>
                </Link>
              </div>
            </div>
          </section>
        )}

        <section className="card home-start-card">
          <div className="card-body">
            <div className="home-start-title">Start a new round</div>
            <div className="form-stack home-start-stack">
              <Input
                label="Course name"
                placeholder="Course name (optional)"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
              />
              <div>
                <div className="label">Round length</div>
                <div className="home-segmented">
                  <button
                    type="button"
                    className={`home-segment ${targetHoles === 9 ? "active" : ""}`.trim()}
                    onClick={() => setTargetHoles(9)}
                  >
                    9 holes
                  </button>
                  <button
                    type="button"
                    className={`home-segment ${targetHoles === 18 ? "active" : ""}`.trim()}
                    onClick={() => setTargetHoles(18)}
                  >
                    18 holes
                  </button>
                </div>
              </div>
              <Button className="home-start-button" onClick={onStart}>
                Start Round
              </Button>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="h2">Your Rounds</div>
          {rounds.length === 0 ? (
            <div className="muted">No rounds yet. Start your first round.</div>
          ) : (
            rounds.map((r) => (
              <div key={r.id} className="card round-card home-round-card">
                <div className="card-body">
                  {editingId === r.id ? (
                    <div className="form-stack home-round-edit-stack">
                      <Input
                        label="Course name"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                      />
                      <div className="actions">
                        <Button onClick={() => onSaveEdit(r)}>Save</Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setEditingId(null);
                            setEditingName("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="home-round-row">
                        <div className="home-round-meta">
                          <div className="round-title">{r.courseName || "Unnamed course"}</div>
                          <div className="muted">
                            {new Date(r.createdAt).toLocaleString()} · {r.shots.length} shots
                          </div>
                        </div>
                        <button
                          type="button"
                          className="pill home-round-actions-toggle"
                          aria-label="Toggle round actions"
                          aria-expanded={expandedActionsRoundId === r.id}
                          onClick={() =>
                            setExpandedActionsRoundId((prev) => (prev === r.id ? null : r.id))
                          }
                        >
                          ⋯
                        </button>
                      </div>
                      {expandedActionsRoundId === r.id && (
                        <div className="home-round-actions-grid">
                          <Link href={`/round/${r.id}`}>
                            <Button variant="secondary">Continue</Button>
                          </Link>
                          <Link href={`/summary/${r.id}`}>
                            <Button variant="secondary">Summary</Button>
                          </Link>
                          <Button variant="secondary" onClick={() => onEdit(r)}>
                            Edit
                          </Button>
                          <Button
                            variant="secondary"
                            className="btn-outline-danger"
                            onClick={() => onDelete(r.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </section>

        <section className="section">
          <details className="card">
            <summary className="settings-summary">Settings</summary>
            <div className="card-body">
              <div className="section">
                <div className="h2">Backup & restore</div>
                <div className="actions">
                  <Button variant="secondary" onClick={onExport}>
                    Export data
                  </Button>
                  <label className="pill">
                    Import data
                    <input
                      type="file"
                      accept="application/json"
                      onChange={(e) => onImport(e.target.files?.[0] ?? null)}
                      className="visually-hidden"
                    />
                  </label>
                </div>
                <div className="muted">
                  Import merges valid rounds by id and ignores invalid entries.
                </div>
              </div>
              <div className="section">
                <div className="h2">Onboarding</div>
                <div className="actions">
                  <Button variant="secondary" onClick={resetOnboarding}>
                    Reset onboarding
                  </Button>
                </div>
              </div>
            </div>
          </details>
        </section>
      </div>

      {showOnboarding && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="h2">Welcome</div>
            <ul className="onboarding-list">
              <li>Create a round</li>
              <li>Enter shots: From → To, toggle Holed when in</li>
              <li>View Summary for insights</li>
            </ul>
            <div className="actions">
              <Button
                onClick={() => {
                  onStart();
                  markOnboardingSeen();
                }}
              >
                Start a round
              </Button>
              <Button variant="secondary" onClick={markOnboardingSeen}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
