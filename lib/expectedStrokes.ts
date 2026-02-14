import type { Lie } from "../types/golf";

type Table = [number, number][];

type Baseline = Record<Lie, Table>;

const PGA_BASELINE: Baseline = {
  TEE: [
    [100, 2.92],
    [120, 2.99],
    [140, 2.97],
    [160, 2.99],
    [180, 3.05],
    [200, 3.12],
    [220, 3.17],
    [240, 3.25],
    [260, 3.45],
    [280, 3.65],
    [300, 3.71],
    [320, 3.79],
    [340, 3.86],
    [360, 3.92],
    [380, 3.96],
    [400, 3.99],
    [420, 4.02],
    [440, 4.08],
    [460, 4.17],
    [480, 4.28],
    [500, 4.41],
    [520, 4.54],
    [540, 4.65],
    [560, 4.74],
    [580, 4.79],
    [600, 4.82],
  ],
  FAIRWAY: [
    [20, 2.4],
    [40, 2.6],
    [60, 2.7],
    [80, 2.75],
    [100, 2.8],
    [120, 2.85],
    [140, 2.91],
    [160, 2.98],
    [180, 3.08],
    [200, 3.19],
    [220, 3.32],
    [240, 3.45],
    [260, 3.58],
    [280, 3.69],
    [300, 3.78],
    [320, 3.84],
    [340, 3.88],
    [360, 3.95],
    [380, 4.03],
    [400, 4.11],
    [420, 4.15],
    [440, 4.2],
    [460, 4.29],
    [480, 4.4],
    [500, 4.53],
    [520, 4.66],
    [540, 4.78],
    [560, 4.86],
    [580, 4.91],
    [600, 4.94],
  ],
  ROUGH: [
    [20, 2.59],
    [40, 2.78],
    [60, 2.91],
    [80, 2.96],
    [100, 3.02],
    [120, 3.08],
    [140, 3.15],
    [160, 3.23],
    [180, 3.31],
    [200, 3.42],
    [220, 3.53],
    [240, 3.64],
    [260, 3.74],
    [280, 3.83],
    [300, 3.9],
    [320, 3.95],
    [340, 4.02],
    [360, 4.11],
    [380, 4.21],
    [400, 4.3],
    [420, 4.34],
    [440, 4.39],
    [460, 4.48],
    [480, 4.59],
    [500, 4.72],
    [520, 4.85],
    [540, 4.97],
    [560, 5.05],
    [580, 5.1],
    [600, 5.13],
  ],
  BUNKER: [
    [20, 2.53],
    [40, 2.82],
    [60, 3.15],
    [80, 3.24],
    [100, 3.23],
    [120, 3.21],
    [140, 3.22],
    [160, 3.28],
    [180, 3.4],
    [200, 3.55],
    [220, 3.7],
    [240, 3.84],
    [260, 3.93],
    [280, 4.0],
    [300, 4.04],
    [320, 4.12],
    [340, 4.26],
    [360, 4.41],
    [380, 4.55],
    [400, 4.69],
    [420, 4.73],
    [440, 4.78],
    [460, 4.87],
    [480, 4.98],
    [500, 5.11],
    [520, 5.24],
    [540, 5.36],
    [560, 5.44],
    [580, 5.49],
    [600, 5.52],
  ],
  RECOVERY: [
    [100, 3.8],
    [120, 3.78],
    [140, 3.8],
    [160, 3.81],
    [180, 3.82],
    [200, 3.87],
    [220, 3.92],
    [240, 3.97],
    [260, 4.03],
    [280, 4.1],
    [300, 4.2],
    [320, 4.31],
    [340, 4.44],
    [360, 4.56],
    [380, 4.66],
    [400, 4.75],
    [420, 4.79],
    [440, 4.84],
    [460, 4.93],
    [480, 5.04],
    [500, 5.17],
    [520, 5.3],
    [540, 5.42],
    [560, 5.5],
    [580, 5.55],
    [600, 5.58],
  ],
  FRINGE: [],
  GREEN: [
    [3, 1.04],
    [4, 1.13],
    [5, 1.23],
    [6, 1.34],
    [7, 1.42],
    [8, 1.5],
    [9, 1.56],
    [10, 1.61],
    [15, 1.78],
    [20, 1.87],
    [30, 1.98],
    [40, 2.06],
    [50, 2.14],
    [60, 2.21],
    [90, 2.4],
  ],
};

const M_TO_FT = 3.28084;

export const metersToFeet = (m: number): number => m * M_TO_FT;

export const formatDistanceMeters = (m: number | null | undefined, lie?: Lie): string => {
  if (m == null || Number.isNaN(m)) return "";
  if (lie === "GREEN") return `${Number(m).toFixed(1)}m`;
  return `${Math.round(m)}m`;
};

export function baselineIsComplete(): boolean {
  return (
    PGA_BASELINE.TEE.length > 0 &&
    PGA_BASELINE.FAIRWAY.length > 0 &&
    PGA_BASELINE.ROUGH.length > 0 &&
    PGA_BASELINE.BUNKER.length > 0 &&
    PGA_BASELINE.RECOVERY.length > 0 &&
    PGA_BASELINE.GREEN.length > 0
  );
}

export const BASELINE_COMPLETE = baselineIsComplete();

function interpolate(points: Table, distance: number): number {
  if (distance <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (distance >= last[0]) return last[1];

  for (let i = 0; i < points.length - 1; i++) {
    const [d0, s0] = points[i];
    const [d1, s1] = points[i + 1];
    if (distance >= d0 && distance <= d1) {
      const t = (distance - d0) / (d1 - d0);
      return s0 + t * (s1 - s0);
    }
  }

  return last[1];
}

export function getExpectedStrokes(lie: Lie, distanceM: number): number | null {
  if (!Number.isFinite(distanceM) || distanceM <= 0) return 0;

  if (lie === "GREEN") {
    const greenPoints = PGA_BASELINE.GREEN;
    if (!greenPoints || greenPoints.length === 0) {
      console.warn("Missing PGA baseline table for lie: GREEN");
      return null;
    }
    const feet = metersToFeet(distanceM);
    return interpolate(greenPoints, feet);
  }

  const lookupLie = lie === "FRINGE" ? "FAIRWAY" : lie;
  const points = PGA_BASELINE[lookupLie];
  if (!points || points.length === 0) {
    if (lie !== "FRINGE") {
      console.warn(`Missing PGA baseline table for lie: ${lie}`);
    }
    return null;
  }

  const yards = distanceM / 0.9144;
  return interpolate(points, yards);
}
