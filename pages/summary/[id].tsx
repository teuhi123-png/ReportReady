import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import type { Round, Shot } from "../../types/golf";
import { getRound } from "../../lib/storage";
import { calculateStrokesGained } from "../../lib/strokesGained";
import { baselineIsComplete, formatDistanceMeters, getExpectedStrokes } from "../../lib/expectedStrokes";
import Card from "../../components/ui/Card";
import StatChip from "../../components/ui/StatChip";
import { buildRoundBreakdown } from "../../lib/roundBreakdown";
import { withResolvedStartDistances } from "../../lib/shotSequence";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Totals = {
  OTT: number;
  APP: number;
  ARG: number;
  PUTT: number;
  TOTAL: number;
};

export default function SummaryPage() {
  const router = useRouter();
  const { id } = router.query;
  const roundId = typeof id === "string" ? id : "";

  const [round, setRound] = useState<Round | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!router.isReady || !roundId) return;
    const found = getRound(roundId);
    if (!found) {
      setNotFound(true);
      setRound(null);
    } else {
      setRound(found);
      setNotFound(false);
    }
  }, [router.isReady, roundId]);

  const resolvedShots = useMemo(() => {
    if (!round) return [] as Shot[];
    return withResolvedStartDistances(round.shots);
  }, [round]);

  const totals: Totals = useMemo(() => {
    const base: Totals = { OTT: 0, APP: 0, ARG: 0, PUTT: 0, TOTAL: 0 };
    if (!round) return base;

    for (const shot of resolvedShots) {
      const { sg, category, isValid } = calculateStrokesGained(shot);
      if (!isValid) continue;
      base[category] += sg ?? 0;
      base.TOTAL += sg ?? 0;
    }

    return base;
  }, [round, resolvedShots]);

  const totalStrokes = useMemo(() => {
    if (!round) return 0;
    return round.shots.reduce((sum, shot) => sum + (shot.putts ?? 1), 0);
  }, [round]);

  const totalPenalties = useMemo(() => {
    if (!round) return 0;
    return round.shots.reduce((sum, shot) => sum + (shot.penaltyStrokes || 0), 0);
  }, [round]);

  const adjustedScore = useMemo(() => {
    if (!round) return 0;
    return totalStrokes + totalPenalties;
  }, [round, totalPenalties, totalStrokes]);

  const hasInvalidBaseline = useMemo(() => {
    if (!round) return false;
    return resolvedShots.some((shot) => !calculateStrokesGained(shot).isValid);
  }, [round, resolvedShots]);

  const cumulativeData = useMemo(() => {
    if (!round) return [];
    let running = 0;
    return resolvedShots.map((shot, idx) => {
      const { sg, isValid } = calculateStrokesGained(shot);
      if (!isValid || sg === null)
        return { index: idx + 1, total: Number(running.toFixed(3)) };
      running += sg;
      return { index: idx + 1, total: Number(running.toFixed(3)) };
    });
  }, [round, resolvedShots]);

  const categoryData = useMemo(() => {
    return [
      { name: "OTT", value: Number(totals.OTT.toFixed(2)) },
      { name: "APP", value: Number(totals.APP.toFixed(2)) },
      { name: "ARG", value: Number(totals.ARG.toFixed(2)) },
      { name: "PUTT", value: Number(totals.PUTT.toFixed(2)) },
    ];
  }, [totals]);

  const categoryEntries = useMemo(() => {
    return [
      { label: "Tee shots", value: totals.OTT },
      { label: "Approach shots", value: totals.APP },
      { label: "Short game", value: totals.ARG },
      { label: "Putting", value: totals.PUTT },
    ];
  }, [totals]);

  const strength = useMemo(() => {
    if (categoryEntries.length === 0) return null;
    let best = categoryEntries[0];
    for (const entry of categoryEntries) {
      if (entry.value > best.value) best = entry;
    }
    if (best.value === 0) return null;
    return best;
  }, [categoryEntries]);

  const weakness = useMemo(() => {
    if (categoryEntries.length === 0) return null;
    let worst = categoryEntries[0];
    for (const entry of categoryEntries) {
      if (entry.value < worst.value) worst = entry;
    }
    if (worst.value === 0) return null;
    return worst;
  }, [categoryEntries]);

  const sanity = useMemo(() => {
    if (!round) return null;
    const byHole = new Map<number, Shot[]>();
    for (const shot of round.shots) {
      const list = byHole.get(shot.holeNumber) ?? [];
      list.push(shot);
      byHole.set(shot.holeNumber, list);
    }

    let expectedFromTeeTotal = 0;
    for (const shots of byHole.values()) {
      const firstShot = shots.find((s) => s.shotNumber === 1);
      if (!firstShot) continue;
      const exp = getExpectedStrokes(firstShot.startLie, firstShot.startDistance);
      if (exp !== null && !Number.isNaN(exp)) expectedFromTeeTotal += exp;
    }

    const actualStrokesTotal =
      round.shots.reduce((sum, s) => sum + (s.putts ?? 1), 0) +
      round.shots.reduce((sum, s) => sum + (s.penaltyStrokes || 0), 0);

    const delta = expectedFromTeeTotal - actualStrokesTotal;

    return {
      expectedFromTeeTotal,
      actualStrokesTotal,
      delta,
    };
  }, [round]);

  const keyMoments = useMemo(() => {
    if (!round) return { gains: [], losses: [] } as {
      gains: Array<{ label: string; sg: number }>;
      losses: Array<{ label: string; sg: number }>;
    };

    const entries: Array<{ label: string; sg: number }> = [];
    for (const shot of resolvedShots) {
      const { sg, isValid } = calculateStrokesGained(shot);
      if (!isValid || sg === null) continue;
      const label = `Hole ${shot.holeNumber}: ${shot.startLie} → ${shot.endLie}`;
      entries.push({ label, sg });
    }

    const gains = entries
      .filter((e) => e.sg > 0)
      .sort((a, b) => b.sg - a.sg)
      .slice(0, 2);
    const losses = entries
      .filter((e) => e.sg < 0)
      .sort((a, b) => a.sg - b.sg)
      .slice(0, 2);

    return { gains, losses };
  }, [round, resolvedShots]);

  const holeSummaries = useMemo(() => {
    if (!round) return [] as Array<{ hole: number; shots: number; penalties: number }>;
    const map = new Map<number, { shots: number; penalties: number }>();
    for (const shot of round.shots) {
      const entry = map.get(shot.holeNumber) ?? { shots: 0, penalties: 0 };
      entry.shots += shot.putts ?? 1;
      entry.penalties += shot.penaltyStrokes || 0;
      map.set(shot.holeNumber, entry);
    }
    return Array.from(map.entries())
      .map(([hole, data]) => ({ hole, shots: data.shots, penalties: data.penalties }))
      .sort((a, b) => a.hole - b.hole);
  }, [round]);

  const breakdown = useMemo(() => {
    if (!round) return [];
    return buildRoundBreakdown(round);
  }, [round]);

  const [expandedHoles, setExpandedHoles] = useState<Record<number, boolean>>({});
  const [expandedShots, setExpandedShots] = useState<Record<string, boolean>>({});

  if (!router.isReady) {
    return <div className="page">Loading...</div>;
  }

  if (notFound) {
    return (
      <div className="page">
        <div className="container">
          <div className="h1">Round not found</div>
          <Link href="/">Back home</Link>
        </div>
      </div>
    );
  }

  if (!round) {
    return <div className="page">Loading...</div>;
  }

  const created = new Date(round.createdAt).toLocaleString();

  return (
    <div className="page">
      <div className="container">
        <div className="top-row">
          <div>
            <div className="h1">Analysis</div>
            <div className="muted">{round.courseName || "Unnamed course"}</div>
            <div className="muted">{created} · {totalStrokes} shots</div>
          </div>
          <div className="nav-links">
            <Link href={`/round/${round.id}`} className="pill">
              Back
            </Link>
            <Link href="/" className="pill">
              Home
            </Link>
          </div>
        </div>

        {(!baselineIsComplete() || hasInvalidBaseline) && (
          <Card title="Baseline incomplete">
            <div className="muted">
              PGA baseline tables are incomplete. Add missing lie tables to enable accurate SG.
            </div>
          </Card>
        )}

        <Card title="Round Performance" subtitle="Strokes Gained vs PGA Tour">
          <div className="hero">
            <div
              className={`stat-total stat-total-xl ${
                totals.TOTAL >= 0 ? "sg-positive" : "sg-negative"
              }`}
            >
              {totals.TOTAL >= 0 ? "+" : ""}
              {totals.TOTAL.toFixed(2)}
            </div>
            <div
              className={`stat-subtitle ${totals.TOTAL >= 0 ? "text-positive" : "text-negative"}`}
            >
              {totals.TOTAL >= 0
                ? `You gained ${Math.abs(totals.TOTAL).toFixed(2)} shots on PGA Tour average.`
                : `You lost ${Math.abs(totals.TOTAL).toFixed(2)} shots to PGA Tour average.`}
            </div>
            <div className="stat-row">
              <StatChip value={totals.OTT} label="OTT" decimals={2} />
              <StatChip value={totals.APP} label="APP" decimals={2} />
              <StatChip value={totals.ARG} label="ARG" decimals={2} />
              <StatChip value={totals.PUTT} label="PUTT" decimals={2} />
            </div>
          </div>
        </Card>

        <Card title="Score">
          <div className="hero">
            <div className="stat-value">Score: {totalStrokes}</div>
            <div className="muted">Penalties: +{totalPenalties}</div>
            <div className="stat-value">Adjusted Score: {adjustedScore}</div>
          </div>
        </Card>

        <Card title="Primary Strength">
          {strength ? (
            <div className="hero">
              <div className="stat-total">{strength.label}</div>
              <div className="muted">
                {strength.value >= 0 ? "+" : ""}
                {strength.value.toFixed(2)} strokes
              </div>
            </div>
          ) : (
            <div className="muted">No clear strength this round.</div>
          )}
        </Card>

        <Card title="Primary Weakness">
          {weakness ? (
            <div className="hero">
              <div className="stat-total">{weakness.label}</div>
              <div className="muted">
                {weakness.value >= 0 ? "+" : ""}
                {weakness.value.toFixed(2)} strokes
              </div>
            </div>
          ) : (
            <div className="muted">No clear weakness this round.</div>
          )}
        </Card>

        <Card title="Key Moments">
          {keyMoments.gains.length === 0 && keyMoments.losses.length === 0 ? (
            <div className="muted">No key moments yet.</div>
          ) : (
            <div className="hero">
              {keyMoments.gains.map((moment) => (
                <div key={`gain-${moment.label}`} className="text-positive">
                  {moment.label} (+{moment.sg.toFixed(2)})
                </div>
              ))}
              {keyMoments.losses.map((moment) => (
                <div key={`loss-${moment.label}`} className="text-negative">
                  {moment.label} ({moment.sg.toFixed(2)})
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Cumulative SG">
          {cumulativeData.length === 0 ? (
            <div className="muted">No shots yet.</div>
          ) : (
            <div className="chart-wrap">
              <ResponsiveContainer>
                <LineChart data={cumulativeData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="index" tickLine={false} />
                  <YAxis tickLine={false} />
                  <Tooltip cursor={false} />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                    activeDot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="SG by category">
          <div className="chart-wrap">
            <ResponsiveContainer>
              <BarChart data={categoryData}>
                <defs>
                  <linearGradient id="barPositive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#16a34a" stopOpacity={0.9} />
                  </linearGradient>
                  <linearGradient id="barNegative" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f87171" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#dc2626" stopOpacity={0.9} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="name" tickLine={false} />
                <YAxis tickLine={false} />
                <Tooltip cursor={false} />
                <Bar
                  dataKey="value"
                  radius={[6, 6, 0, 0]}
                  activeBar={false}
                  isAnimationActive={false}
                >
                  {categoryData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.value >= 0 ? "url(#barPositive)" : "url(#barNegative)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Hole Summary">
          <div className="hero">
            {holeSummaries.length === 0 && <div className="muted">No holes yet.</div>}
            {holeSummaries.map((hole) => (
              <div key={`hole-summary-${hole.hole}`} className="muted">
                Hole {hole.hole}: {hole.shots} shots
                {hole.penalties > 0 ? ` +${hole.penalties}` : ""}
              </div>
            ))}
          </div>
        </Card>

        <Card title="Shot List">
          {breakdown.length === 0 ? (
            <div className="muted">No shots yet.</div>
          ) : (
            <div className="hero">
              {breakdown.map((hole) => {
                const open = Boolean(expandedHoles[hole.holeNumber]);
                return (
                  <div key={`shot-list-hole-${hole.holeNumber}`} className="field-gap">
                    <button
                      type="button"
                      className="pill"
                      onClick={() =>
                        setExpandedHoles((prev) => ({
                          ...prev,
                          [hole.holeNumber]: !prev[hole.holeNumber],
                        }))
                      }
                    >
                      Hole {hole.holeNumber} · {hole.totalStrokes} strokes ·{" "}
                      {hole.totalSG >= 0 ? "+" : ""}
                      {hole.totalSG.toFixed(2)} SG {open ? "▾" : "▸"}
                    </button>
                    {open && (
                      <div className="field-gap">
                        {hole.shots.map((shot) => {
                          const shotKey = `${hole.holeNumber}-${shot.shotNumber}`;
                          const expanded = Boolean(expandedShots[shotKey]);
                          return (
                            <div key={`shot-row-${shotKey}`} className="card">
                              <button
                                type="button"
                                className="row"
                                onClick={() =>
                                  setExpandedShots((prev) => ({
                                    ...prev,
                                    [shotKey]: !prev[shotKey],
                                  }))
                                }
                              >
                                <div>
                                  Shot {shot.shotNumber} · {shot.category}
                                </div>
                                <div className="muted">
                                  {formatDistanceMeters(shot.startDistanceM, shot.startLie)} →{" "}
                                  {formatDistanceMeters(shot.endDistanceM, shot.endLie)}
                                </div>
                                <div className="stat-value">
                                  {shot.strokesGained === null
                                    ? "SG —"
                                    : `${shot.strokesGained >= 0 ? "+" : ""}${shot.strokesGained.toFixed(
                                        2,
                                      )}`}
                                </div>
                              </button>
                              {expanded && (
                                <div className="hero">
                                  <div className="muted">
                                    Start: {shot.startLie} ·{" "}
                                    {formatDistanceMeters(shot.startDistanceM, shot.startLie)}
                                  </div>
                                  <div className="muted">
                                    End: {shot.endLie} ·{" "}
                                    {formatDistanceMeters(shot.endDistanceM, shot.endLie)}
                                  </div>
                                  {typeof shot.puttsCount === "number" && (
                                    <div className="muted">Putts: {shot.puttsCount}</div>
                                  )}
                                  {shot.expectedBefore !== null && (
                                    <div className="muted">
                                      Expected before: {shot.expectedBefore.toFixed(3)}
                                    </div>
                                  )}
                                  {shot.expectedAfter !== null && (
                                    <div className="muted">
                                      Expected after: {shot.expectedAfter.toFixed(3)}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {sanity && (
          <Card title="Round Context">
            <div className="hero">
              <div className="muted">
                PGA Expected: {sanity.expectedFromTeeTotal.toFixed(2)}
              </div>
              <div className="muted">
                Your Score: {sanity.actualStrokesTotal.toFixed(2)}
              </div>
              <div className="stat-value">
                Difference: {sanity.delta >= 0 ? "+" : ""}
                {sanity.delta.toFixed(2)}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
