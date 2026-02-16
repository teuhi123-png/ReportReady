import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import type { Lie, Round, Shot } from "../../types/golf";
import { addShot, endRound, getRound, undoLastShot } from "../../lib/storage";
import { calculateStrokesGained, categorizeShot } from "../../lib/strokesGained";
import { formatDistanceMeters } from "../../lib/expectedStrokes";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import PillToggleGroup from "../../components/ui/PillToggleGroup";
import StatChip from "../../components/ui/StatChip";

const LIES: Lie[] = ["FAIRWAY", "ROUGH", "BUNKER", "RECOVERY", "FRINGE", "GREEN"];

function getSortedShotsForHole(round: Round, holeNumber: number): Shot[] {
  return round.shots
    .filter((s) => s.holeNumber === holeNumber)
    .sort((a, b) => a.shotNumber - b.shotNumber);
}

function isHoleFinished(shots: Shot[]): boolean {
  return shots.some((s) => s.endLie === "GREEN" && s.endDistance === 0);
}

function getResumeHole(round: Round): number {
  const targetHoles = round.targetHoles ?? 18;
  // Resume at the first incomplete hole based on saved shots.
  for (let hole = 1; hole <= targetHoles; hole += 1) {
    const shots = getSortedShotsForHole(round, hole);
    if (shots.length === 0) return hole;
    if (!isHoleFinished(shots)) return hole;
  }
  // All holes complete: keep user on the final hole instead of resetting to hole 1.
  return targetHoles;
}

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
  const [endLieSelection, setEndLieSelection] = useState<Lie | null>(null);
  const [endDistanceText, setEndDistanceText] = useState<string>("");
  const [endDistanceValue, setEndDistanceValue] = useState<number | null>(null);
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
  const endLieGreen = puttingMode && puttsCount !== null;

  const startDistanceRef = useRef<HTMLInputElement>(null);
  const endDistanceRef = useRef<HTMLInputElement>(null);
  const lastEndDistanceRef = useRef("");
  const [shotsExpanded, setShotsExpanded] = useState(false);
  const [expandedHoles, setExpandedHoles] = useState<Record<number, boolean>>({});

  const roundEnded = Boolean(round?.endedAt);
  const isEnded = roundEnded;

  useEffect(() => {
    if (!router.isReady || !roundId) return;
    const found = getRound(roundId);
    setRound(found ?? null);
  }, [router.isReady, roundId]);

  useEffect(() => {
    if (!round) return;
    setHoleNumber(getResumeHole(round));
  }, [round?.id]);

  useEffect(() => {
    if (!round) return;
    startDistanceRef.current?.focus();
  }, [round]);

  useEffect(() => {
    if (!puttingMode) return;
    setEndLieSelection(null);
  }, [puttingMode]);

  const scrollInputIntoView = (el: HTMLElement | null): void => {
    if (!el) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      });
    });
  };

  const handleDistanceSubmit = (): void => {
    handleSaveShot();
  };

  useEffect(() => {
    if (isEnded) return;
    if (!puttingMode) {
      const el = startDistanceRef.current;
      el?.focus();
      scrollInputIntoView(el);
    }
  }, [startLie, puttingMode, isEnded]);

  useEffect(() => {
    if (isEnded) return;
    if (!endLieGreen && !puttingMode) {
      const el = endDistanceRef.current;
      el?.focus();
      scrollInputIntoView(el);
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

  const clampDistanceText = (value: string, allowDecimal: boolean): string => {
    if (!allowDecimal) {
      const digits = value.replace(/\D/g, "");
      if (digits === "") return "";
      const n = Number.parseInt(digits, 10);
      const clamped = Math.min(600, Math.max(0, Number.isFinite(n) ? n : 0));
      return String(clamped);
    }

    const cleaned = value.replace(/[^0-9.]/g, "");
    if (cleaned === "") return "";
    const parts = cleaned.split(".");
    const whole = parts[0] ?? "";
    const decimal = parts[1] ? parts[1].slice(0, 1) : "";
    const normalized = decimal.length > 0 ? `${whole}.${decimal}` : whole;
    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed)) return "";
    if (parsed > 600) return "600";
    return normalized;
  };

  const parseDistance = (value: string, allowDecimal: boolean): number => {
    if (!allowDecimal) {
      const digits = value.replace(/\D/g, "");
      if (digits === "") return 0;
      const n = Number.parseInt(digits, 10);
      if (!Number.isFinite(n)) return 0;
      return Math.min(600, Math.max(0, n));
    }
    const cleaned = value.replace(/[^0-9.]/g, "");
    if (cleaned === "") return 0;
    const parsed = Number.parseFloat(cleaned);
    if (!Number.isFinite(parsed)) return 0;
    return Math.min(600, Math.max(0, parsed));
  };

  const startDistanceValue = useMemo(() => {
    return parseDistance(startDistance, startLie === "GREEN");
  }, [startDistance, startLie]);

  const isFirstShotOfHole = nextShotNumber === 1;
  const holeShots = useMemo(() => {
    if (!round) return [];
    return round.shots.filter((s) => s.holeNumber === holeNumber);
  }, [round, holeNumber]);
  const lastShotInHole = holeShots.length > 0 ? holeShots[holeShots.length - 1] : null;
  const currentStartDistance =
    holeShots.length > 0 ? lastShotInHole?.endDistance ?? 0 : startDistanceValue;
  const puttingStartDistance =
    endDistanceValue !== null ? endDistanceValue : lastShotInHole?.endDistance ?? 0;

  const endLieForShot = puttingMode
    ? "GREEN"
    : holeShots.length === 0
      ? endLieSelection ?? "FAIRWAY"
      : endLieSelection ?? "FAIRWAY";
  const endDistanceForShot = puttingMode ? 0 : (endDistanceValue ?? 0);

  const previewShot: Shot = {
    holeNumber,
    shotNumber: nextShotNumber,
    startLie: holeShots.length === 0 ? "TEE" : startLie,
    startDistance:
      holeShots.length === 0
        ? startDistanceValue
        : puttingMode
          ? puttingStartDistance
          : currentStartDistance,
    endLie: endLieForShot,
    endDistance: endDistanceForShot,
    penaltyStrokes,
    putts: puttingMode && puttsCount ? puttsCount : undefined,
  };

  const previewSg = useMemo(() => calculateStrokesGained(previewShot), [previewShot]);

  const targetHoles = round?.targetHoles ?? 18;
  const clampedHoleIndex = Math.min(Math.max(holeNumber - 1, 0), targetHoles - 1);
  const displayHole = (clampedHoleIndex % targetHoles) + 1;

  useEffect(() => {
    setHoleNumber((h) => Math.min(Math.max(h, 1), targetHoles));
  }, [targetHoles]);

  useEffect(() => {
    if (!round) return;
    const sortedHoleShots = round.shots
      .filter((s) => s.holeNumber === holeNumber)
      .sort((a, b) => a.shotNumber - b.shotNumber);
    const lastShot = sortedHoleShots.length > 0 ? sortedHoleShots[sortedHoleShots.length - 1] : null;
    const prevHole = holeNumber > 1 ? holeNumber - 1 : null;
    const prevHoleShots =
      prevHole !== null
        ? round.shots
            .filter((s) => s.holeNumber === prevHole)
            .sort((a, b) => a.shotNumber - b.shotNumber)
        : [];
    const lastShotPrevHole =
      prevHoleShots.length > 0 ? prevHoleShots[prevHoleShots.length - 1] : null;
    // Resume start context from the last saved shot in this hole when available.
    if (lastShot) {
      setStartLie(lastShot.endLie);
      setStartDistance(String(lastShot.endDistance));
    } else if (lastShotPrevHole && lastShotPrevHole.endDistance > 0) {
      setStartLie(lastShotPrevHole.endLie);
      setStartDistance(String(lastShotPrevHole.endDistance));
    } else {
      setStartLie("TEE");
      setStartDistance("");
    }
    setEndDistanceText("");
    setEndDistanceValue(null);
    setEndLieSelection(null);
    setCustomPutts("");
    setPuttsCount(null);
    setShowCustomPutts(false);
    setHoled(false);
    setShowErrors(false);
    setNotes("");
    setLastShotSummary("");
  }, [holeNumber, round?.id]);

  const roundComplete = previewShot.endDistance === 0 && displayHole === targetHoles;
  const canSave =
    (holeShots.length === 0 ? startDistance.trim() !== "" : true) &&
    (puttingMode ? puttsCount !== null : endDistanceValue !== null && endLieSelection !== null);
  const isFinalHole = holeNumber >= targetHoles;
  const finalHoleComplete = isFinalHole && isHoleComplete;

  const startDistanceError =
    showErrors && startDistance.trim() === "" ? "Enter a start distance" : undefined;
  const endDistanceError =
    showErrors && endDistanceValue === null && !puttingMode ? "Enter an end distance" : undefined;
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

  const totalStrokes = useMemo(() => {
    if (!round) return 0;
    return round.shots.reduce((sum, shot) => sum + (shot.putts ?? 1), 0);
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

    const summary =
      puttingMode && puttsCount
        ? `Last shot: ${puttsCount} putt${puttsCount === 1 ? "" : "s"}`
        : previewShot.endLie === "GREEN" && previewShot.endDistance === 0
          ? `Last shot: ${formatDistanceMeters(previewShot.startDistance, previewShot.startLie)} → holed`
          : `Last shot: ${formatDistanceMeters(
              previewShot.startDistance,
              previewShot.startLie,
            )} → ${formatDistanceMeters(previewShot.endDistance, previewShot.endLie)}`;
    setLastShotSummary(summary);
    setEndDistanceText("");
    setEndDistanceValue(null);

    if (previewShot.endDistance === 0 && isFinalHole) {
      setShowEndRoundModal(true);
      setShowErrors(false);
      return;
    }

    if (previewShot.endDistance === 0) {
      setHoleNumber((h) => Math.min(targetHoles, h + 1));
      setStartLie("TEE");
      setEndLieSelection(null);
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
      setEndLieSelection(null);
      setPenaltyStrokes(0);
      setHoled(false);
      setNotes("");
      setPuttsCount(null);
      setShowCustomPutts(false);
      setCustomPutts("");
      endDistanceRef.current?.focus();
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
      startDistance: currentStartDistance,
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
    setEndLieSelection(null);
    setEndDistanceText("");
    setEndDistanceValue(null);
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

  const footer = (
    <div
      className="mobile-action-bar-shell"
    >
      <div className="mobile-action-bar">
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
    </div>
  );

  return (
      <div className="page round-sticky-page">
      <div className="round-main-content round-sticky-content">
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
            paddingBottom: 120,
          }}
        >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveShot();
          }}
        >
          <div className={`entry-card-wrap ${isHoleComplete ? "entry-card-complete" : ""}`.trim()}>
          <Card
            title="Shot entry"
            headerRight={
              <div className="entry-header-right">
                <span className="chip next-shot-chip">Shot {nextShotNumber}</span>
                {isHoleComplete && <span className="chip completed-chip">Completed</span>}
              </div>
            }
          >
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
                <div className="label">
                  {holeShots.length === 0
                    ? "START (m)"
                    : `BALL AT ${formatDistanceMeters(
                        puttingMode ? puttingStartDistance : currentStartDistance,
                        startLie,
                      )} · ${startLie}`}
                </div>
                {holeShots.length === 0 ? (
                  <label className="input-field">
                    <input
                      className="input"
                      type="text"
                      inputMode={startLie === "GREEN" ? "decimal" : "numeric"}
                      enterKeyHint="done"
                      pattern={startLie === "GREEN" ? "[0-9]*[.]?[0-9]*" : "[0-9]*"}
                      step={startLie === "GREEN" ? "0.1" : undefined}
                      maxLength={startLie === "GREEN" ? 5 : 3}
                      placeholder={startLie === "GREEN" ? "e.g. 9.1" : "e.g. 165"}
                      value={startDistance ?? ""}
                      onChange={(e) =>
                        setStartDistance(clampDistanceText(e.target.value, startLie === "GREEN"))
                      }
                      onFocus={() =>
                        scrollInputIntoView(startDistanceRef.current)
                      }
                      disabled={isEnded}
                      ref={startDistanceRef}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        handleDistanceSubmit();
                      }}
                      onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                    />
                    {startDistanceError && <div className="error">{startDistanceError}</div>}
                  </label>
                ) : puttingMode ? (
                  <PillToggleGroup<Lie>
                    options={[{ value: "GREEN" as Lie }]}
                    value={"GREEN"}
                    onChange={() => {}}
                    ariaLabel="Current lie"
                  />
                ) : null}
              </div>

              {!puttingMode && (
                <div style={{ minWidth: 160, flex: "1 1 160px" }}>
                  <div className="label">TO</div>
                  <PillToggleGroup<Lie>
                    options={LIES.map((lie) => ({ value: lie }))}
                    value={endLieSelection ?? undefined}
                    onChange={(value) => {
                      if (isEnded) return;
                      setEndLieSelection(value);
                      endDistanceRef.current?.focus();
                      scrollInputIntoView(endDistanceRef.current);
                    }}
                    ariaLabel="End lie"
                  />
                </div>
              )}

              {!puttingMode && (
                <label className="input-field" style={{ minWidth: 120, flex: "1 1 120px" }}>
                  <div className="label">End (m)</div>
                  <input
                    className="input"
                    type="text"
                    inputMode={endLieSelection === "GREEN" ? "decimal" : "numeric"}
                    enterKeyHint="done"
                    pattern={endLieSelection === "GREEN" ? "[0-9]*[.]?[0-9]*" : "[0-9]*"}
                    step={endLieSelection === "GREEN" ? "0.1" : undefined}
                    maxLength={endLieSelection === "GREEN" ? 5 : 3}
                    placeholder={endLieSelection === "GREEN" ? "e.g. 12.3" : "e.g. 120"}
                    value={endDistanceText ?? ""}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, "");
                      if (digitsOnly === "") {
                        setEndDistanceText("");
                        setEndDistanceValue(null);
                        return;
                      }
                      const parsed = Number.parseInt(digitsOnly, 10);
                      const clamped = Math.min(600, Math.max(0, Number.isFinite(parsed) ? parsed : 0));
                      setEndDistanceText(String(clamped));
                      setEndDistanceValue(clamped);
                    }}
                    onBlur={() => setSaveNudge(true)}
                    onFocus={() => scrollInputIntoView(endDistanceRef.current)}
                    disabled={isEnded}
                    ref={endDistanceRef}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      handleDistanceSubmit();
                    }}
                    onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                  />
                  {endDistanceError && <div className="error">{endDistanceError}</div>}
                </label>
              )}

              {puttingMode && (
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
                          setEndLieSelection("GREEN");
                          setHoled(true);
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
                          onChange={(e) =>
                            setCustomPutts(clampDistanceText(e.target.value, false))
                          }
                          onFocus={(e) => scrollInputIntoView(e.currentTarget)}
                          disabled={isEnded}
                        />
                      </label>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          const parsed = parseDistance(customPutts, false);
                          const count = Math.min(10, Math.max(4, parsed || 4));
                          setPuttsCount(count);
                          setEndLieSelection("GREEN");
                          setHoled(true);
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
                        setEndLieSelection("GREEN");
                        setEndDistanceText("0");
                        setEndDistanceValue(0);
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
                    {previewShot.startLie}{" "}
                    {formatDistanceMeters(previewShot.startDistance, previewShot.startLie)} →{" "}
                    {previewShot.endLie}{" "}
                    {formatDistanceMeters(previewShot.endDistance, previewShot.endLie)}
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
                  onClick={() => setHoleNumber((h) => Math.min(targetHoles, h + 1))}
                >
                  Next hole
                </Button>
              </div>
            )}
            {endSuggestion && <div className="muted field-gap">{endSuggestion}</div>}
          </Card>
          </div>
        </form>

        <Card title="Shots for this hole">
          {holeShots.length === 0 ? (
            <div className="muted">No saved shots for this hole yet.</div>
          ) : (
            <div className="shot-list locked-shots-list">
              {holeShots.map((shot) => (
                <div key={`locked-shot-${shot.holeNumber}-${shot.shotNumber}`} className="shot-row locked-shot-row">
                  <div className="score-row">
                    <div className="score-line">
                      Shot {shot.shotNumber} · {categorizeShot(shot)}
                    </div>
                    <span className="chip locked-chip">Locked</span>
                  </div>
                  <div className="muted">
                    {shot.startLie} {formatDistanceMeters(shot.startDistance, shot.startLie)} →{" "}
                    {shot.endLie} {formatDistanceMeters(shot.endDistance, shot.endLie)}
                  </div>
                  {typeof shot.putts === "number" && (
                    <div className="muted">Putts: {shot.putts}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title={`Round shots (${totalStrokes})`}>
          <div className="muted">View all holes on Summary.</div>
        </Card>
      </div>
      {footer}
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
