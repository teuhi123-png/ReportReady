import type { Shot } from "../types/golf";

function shotKey(shot: Pick<Shot, "holeNumber" | "shotNumber">): string {
  return `${shot.holeNumber}-${shot.shotNumber}`;
}

export function withResolvedStartDistances(shots: Shot[]): Shot[] {
  const resolvedStartByKey = new Map<string, number>();
  const byHole = new Map<number, Shot[]>();

  for (const shot of shots) {
    const list = byHole.get(shot.holeNumber) ?? [];
    list.push(shot);
    byHole.set(shot.holeNumber, list);
  }

  for (const holeShots of byHole.values()) {
    const sorted = [...holeShots].sort((a, b) => a.shotNumber - b.shotNumber);
    for (let idx = 0; idx < sorted.length; idx += 1) {
      const shot = sorted[idx];
      const previousShot = idx > 0 ? sorted[idx - 1] : null;
      const resolvedStartDistance = previousShot ? previousShot.endDistance : shot.startDistance;
      resolvedStartByKey.set(shotKey(shot), resolvedStartDistance);
    }
  }

  return shots.map((shot) => ({
    ...shot,
    startDistance: resolvedStartByKey.get(shotKey(shot)) ?? shot.startDistance,
  }));
}
