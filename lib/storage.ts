import type { Round, Shot } from "../types/golf";

const STORAGE_KEY = "strokes-gained-rounds";
const MIGRATION_KEY_GREEN_FEET = "strokes-gained-green-feet-v1";
const MIGRATION_KEY_GREEN_METERS = "strokes-gained-green-meters-v1";

function normalizeRound(round: Round): Round {
  const createdAt =
    typeof round.createdAt === "string" ? Date.parse(round.createdAt) : round.createdAt;
  return {
    ...round,
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    courseName: round.courseName,
    targetHoles: round.targetHoles ?? 18,
    shots: Array.isArray(round.shots)
      ? round.shots.map((shot) => ({
          ...shot,
          startDistance:
            (shot as Shot & { startDistanceM?: number }).startDistance ??
            (shot as Shot & { startDistanceM?: number }).startDistanceM ??
            0,
          endDistance:
            (shot as Shot & { endDistanceM?: number }).endDistance ??
            (shot as Shot & { endDistanceM?: number }).endDistanceM ??
            0,
        }))
      : [],
  };
}

function safeParse(json: string | null): Round[] {
  if (!json) return [];
  try {
    const data = JSON.parse(json) as Round[];
    if (!Array.isArray(data)) return [];
    return data.map((r) => normalizeRound(r));
  } catch {
    return [];
  }
}

function migrateGreenFeetToMetersIfNeeded(rounds: Round[]): Round[] {
  if (typeof window === "undefined") return rounds;
  if (window.localStorage.getItem(MIGRATION_KEY_GREEN_METERS)) return rounds;
  if (rounds.length === 0) {
    window.localStorage.setItem(MIGRATION_KEY_GREEN_METERS, "1");
    return rounds;
  }

  if (!window.localStorage.getItem(MIGRATION_KEY_GREEN_FEET)) {
    window.localStorage.setItem(MIGRATION_KEY_GREEN_METERS, "1");
    return rounds;
  }

  const converted = rounds.map((round) => ({
    ...round,
    shots: (round.shots ?? []).map((shot) => {
      const startDistance =
        shot.startLie === "GREEN"
          ? (shot.startDistance ?? 0) / 3.28084
          : shot.startDistance ?? 0;
      const endDistance =
        shot.endLie === "GREEN"
          ? (shot.endDistance ?? 0) / 3.28084
          : shot.endDistance ?? 0;
      return {
        ...shot,
        startDistance,
        endDistance,
      };
    }),
  }));

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(converted));
  window.localStorage.setItem(MIGRATION_KEY_GREEN_METERS, "1");
  window.localStorage.removeItem(MIGRATION_KEY_GREEN_FEET);
  return converted;
}

function loadRounds(): Round[] {
  if (typeof window === "undefined") return [];
  const rounds = safeParse(window.localStorage.getItem(STORAGE_KEY));
  return migrateGreenFeetToMetersIfNeeded(rounds);
}

function persistRounds(rounds: Round[]): void {
  if (typeof window === "undefined") return;
  const normalized = rounds.map((r) => normalizeRound(r));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

export function getRounds(): Round[] {
  return loadRounds();
}

export function saveRound(round: Round): void {
  const rounds = loadRounds();
  const idx = rounds.findIndex((r) => r.id === round.id);
  const normalized = normalizeRound(round);

  if (idx === -1) {
    rounds.unshift(normalized);
  } else {
    rounds[idx] = normalized;
  }

  persistRounds(rounds);
}

export function updateRound(updated: Round): void {
  const rounds = loadRounds();
  const idx = rounds.findIndex((r) => r.id === updated.id);
  if (idx === -1) return;
  rounds[idx] = normalizeRound(updated);
  persistRounds(rounds);
}

export function getRound(id: string): Round | undefined {
  return loadRounds().find((r) => r.id === id);
}

export function addShot(roundId: string, shot: Shot): Round | undefined {
  const rounds = loadRounds();
  const idx = rounds.findIndex((r) => r.id === roundId);
  if (idx === -1) return undefined;

  const round = rounds[idx];
  const shots = Array.isArray(round.shots) ? round.shots : [];
  const updated: Round = { ...round, shots: [...shots, shot] };

  rounds[idx] = updated;
  persistRounds(rounds);
  return updated;
}

export function undoLastShot(roundId: string): Round | undefined {
  const rounds = loadRounds();
  const idx = rounds.findIndex((r) => r.id === roundId);
  if (idx === -1) return undefined;

  const round = rounds[idx];
  const shots = Array.isArray(round.shots) ? round.shots : [];
  if (shots.length === 0) return { ...round, shots };

  const updated: Round = { ...round, shots: shots.slice(0, -1) };
  rounds[idx] = updated;
  persistRounds(rounds);
  return updated;
}

export function deleteRound(id: string): void {
  const rounds = loadRounds().filter((r) => r.id !== id);
  persistRounds(rounds);
}

export function clearRounds(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function endRound(roundId: string): Round | undefined {
  const rounds = loadRounds();
  const idx = rounds.findIndex((r) => r.id === roundId);
  if (idx === -1) return undefined;
  const round = rounds[idx];
  const updated: Round = { ...round, endedAt: Date.now() };
  rounds[idx] = updated;
  persistRounds(rounds);
  return updated;
}

export function exportRounds(): string {
  const rounds = loadRounds();
  return JSON.stringify(rounds, null, 2);
}

function isValidShot(value: unknown): value is Shot {
  if (!value || typeof value !== "object") return false;
  const shot = value as Shot & { startDistanceM?: number; endDistanceM?: number };
  const hasStart = typeof shot.startDistance === "number" || typeof shot.startDistanceM === "number";
  const hasEnd = typeof shot.endDistance === "number" || typeof shot.endDistanceM === "number";
  return (
    typeof shot.holeNumber === "number" &&
    typeof shot.shotNumber === "number" &&
    typeof shot.startLie === "string" &&
    hasStart &&
    typeof shot.endLie === "string" &&
    hasEnd &&
    typeof shot.penaltyStrokes === "number"
  );
}

function isValidRound(value: unknown): value is Round {
  if (!value || typeof value !== "object") return false;
  const round = value as Round;
  return (
    typeof round.id === "string" &&
    typeof round.createdAt !== "undefined" &&
    Array.isArray(round.shots) &&
    round.shots.every((shot) => isValidShot(shot))
  );
}

export function importRounds(json: string, mode: "merge" | "replace" = "merge"): Round[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return loadRounds();
  }

  if (!Array.isArray(parsed)) return loadRounds();

  const valid = parsed.filter((r) => isValidRound(r)) as Round[];
  if (valid.length === 0) return loadRounds();

  const normalized = valid.map((r) => normalizeRound(r));

  if (mode === "replace") {
    persistRounds(normalized);
    return normalized;
  }

  const existing = loadRounds();
  const byId = new Map<string, Round>();
  for (const round of existing) byId.set(round.id, round);
  for (const round of normalized) byId.set(round.id, round);

  const merged = Array.from(byId.values());
  persistRounds(merged);
  return merged;
}
