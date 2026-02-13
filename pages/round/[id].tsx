import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import type { Lie, Round, Shot } from "../../types/golf";
import { addShot, getRound, undoLastShot, updateRound } from "../../lib/storage";
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
  const [startDistance, setStartDistance] = useState(0);
  const [penaltyStrokes, setPenaltyStrokes] = useState(0);
  const [holed, setHoled] = useState(false);
  const [endLie, setEndLie] = useState<Lie>("FAIRWAY");
  const [endDistance, setEndDistance] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [notes, setNotes] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const puttingMode = startLie === "GREEN";

  const startDistanceRef = useRef<HTMLInputElement>(null);
  const endDistanceRef = useRef<HTMLInputElement>(null);
  const lastEndDistanceRef = useRef(0);
  const [shotsExpanded, setShotsExpanded] = useState(false);

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

  const previewShot: Shot = {
    holeNumber,
    shotNumber: nextShotNumber,
    startLie,
    startDistance,
    endLie: holed ? "GREEN" : endLie,
    endDistance: holed ? 0 : endDistance,
    penaltyStrokes,
  };

  const previewSg = useMemo(() => calculateStrokesGained(previewShot), [previewShot]);

  const roundComplete = holed && holeNumber === 18;
  const canSave = startDistance !== 0 && (holed || endDistance !== 0);
  const targetHoles = round?.targetHoles ?? 18;
  const roundEnded = Boolean(round?.endedAt);

  const startDistanceError =
    showErrors && startDistance === 0 ? "Enter a start distance" : undefined;
  const endDistanceError =
    showErrors && !holed && endDistance === 0 ? "Enter an end distance" : undefined;
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
    holeNumber >= targetHoles && isHoleComplete && !roundEnded
      ? "Last hole complete — consider ending the round."
      : undefined;

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
      setHoleNumber((h) => Math.min(18, h + 1));
      setStartLie("TEE");
      setStartDistance(0);
      setEndLie("FAIRWAY");
      setEndDistance(0);
      setPenaltyStrokes(0);
      setHoled(false);
      setShowAdvanced(false);
      setNotes("");
      startDistanceRef.current?.focus();
    } else {
      const nextStartLie = previewShot.endLie;
      setStartLie(nextStartLie);
      setStartDistance(endDistance);
      setEndLie(nextStartLie === "GREEN" ? "GREEN" : "FAIRWAY");
      setEndDistance(0);
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
    if (!round) return;
    const ok = confirm("End round now?");
    if (!ok) return;
    const updated: Round = { ...round, endedAt: Date.now() };
    updateRound(updated);
    setRound(updated);
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
                Hole {holeNumber} of {targetHoles}
              </div>
            )}
          </div>
          <div className="nav-links header-actions">
            <Link href="/" className="pill">
              Back
            </Link>
            <Link href={`/summary/${round.id}`} className="pill">
              Summary
            </Link>
            <button type="button" className="pill" onClick={handleEndRound}>
              End round
            </button>
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
              <div className="stepper">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setHoleNumber(Math.max(1, holeNumber - 1))}
                >
                  −
                </Button>
                <div className="stepper-value">Hole {holeNumber}</div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setHoleNumber(Math.min(18, holeNumber + 1))}
                >
                  +
                </Button>
              </div>

              <div>
                <div className="label">From</div>
                <PillToggleGroup<Lie>
                  options={LIES.map((lie) => ({ value: lie }))}
                  value={startLie}
                  onChange={setStartLie}
                  ariaLabel="Start lie"
                />
                <div className="field-gap">
                  <Input
                    type="number"
                    label={startDistanceLabel}
                    placeholder={startPlaceholder}
                    value={startDistance}
                    onChange={(e) => setStartDistance(Number(e.target.value))}
                    inputRef={startDistanceRef}
                    error={startDistanceError}
                    helpText={startDistanceHelp}
                    onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                  />
                </div>
              </div>

              <div>
                <div className="label">To</div>
                {!puttingMode && (
                  <PillToggleGroup<Lie>
                    options={LIES.map((lie) => ({ value: lie }))}
                    value={holed ? "GREEN" : endLie}
                    onChange={(value) => {
                      setEndLie(value);
                      if (holed) setHoled(false);
                    }}
                    ariaLabel="End lie"
                  />
                )}
                <div className="field-gap">
                  {(!puttingMode || !holed) && (
                    <Input
                      type="number"
                      label={puttingMode ? "Leave distance (ft)" : endDistanceLabel}
                      placeholder={puttingMode ? "e.g. 3" : endPlaceholder}
                      value={endDistance}
                      onChange={(e) => setEndDistance(Number(e.target.value))}
                      inputRef={endDistanceRef}
                      error={endDistanceError}
                      helpText={endDistanceHelp}
                      onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                    />
                  )}
                </div>
                {puttingMode && (
                  <div className="holed-cta-wrap">
                    <button
                      type="button"
                      className={`pill pill-cta ${holed ? "active" : ""}`.trim()}
                      aria-pressed={holed}
                      onClick={() => {
                        const next = !holed;
                        setHoled(next);
                        setEndLie("GREEN");
                        if (next) {
                          lastEndDistanceRef.current = endDistance;
                          setEndDistance(0);
                        } else {
                          setEndDistance(lastEndDistanceRef.current || 0);
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
                      onClick={() => {
                        const next = !holed;
                        setHoled(next);
                        if (next) {
                          setEndLie("GREEN");
                          setEndDistance(0);
                        }
                      }}
                    >
                      Holed
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="field-gap">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="pill"
              >
                {showAdvanced ? "Hide advanced options" : "Advanced options"}
              </button>
            </div>

            {showAdvanced && (
              <div className="hero">
                <div>
                  <div className="label">Penalty strokes</div>
                  <div className="pill-group">
                    <button
                      type="button"
                      className={`pill ${penaltyStrokes === 1 ? "active" : ""}`.trim()}
                      onClick={() => setPenaltyStrokes(1)}
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      className={`pill ${penaltyStrokes === 2 ? "active" : ""}`.trim()}
                      onClick={() => setPenaltyStrokes(2)}
                    >
                      +2
                    </button>
                    <button type="button" className="pill" onClick={() => setPenaltyStrokes(0)}>
                      Clear
                    </button>
                  </div>
                </div>
                <label className="input-field">
                  <div className="label">Notes</div>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Optional notes about the shot"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
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
              <Button type="submit" disabled={roundComplete || !canSave || isHoleComplete || roundEnded}>
                Save shot
              </Button>
              <Button type="button" variant="secondary" onClick={handleUndo}>
                Undo last shot
              </Button>
              {roundComplete && <div className="muted">Round complete</div>}
            </div>
            {isHoleComplete && (
              <div className="field-gap">
                <div className="muted">Hole complete. Move to the next hole.</div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setHoleNumber((h) => Math.min(18, h + 1))}
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
                          <div key={`${shot.holeNumber}-${shot.shotNumber}`} className="shot-row score-row">
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
        <Button type="button" variant="secondary" onClick={handleUndo}>
          Undo last shot
        </Button>
        <Button type="button" onClick={handleSaveShot} disabled={roundComplete || !canSave || isHoleComplete || roundEnded}>
          Save shot
        </Button>
      </div>
    </div>
  );
}
