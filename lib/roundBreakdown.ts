import type { Lie, Round, Shot } from "../types/golf";
import { categorizeShot } from "./strokesGained";
import { getExpectedStrokes } from "./expectedStrokes";

export type ShotBreakdown = {
  id: string;
  shotNumber: number;
  category: "OTT" | "APP" | "ARG" | "PUTT";
  startLie: Lie;
  endLie: Lie;
  startDistanceM: number;
  endDistanceM: number;
  puttsCount?: number;
  expectedBefore: number | null;
  expectedAfter: number | null;
  strokesGained: number | null;
};

export type HoleBreakdown = {
  holeNumber: number;
  shots: ShotBreakdown[];
  totalStrokes: number;
  totalPenalties: number;
  totalSG: number;
};

export function buildRoundBreakdown(round: Round): HoleBreakdown[] {
  const byHole = new Map<number, Shot[]>();
  for (const shot of round.shots) {
    const list = byHole.get(shot.holeNumber) ?? [];
    list.push(shot);
    byHole.set(shot.holeNumber, list);
  }

  const holes: HoleBreakdown[] = [];
  for (const [holeNumber, shots] of Array.from(byHole.entries()).sort((a, b) => a[0] - b[0])) {
    const sorted = [...shots].sort((a, b) => a.shotNumber - b.shotNumber);
    const breakdownShots: ShotBreakdown[] = [];
    let totalSG = 0;
    let totalStrokes = 0;
    let totalPenalties = 0;

    for (const shot of sorted) {
      const isPutting = shot.startLie === "GREEN" && typeof shot.putts === "number";
      const puttsCount = isPutting ? shot.putts : undefined;
      const expectedBefore = getExpectedStrokes(shot.startLie, shot.startDistance);
      const expectedAfter = isPutting ? 0 : getExpectedStrokes(shot.endLie, shot.endDistance);

      let strokesGained: number | null = null;
      if (expectedBefore !== null && expectedAfter !== null) {
        const strokesUsed = isPutting
          ? (puttsCount ?? 1) + shot.penaltyStrokes
          : 1 + shot.penaltyStrokes;
        const raw = expectedBefore - expectedAfter - strokesUsed;
        strokesGained = Math.round(raw * 1000) / 1000;
        totalSG += strokesGained;
      }

      const category = isPutting ? "PUTT" : categorizeShot(shot);
      const entry: ShotBreakdown = {
        id: `${holeNumber}-${shot.shotNumber}`,
        shotNumber: shot.shotNumber,
        category,
        startLie: shot.startLie,
        endLie: shot.endLie,
        startDistanceM: shot.startDistance,
        endDistanceM: shot.endDistance,
        puttsCount,
        expectedBefore,
        expectedAfter,
        strokesGained,
      };

      breakdownShots.push(entry);
      totalStrokes += isPutting ? puttsCount ?? 1 : 1;
      totalPenalties += shot.penaltyStrokes || 0;
    }

    holes.push({
      holeNumber,
      shots: breakdownShots,
      totalStrokes: totalStrokes + totalPenalties,
      totalPenalties,
      totalSG,
    });
  }

  return holes;
}
