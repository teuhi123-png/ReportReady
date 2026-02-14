import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import type { Lie, Round, Shot } from "../../types/golf";
import { addShot, endRound, getRound, undoLastShot } from "../../lib/storage";
import { calculateStrokesGained } from "../../lib/strokesGained";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import PillToggleGroup from "../../components/ui/PillToggleGroup";
import StatChip from "../../components/ui/StatChip";

const LIES: Lie[] = ["TEE", "FAIRWAY", "ROUGH", "BUNKER", "RECOVERY", "FRINGE", "GREEN"];

export default function RoundPage() {
  const router = useRouter();
  const { id } = router.query;
  const roundId = typeof id === "string" ? id : "";

  const [round, setRound] = useState<Round | null>(null);

  const [holeNumber, setHoleNumber] = useState(1);
  const [startLie, setStartLie] = useState<Lie>("TEE");
  const [startDistance, setStartDistance] = useState<string>("");
  const [penaltyStrokes, setPenaltyStrokes] = useState(0);
  const [holed, setHoled] = useState(false);
  const [endLie, setEndLie] = useState<Lie>("FAIRWAY");
  const [endDistance, setEndDistance] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [notes, setNotes] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [showEndRoundModal, setShowEndRoundModal] = useState(false);
  const puttingMode = startLie === "GREEN";

  const startDistanceRef = useRef<HTMLInputElement>(null);
  const endDistanceRef = useRef<HTMLInputElement>(null);
  const lastEndDistanceRef = useRef("");
  const [shotsExpanded, setShotsExpanded] = useState(false);
  const [expandedHoles, setExpandedHoles] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!router.isReady || !roundId) return;
    const found = getRound(roundId);
    setRound(found ?? null);
  }, [router.isReady, roundId]);

  useEffect(() => {
    if (!round) return;
    startDistanceRef.current?.focus();
  }, [round]);

  useEffect(() => {
    if (!puttingMode) return;
    setEndLie("GREEN");
  }, [puttingMode]);

  const nextShotNumber = useMemo(() => {
    if (!round) return 1;
    const inHole = round.shots.filter((s) => s.holeNumber === holeNumber).length;
    return inHole + 1;
  }, [round, holeNumber]);

  const isHoleComplete = useMemo(() => {
    if (!round) return false;
    return round.shots
      .filter((s) => s.holeNumber === holeNumber)
      .some((s) => s.endLie === "GREEN" && s.endDistance === 0);
  }, [round, holeNumber]);

  const clampDistanceText = (value: string): string => {
    const digits = value.replace(/\D/g, "");
    if (digits === "") return "";
    const n = Number.parseInt(digits, 10);
    const clamped = Math.min(600, Math.max(0, Number.isFinite(n) ? n : 0));
    return String(clamped);
  };

  const parseDistance = (value: string): number => {
    const digits = value.replace(/\D/g, "");
    if (digits === "") return 0;
    const n = Number.parseInt(digits, 10);
    if (!Number.isFinite(n)) return 0;
    return Math.min(600, Math.max(0, n));
  };

  const startDistanceValue = useMemo(() => {
    return parseDistance(startDistance);
  }, [startDistance]);

  const endDistanceValue = useMemo(() => {
    return parseDistance(endDistance);
  }, [endDistance]);

  const previewShot: Shot = {
    holeNumber,
    shotNumber: nextShotNumber,
    startLie,
    startDistance: startDistanceValue,
    endLie: holed ? "GREEN" : endLie,
    endDistance: holed ? 0 : endDistanceValue,
    penaltyStrokes,
  };

  const previewSg = useMemo(() => calculateStrokesGained(previewShot), [previewShot]);

  const targetHoles = round?.targetHoles ?? 18;
  const clampedHoleIndex = Math.min(Math.max(holeNumber - 1, 0), targetHoles - 1);
  const displayHole = (clampedHoleIndex % targetHoles) + 1;

  useEffect(() => {
    setHoleNumber((h) => Math.min(Math.max(h, 1), targetHoles));
  }, [targetHoles]);

  const roundComplete = holed && displayHole === targetHoles;
  const canSave = startDistance.trim() !== "" && (holed || endDistance.trim() !== "");
  const roundEnded = Boolean(round?.endedAt);
  const isEnded = roundEnded;

  const startDistanceError =
    showErrors && startDistance.trim() === "" ? "Enter a start distance" : undefined;
  const endDistanceError =
    showErrors && !holed && endDistance.trim() === "" ? "Enter an end distance" : undefined;
  const startDistanceLabel =
    startLie === "GREEN" ? "Start distance (ft)" : "Start distance (m)";
  const endDistanceLabel = endLie === "GREEN" ? "End distance (ft)" : "End distance (m)";
  const startDistanceHelp = startLie === "GREEN" ? "Putting distances in feet" : undefined;
  const endDistanceHelp = endLie === "GREEN" ? "Putting distances in feet" : undefined;
  const startPlaceholder = startLie === "GREEN" ? "e.g. 12" : "e.g. 145";
  const endPlaceholder = endLie === "GREEN" ? "e.g. 6" : "e.g. 20";
  const previewStartUnit = startLie === "GREEN" ? "ft" : "m";
  const previewEndUnit = (holed ? "GREEN" : endLie) === "GREEN" ? "ft" : "m";
  const endSuggestion =
    displayHole >= targetHoles && isHoleComplete && !roundEnded
      ? "Last hole complete — consider ending the round."
      : undefined;

  const shotsByHole = useMemo(() => {
    if (!round) return [] as Array<[number, Shot[]]>;
    const sorted = [...round.shots].sort((a, b) => {
      if (a.holeNumber !== b.holeNumber) return a.holeNumber - b.holeNumber;
      return a.shotNumber - b.shotNumber;
    });
    const map = new Map<number, Shot[]>();
    for (const shot of sorted) {
      const list = map.get(shot.holeNumber) ?? [];
      list.push(shot);
      map.set(shot.holeNumber, list);
    }
    return Array.from(map.entries());
  }, [round]);

  function handleSaveShot(): void {
    if (!roundId) return;
    if (roundEnded) return;
    if (isHoleComplete) return;
    if (!canSave) {
      setShowErrors(true);
      return;
    }

    const updated = addShot(roundId, previewShot);
    if (updated) setRound(updated);

    if (previewShot.endDistance === 0 || holed) {
      setHoleNumber((h) => Math.min(targetHoles, h + 1));
      setStartLie("TEE");
      setStartDistance("");
      setEndLie("FAIRWAY");
      setEndDistance("");
      setPenaltyStrokes(0);
      setHoled(false);
      setShowAdvanced(false);
      setNotes("");
      startDistanceRef.current?.focus();
    } else {
      const nextStartLie = previewShot.endLie;
      setStartLie(nextStartLie);
      setStartDistance(String(endDistanceValue));
      setEndLie(nextStartLie === "GREEN" ? "GREEN" : "FAIRWAY");
      setEndDistance("");
      setPenaltyStrokes(0);
      setHoled(false);
      setNotes("");
      if (nextStartLie === "GREEN") {
        endDistanceRef.current?.focus();
      } else {
        startDistanceRef.current?.focus();
      }
    }
    setShowErrors(false);
  }

  function handleUndo(): void {
    if (!roundId) return;
    const updated = undoLastShot(roundId);
    if (updated) setRound(updated);
  }

  function handleEndRound(): void {
    setShowEndRoundModal(true);
  }

  function confirmEndRound(): void {
    if (!roundId) return;
    const updated = endRound(roundId);
    if (updated) setRound(updated);
    setShowEndRoundModal(false);
    void router.push(`/summary/${roundId}`);
  }

  if (!round) {
    return <div className="page">Loading round...</div>;
  }

  return (
      <div className="page mobile-action-spacer">
        <div className="top-header">
          <div className="top-row container header-wrap">
            <div className="header-left">
              <div className="h1">Round entry</div>
              <div className="course-name">{round.courseName || "Unnamed course"}</div>
              {!roundEnded && (
                <div className="muted">
                  Hole {displayHole} of {targetHoles}
                </div>
              )}
              {roundEnded && <div className="badge">Round complete</div>}
            </div>
            <div className="nav-links header-actions">
              <Link href="/" className="pill">
                Back
              </Link>
              <Link href={`/summary/${round.id}`} className="pill">
                Summary
              </Link>
              {isEnded ? (
                <Link href={`/summary/${round.id}`} className="pill">
                  View summary
                </Link>
              ) : (
                <button type="button" className="pill" onClick={handleEndRound}>
                  End round
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="container">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveShot();
          }}
        >
          <Card title="Beginner mode" subtitle="Quick, guided shot entry">
            <div className="hero">
              {isEnded && (
                <div className="muted">Round complete. View summary for insights.</div>
              )}
              <div className="stepper">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isEnded}
                  onClick={() => setHoleNumber((h) => Math.max(1, h - 1))}
                >
                  −
                </Button>
                <div className="stepper-value">Hole {displayHole}</div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isEnded}
                  onClick={() => setHoleNumber((h) => Math.min(targetHoles, h + 1))}
                >
                  +
                </Button>
              </div>

              <div>
                <div className="label">From</div>
                <PillToggleGroup<Lie>
                  options={LIES.map((lie) => ({ value: lie }))}
                  value={startLie}
                  onChange={(value) => {
                    if (isEnded) return;
                    setStartLie(value);
                  }}
                  ariaLabel="Start lie"
                />
                <div className="field-gap">
                  <label className="input-field">
                    <div className="label">{startDistanceLabel}</div>
                    <input
                      className="input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={3}
                      placeholder="e.g. 145"
                      value={startDistance ?? ""}
                      onChange={(e) => setStartDistance(clampDistanceText(e.target.value))}
                      disabled={isEnded}
                      ref={startDistanceRef}
                      onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                    />
                    {startDistanceHelp && !startDistanceError && (
                      <div className="help">{startDistanceHelp}</div>
                    )}
                    {startDistanceError && <div className="error">{startDistanceError}</div>}
                  </label>
                </div>
              </div>

              <div>
                <div className="label">To</div>
                {!puttingMode && (
                  <PillToggleGroup<Lie>
                    options={LIES.map((lie) => ({ value: lie }))}
                    value={holed ? "GREEN" : endLie}
                    onChange={(value) => {
                      if (isEnded) return;
                      setEndLie(value);
                      if (holed) setHoled(false);
                    }}
                    ariaLabel="End lie"
                  />
                )}
                <div className="field-gap">
                  {(!puttingMode || !holed) && (
                    <label className="input-field">
                      <div className="label">
                        {puttingMode ? "Leave distance (ft)" : endDistanceLabel}
                      </div>
                      <input
                        className="input"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={3}
                        placeholder="e.g. 120"
                        value={endDistance ?? ""}
                        onChange={(e) => setEndDistance(clampDistanceText(e.target.value))}
                        disabled={isEnded}
                        ref={endDistanceRef}
                        onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                      />
                      {endDistanceHelp && !endDistanceError && (
                        <div className="help">{endDistanceHelp}</div>
                      )}
                      {endDistanceError && <div className="error">{endDistanceError}</div>}
                    </label>
                  )}
                </div>
                {puttingMode && (
                  <div className="holed-cta-wrap">
                    <button
                      type="button"
                      className={`pill pill-cta ${holed ? "active" : ""}`.trim()}
                      aria-pressed={holed}
                      disabled={isEnded}
                      onClick={() => {
                        const next = !holed;
                        setHoled(next);
                        setEndLie("GREEN");
                        if (next) {
                          lastEndDistanceRef.current = endDistance;
                          setEndDistance("0");
                        } else {
                          setEndDistance(lastEndDistanceRef.current || "");
                        }
                      }}
                    >
                      Holed
                    </button>
                  </div>
                )}
                {!puttingMode && (
                  <div className="pill-group field-gap">
                    <button
                      type="button"
                      className={`pill ${holed ? "active" : ""}`.trim()}
                      aria-pressed={holed}
                      disabled={isEnded}
                      onClick={() => {
                        const next = !holed;
                        setHoled(next);
                        if (next) {
                          setEndLie("GREEN");
                          setEndDistance("0");
                        }
                      }}
                    >
                      Holed
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="hero">
              <div>
                <div className="label">Penalty shots</div>
                <div className="pill-group">
                  <button
                    type="button"
                    className={`pill ${penaltyStrokes === 0 ? "active" : ""}`.trim()}
                    disabled={isEnded}
                    onClick={() => setPenaltyStrokes(0)}
                  >
                    0
                  </button>
                  <button
                    type="button"
                    className={`pill ${penaltyStrokes === 1 ? "active" : ""}`.trim()}
                    disabled={isEnded}
                    onClick={() => setPenaltyStrokes(1)}
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    className={`pill ${penaltyStrokes === 2 ? "active" : ""}`.trim()}
                    disabled={isEnded}
                    onClick={() => setPenaltyStrokes(2)}
                  >
                    +2
                  </button>
                </div>
              </div>
            </div>

            <div className="field-gap">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="pill"
                disabled={isEnded}
              >
                {showAdvanced ? "Hide more options" : "More options"}
              </button>
            </div>

            {showAdvanced && (
              <div className="hero">
                <label className="input-field">
                  <div className="label">Notes</div>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Optional notes about the shot"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={isEnded}
                  />
                </label>
                <div>
                  <div className="muted">Preview</div>
                  <div>
                    Hole {previewShot.holeNumber}, Shot {previewShot.shotNumber}
                  </div>
                  <div className="muted">
                    {previewShot.startLie} {previewShot.startDistance}
                    {previewStartUnit} → {previewShot.endLie} {previewShot.endDistance}
                    {previewEndUnit}
                  </div>
                  <div className="field-gap">
                    {previewSg.isValid ? (
                      <StatChip value={previewSg.sg ?? 0} label={previewSg.category} decimals={2} />
                    ) : (
                      <span className="muted">SG: —</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="action-bar field-gap">
              {isEnded ? (
                <Link href={`/summary/${round.id}`} className="pill">
                  View summary
                </Link>
              ) : (
                <>
                  <Button
                    type="submit"
                    disabled={roundComplete || !canSave || isHoleComplete || roundEnded}
                  >
                    Save shot
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleUndo}>
                    Undo last shot
                  </Button>
                </>
              )}
              {(roundComplete || roundEnded) && <div className="muted">Round complete</div>}
            </div>
            {isHoleComplete && (
              <div className="field-gap">
                <div className="muted">Hole complete. Move to the next hole.</div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setHoleNumber((h) => Math.min(targetHoles, h + 1))}
                >
                  Next hole
                </Button>
              </div>
            )}
            {endSuggestion && <div className="muted field-gap">{endSuggestion}</div>}
          </Card>
        </form>

        <Card
          title={`Shots (${round.shots.length})`}
          headerRight={
            <button
              type="button"
              className="pill"
              aria-expanded={shotsExpanded}
              onClick={() => setShotsExpanded((v) => !v)}
            >
              {shotsExpanded ? "Hide" : "Show"}
            </button>
          }
        >
          {shotsExpanded ? (
            <div className="shot-list">
              {shotsByHole.map(([hole, shots], idx) => (
                <div key={`hole-${hole}`} className={idx === 0 ? "" : "shot-group"}>
                  <button
                    type="button"
                    className="hole-toggle"
                    onClick={() =>
                      setExpandedHoles((prev) => ({
                        ...prev,
                        [hole]: !prev[hole],
                      }))
                    }
                    aria-expanded={expandedHoles[hole] ?? false}
                  >
                    Hole {hole} ({shots.length} shots){" "}
                    <span className="muted">{expandedHoles[hole] ? "▼" : "▶"}</span>
                  </button>
                  {(expandedHoles[hole] ?? false) && (
                    <div className="shot-list">
                      {shots.map((shot) => {
                        const { sg, category, isValid } = calculateStrokesGained(shot);
                        const startUnit = shot.startLie === "GREEN" ? "ft" : "m";
                        const endUnit = shot.endLie === "GREEN" ? "ft" : "m";
                        return (
                          <div
                            key={`${shot.holeNumber}-${shot.shotNumber}`}
                            className="shot-row score-row"
                          >
                            <div>
                              <div className="score-line">
                                {shot.startLie} → {shot.endLie}
                              </div>
                              <div className="muted">
                                {shot.startDistance}
                                {startUnit} → {shot.endDistance}
                                {endUnit}
                              </div>
                            </div>
                            <div className="score-meta">
                              {shot.penaltyStrokes > 0 && (
                                <span className="muted">Penalty +{shot.penaltyStrokes}</span>
                              )}
                              {isValid && sg !== null ? (
                                <>
                                  <StatChip value={sg} decimals={2} />
                                  <span className="chip">{category}</span>
                                </>
                              ) : (
                                <span className="muted">SG: —</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
              {round.shots.length === 0 && <div className="muted">No shots yet.</div>}
            </div>
          ) : (
            <div className="muted">Tap to expand shot list.</div>
          )}
        </Card>
      </div>

      <div className="mobile-action-bar">
        {isEnded ? (
          <Link href={`/summary/${round.id}`} className="pill">
            View summary
          </Link>
        ) : (
          <>
            <Button type="button" variant="secondary" onClick={handleUndo}>
              Undo last shot
            </Button>
            <Button
              type="button"
              onClick={handleSaveShot}
              disabled={roundComplete || !canSave || isHoleComplete || roundEnded}
            >
              Save shot
            </Button>
          </>
        )}
      </div>

      {showEndRoundModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-body">
              <div className="h2">End round?</div>
              <div className="muted">You won’t be able to add more shots.</div>
            </div>
            <div className="modal-footer">
              {(() => {
                console.log("EndRoundModal footer rendered");
                return null;
              })()}
              <Button
                variant="secondary"
                type="button"
                onClick={() => setShowEndRoundModal(false)}
              >
                Cancel
              </Button>
              <Button type="button" onClick={confirmEndRound}>
                View summary
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
