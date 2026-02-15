import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Round } from "../types/golf";
import { clearRounds, deleteRound, getRounds } from "../lib/storage";
import { calculateStrokesGained } from "../lib/strokesGained";
import { withResolvedStartDistances } from "../lib/shotSequence";

type Totals = {
  OTT: number;
  APP: number;
  ARG: number;
  PUTT: number;
  TOTAL: number;
};

type RoundWithTotals = {
  round: Round;
  totals: Totals;
};

const FILTERS = [5, 10, 20, "All"] as const;

type FilterValue = (typeof FILTERS)[number];

function sumTotals(shots: Round["shots"]): Totals {
  const base: Totals = { OTT: 0, APP: 0, ARG: 0, PUTT: 0, TOTAL: 0 };
  for (const shot of withResolvedStartDistances(shots)) {
    const { sg, category, isValid } = calculateStrokesGained(shot);
    if (!isValid || sg === null) continue;
    base[category] += sg;
    base.TOTAL += sg;
  }
  return base;
}

export default function DashboardPage() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [filter, setFilter] = useState<FilterValue>(10);

  useEffect(() => {
    setRounds(getRounds());
  }, []);

  const roundsWithTotals = useMemo<RoundWithTotals[]>(() => {
    return rounds.map((round) => ({ round, totals: sumTotals(round.shots) }));
  }, [rounds]);

  const sortedNewest = useMemo(() => {
    return [...roundsWithTotals].sort((a, b) => {
      const aTime = new Date(a.round.createdAt).getTime();
      const bTime = new Date(b.round.createdAt).getTime();
      return bTime - aTime;
    });
  }, [roundsWithTotals]);

  const filteredRounds = useMemo(() => {
    if (filter === "All") return sortedNewest;
    return sortedNewest.slice(0, filter);
  }, [sortedNewest, filter]);

  const aggregate = useMemo(() => {
    const base: Totals = { OTT: 0, APP: 0, ARG: 0, PUTT: 0, TOTAL: 0 };
    if (filteredRounds.length === 0) return { avg: base, best: 0, worst: 0 };

    for (const item of filteredRounds) {
      base.OTT += item.totals.OTT;
      base.APP += item.totals.APP;
      base.ARG += item.totals.ARG;
      base.PUTT += item.totals.PUTT;
      base.TOTAL += item.totals.TOTAL;
    }

    const count = filteredRounds.length;
    const avg: Totals = {
      OTT: base.OTT / count,
      APP: base.APP / count,
      ARG: base.ARG / count,
      PUTT: base.PUTT / count,
      TOTAL: base.TOTAL / count,
    };

    const totals = filteredRounds.map((r) => r.totals.TOTAL);
    const best = Math.max(...totals);
    const worst = Math.min(...totals);

    return { avg, best, worst };
  }, [filteredRounds]);

  const trend = useMemo(() => {
    const oldestFirst = [...filteredRounds].sort((a, b) => {
      const aTime = new Date(a.round.createdAt).getTime();
      const bTime = new Date(b.round.createdAt).getTime();
      return aTime - bTime;
    });

    const rows: { date: string; total: number; runningAvg: number }[] = [];
    let running = 0;
    oldestFirst.forEach((item, idx) => {
      running += item.totals.TOTAL;
      rows.push({
        date: new Date(item.round.createdAt).toLocaleString(),
        total: item.totals.TOTAL,
        runningAvg: running / (idx + 1),
      });
    });
    return rows;
  }, [filteredRounds]);

  function handleDelete(id: string): void {
    deleteRound(id);
    setRounds(getRounds());
  }

  function handleClearAll(): void {
    const ok = confirm("Clear all rounds? This cannot be undone.");
    if (!ok) return;
    clearRounds();
    setRounds(getRounds());
  }

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ marginTop: 0 }}>Dashboard</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div>Last N rounds:</div>
          {FILTERS.map((value) => (
            <button
              key={`filter-${value}`}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
            >
              {value}
            </button>
          ))}
          <button type="button" onClick={handleClearAll}>
            Clear all rounds
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 16, border: "1px solid #eee", padding: 12 }}>
        <div style={{ marginBottom: 8 }}>Aggregate (filtered)</div>
        <div>Avg OTT: {aggregate.avg.OTT.toFixed(2)}</div>
        <div>Avg APP: {aggregate.avg.APP.toFixed(2)}</div>
        <div>Avg ARG: {aggregate.avg.ARG.toFixed(2)}</div>
        <div>Avg PUTT: {aggregate.avg.PUTT.toFixed(2)}</div>
        <div>Avg TOTAL: {aggregate.avg.TOTAL.toFixed(2)}</div>
        <div>Best round TOTAL: {aggregate.best.toFixed(2)}</div>
        <div>Worst round TOTAL: {aggregate.worst.toFixed(2)}</div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>Rounds</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Date</th>
              <th align="left">Course</th>
              <th align="left">Shots</th>
              <th align="left">OTT</th>
              <th align="left">APP</th>
              <th align="left">ARG</th>
              <th align="left">PUTT</th>
              <th align="left">TOTAL</th>
              <th align="left">Links</th>
              <th align="left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRounds.map(({ round, totals }) => (
              <tr key={round.id}>
                <td>{new Date(round.createdAt).toLocaleString()}</td>
                <td>{round.courseName || "Unnamed course"}</td>
                <td>{round.shots.length}</td>
                <td>{totals.OTT.toFixed(2)}</td>
                <td>{totals.APP.toFixed(2)}</td>
                <td>{totals.ARG.toFixed(2)}</td>
                <td>{totals.PUTT.toFixed(2)}</td>
                <td>{totals.TOTAL.toFixed(2)}</td>
                <td>
                  <Link href={`/summary/${round.id}`}>Summary</Link> |{" "}
                  <Link href={`/round/${round.id}`}>Round</Link>
                </td>
                <td>
                  <button type="button" onClick={() => handleDelete(round.id)}>
                    Delete round
                  </button>
                </td>
              </tr>
            ))}
            {filteredRounds.length === 0 && (
              <tr>
                <td colSpan={10}>No rounds found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>Trend</div>
        {trend.map((row, idx) => (
          <div key={`trend-${idx}`}>
            {row.date} TOTAL {row.total >= 0 ? "+" : ""}
            {row.total.toFixed(2)} Running Avg {row.runningAvg >= 0 ? "+" : ""}
            {row.runningAvg.toFixed(2)}
          </div>
        ))}
        {trend.length === 0 && <div>No rounds in selection.</div>}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Link href="/">Home</Link>
      </div>
    </div>
  );
}
