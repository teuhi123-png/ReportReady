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
  const [lastShotSummary, setLastShotSummary] = useState<string>("");
  const [showCustomPutts, setShowCustomPutts] = useState(false);
  const [customPutts, setCustomPutts] = useState<string>("");
  const [puttsCount, setPuttsCount] = useState<number | null>(null);
  const [saveNudge, setSaveNudge] = useState(false);
  const puttingMode = startLie === "GREEN";
  const endLieGreen = holed || endLie === "GREEN";

  const startDistanceRef = useRef<HTMLInputElement>(null);
  const endDistanceRef = useRef<HTMLInputElement>(null);
  const lastEndDistanceRef = useRef("");
  const [shotsExpanded, setShotsExpanded] = useState(false);
  const [expandedHoles, setExpandedHoles] = useState<Record<number, boolean>>({});
  const [keyboardOffsetPx, setKeyboardOffsetPx] = useState(0);

  const roundEnded = Boolean(round?.endedAt);
  const isEnded = roundEnded;

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.visualViewport) return;
    const viewport = window.visualViewport;
    const update = () => {
      const offset = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      );
      setKeyboardOffsetPx(offset);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  useEffect(() => {
    if (isEnded) return;
    if (!puttingMode) {
      const el = startDistanceRef.current;
      el?.focus();
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [startLie, puttingMode, isEnded]);

  useEffect(() => {
    if (isEnded) return;
    if (!endLieGreen && !puttingMode) {
      const el = endDistanceRef.current;
      el?.focus();
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [endLieGreen, puttingMode, isEnded]);

  useEffect(() => {
    if (!saveNudge) return;
    const t = setTimeout(() => setSaveNudge(false), 900);
    return () => clearTimeout(t);
  }, [saveNudge]);

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
    putts: (puttingMode || endLieGreen) && puttsCount ? puttsCount : undefined,
  };

  const previewSg = useMemo(() => calculateStrokesGained(previewShot), [previewShot]);

  const targetHoles = round?.targetHoles ?? 18;
  const clampedHoleIndex = Math.min(Math.max(holeNumber - 1, 0), targetHoles - 1);
  const displayHole = (clampedHoleIndex % targetHoles) + 1;

  useEffect(() => {
    setHoleNumber((h) => Math.min(Math.max(h, 1), targetHoles));
  }, [targetHoles]);

  const roundComplete = holed && displayHole === targetHoles;
  const canSave =
    startDistance.trim() !== "" &&
    ((puttingMode || endLieGreen) ? puttsCount !== null : holed || endDistance.trim() !== "");
  const isFinalHole = holeNumber >= targetHoles;
  const finalHoleComplete = isFinalHole && isHoleComplete;

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

    const summaryStartUnit = previewShot.startLie === "GREEN" ? "ft" : "m";
    const summaryEndUnit = previewShot.endLie === "GREEN" ? "ft" : "m";
    const summary =
      puttingMode && puttsCount
        ? `Last shot: ${puttsCount} putt${puttsCount === 1 ? "" : "s"}`
        : previewShot.endLie === "GREEN" && previewShot.endDistance === 0
          ? `Last shot: ${previewShot.startDistance}${summaryStartUnit} → holed`
          : `Last shot: ${previewShot.startDistance}${summaryStartUnit} → ${previewShot.endDistance}${summaryEndUnit}`;
    setLastShotSummary(summary);

    if ((previewShot.endDistance === 0 || holed) && isFinalHole) {
      setShowEndRoundModal(true);
      setShowErrors(false);
      return;
    }

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
      setPuttsCount(null);
      setShowCustomPutts(false);
      setCustomPutts("");
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
      setPuttsCount(null);
      setShowCustomPutts(false);
      setCustomPutts("");
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

  function handleSavePutt(count: number): void {
    if (!roundId) return;
    if (roundEnded) return;
    if (isHoleComplete) return;

    const putts = Math.min(10, Math.max(1, count));
    const shot: Shot = {
      holeNumber,
      shotNumber: nextShotNumber,
      startLie: "GREEN",
      startDistance: startDistanceValue,
      endLie: "GREEN",
      endDistance: 0,
      penaltyStrokes,
      putts,
    };

    const updated = addShot(roundId, shot);
    if (updated) setRound(updated);

    setLastShotSummary(`Last shot: ${putts} putt${putts === 1 ? "" : "s"}`);
    setHoleNumber((h) => Math.min(targetHoles, h + 1));
    setStartLie("TEE");
    setStartDistance("");
    setEndLie("FAIRWAY");
    setEndDistance("");
    setPenaltyStrokes(0);
    setHoled(false);
    setShowAdvanced(false);
    setNotes("");
    setShowErrors(false);
    setShowCustomPutts(false);
    setCustomPutts("");
    startDistanceRef.current?.focus();
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
            <div className="course-name">
              {round.courseName || "Unnamed course"} · Hole {displayHole} of {targetHoles}
            </div>
            {!roundEnded && (
              <div className="muted">
                Play mode
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

        <div
          className="container"
          style={{
            paddingBottom: 140 + keyboardOffsetPx,
          }}
        >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveShot();
          }}
        >
          <Card title="Shot entry">
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

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "flex-start",
              }}
            >
              <div style={{ minWidth: 160, flex: "1 1 180px" }}>
                <div className="label">FROM → TO</div>
                <PillToggleGroup<Lie>
                  options={LIES.map((lie) => ({ value: lie }))}
                  value={startLie}
                  onChange={(value) => {
                    if (isEnded) return;
                    setStartLie(value);
                    startDistanceRef.current?.focus();
                  }}
                  ariaLabel="Start lie"
                />
              </div>

              {!puttingMode && (
                <label className="input-field" style={{ minWidth: 120, flex: "1 1 120px" }}>
                  <div className="label">Start (m)</div>
                  <input
                    className="input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={3}
                    placeholder="e.g. 145"
                    value={startDistance ?? ""}
                    onChange={(e) => setStartDistance(clampDistanceText(e.target.value))}
                    onFocus={() =>
                      startDistanceRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
                    }
                    disabled={isEnded}
                    ref={startDistanceRef}
                    onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                  />
                  {startDistanceError && <div className="error">{startDistanceError}</div>}
                </label>
              )}

              <div style={{ minWidth: 160, flex: "1 1 160px" }}>
                <div className="label">TO</div>
                <PillToggleGroup<Lie>
                  options={LIES.map((lie) => ({ value: lie }))}
                  value={holed ? "GREEN" : endLie}
                  onChange={(value) => {
                    if (isEnded) return;
                    setEndLie(value);
                    if (holed) setHoled(false);
                    if (value === "GREEN") {
                      setPuttsCount(null);
                    } else {
                      setPuttsCount(null);
                      endDistanceRef.current?.focus();
                    }
                  }}
                  ariaLabel="End lie"
                />
              </div>

              {!puttingMode && !endLieGreen && (
                <label className="input-field" style={{ minWidth: 120, flex: "1 1 120px" }}>
                  <div className="label">End (m)</div>
                  <input
                    className="input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={3}
                    placeholder="e.g. 120"
                    value={endDistance ?? ""}
                    onChange={(e) => setEndDistance(clampDistanceText(e.target.value))}
                    onBlur={() => setSaveNudge(true)}
                    onFocus={() =>
                      endDistanceRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
                    }
                    disabled={isEnded}
                    ref={endDistanceRef}
                    onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                  />
                  {endDistanceError && <div className="error">{endDistanceError}</div>}
                </label>
              )}

              {(puttingMode || endLieGreen) && (
                <div style={{ minWidth: 200, flex: "1 1 200px" }}>
                  <div className="label">Putts</div>
                  <div className="pill-group">
                    {[1, 2, 3].map((count) => (
                      <button
                        key={`putt-${count}`}
                        type="button"
                        className="pill"
                        disabled={isEnded}
                        onClick={() => {
                          setPuttsCount(count);
                          setHoled(true);
                          setEndLie("GREEN");
                          setEndDistance("0");
                        }}
                      >
                        {count}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="pill"
                      disabled={isEnded}
                      onClick={() => setShowCustomPutts((v) => !v)}
                    >
                      4+
                    </button>
                  </div>
                  {showCustomPutts && (
                    <div className="field-gap">
                      <label className="input-field">
                        <div className="label">Putts (4–10)</div>
                        <input
                          className="input"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={2}
                          placeholder="4"
                          value={customPutts}
                          onChange={(e) => setCustomPutts(clampDistanceText(e.target.value))}
                          disabled={isEnded}
                        />
                      </label>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          const parsed = parseDistance(customPutts);
                          const count = Math.min(10, Math.max(4, parsed || 4));
                          setPuttsCount(count);
                          setHoled(true);
                          setEndLie("GREEN");
                          setEndDistance("0");
                        }}
                        disabled={isEnded}
                      >
                        Use putts
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {!puttingMode && (
                <div className="pill-group" style={{ alignSelf: "flex-end" }}>
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

            {lastShotSummary && <div className="muted">{lastShotSummary}</div>}

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

            {(roundComplete || roundEnded) && <div className="muted">Round complete</div>}
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

        <Card title={`Shots (${round.shots.length})`}>
          <div className="muted">Shots list is available on Summary.</div>
        </Card>
      </div>

      <div
        className="mobile-action-bar"
        style={{ bottom: `calc(env(safe-area-inset-bottom) + ${keyboardOffsetPx}px)` }}
      >
        {isEnded ? (
          <Link href={`/summary/${round.id}`} className="pill">
            View summary
          </Link>
        ) : finalHoleComplete ? (
          <>
            <div className="pill-group">
              <button
                type="button"
                className={`pill ${penaltyStrokes === 0 ? "active" : ""}`.trim()}
                disabled={isEnded}
                onClick={() => setPenaltyStrokes(0)}
              >
                P0
              </button>
              <button
                type="button"
                className={`pill ${penaltyStrokes === 1 ? "active" : ""}`.trim()}
                disabled={isEnded}
                onClick={() => setPenaltyStrokes(1)}
              >
                P+1
              </button>
              <button
                type="button"
                className={`pill ${penaltyStrokes === 2 ? "active" : ""}`.trim()}
                disabled={isEnded}
                onClick={() => setPenaltyStrokes(2)}
              >
                P+2
              </button>
            </div>
            <Button type="button" onClick={handleEndRound}>
              Finish round
            </Button>
          </>
        ) : (
          <>
            <div className="pill-group">
              <button
                type="button"
                className={`pill ${penaltyStrokes === 0 ? "active" : ""}`.trim()}
                disabled={isEnded}
                onClick={() => setPenaltyStrokes(0)}
              >
                P0
              </button>
              <button
                type="button"
                className={`pill ${penaltyStrokes === 1 ? "active" : ""}`.trim()}
                disabled={isEnded}
                onClick={() => setPenaltyStrokes(1)}
              >
                P+1
              </button>
              <button
                type="button"
                className={`pill ${penaltyStrokes === 2 ? "active" : ""}`.trim()}
                disabled={isEnded}
                onClick={() => setPenaltyStrokes(2)}
              >
                P+2
              </button>
            </div>
            <Button
              type="button"
              onClick={handleSaveShot}
              disabled={roundComplete || !canSave || isHoleComplete || roundEnded}
              className={saveNudge ? "save-nudge" : undefined}
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
              {finalHoleComplete ? (
                <>
                  <div className="h2">Round Complete 🎉</div>
                  <div className="muted">Nice work — review your summary.</div>
                </>
              ) : (
                <>
                  <div className="h2">End round?</div>
                  <div className="muted">You won’t be able to add more shots.</div>
                </>
              )}
            </div>
            <div className="modal-footer">
              {!finalHoleComplete && (
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setShowEndRoundModal(false)}
                >
                  Cancel
                </Button>
              )}
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
