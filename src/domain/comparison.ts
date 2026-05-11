import type { Exercise, Set } from '@/db/schema';
import type { SessionView } from '@/db/queries/sessions';
import { exerciseVolume, topSet } from './volume';
import { estimate1RM } from './one-rep-max';

/**
 * Pure comparison engine for Plan 01-04's end-of-session report (D-02 a–f).
 *
 * Inputs: today's SessionView + the most recent prior identical-routine
 *         SessionView (or null = first time doing this routine).
 * Output: ExerciseComparison[] in TODAY's session order (D-02b), with explicit
 *         edge-case states (D-02e) and pre-computed deltas the UI just renders.
 *
 * Edge-case priority (highest first when multiple could apply):
 *   1. first-time     — prior session entirely absent, OR exercise not in prior
 *                       and no slot-swap detected
 *   2. swapped        — exercise not in prior BUT prior had a different
 *                       exercise at the same routine slot (position)
 *   3. stale          — prior > 14 days ago; deltas still computed
 *   4. renamed        — same canonical exercise.id but display_name differs
 *   5. normal         — none of the above
 *
 * Per-set deltas are aligned by position (the lead set per position only;
 * drop tiers are summed into volume but don't create phantom rows). This
 * matches research/PITFALLS.md Pitfall #5: per-position lead-set comparisons
 * are the meaningful comparison, not raw row indices.
 *
 * Pure function — no DB access, no React, no I/O. Phase 3 charts will reuse
 * this same engine over historical data without re-implementing the edge
 * cases.
 */

const STALE_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type EdgeCase =
  | { kind: 'normal' }
  | { kind: 'first-time' }
  | { kind: 'stale'; daysAgo: number }
  | { kind: 'renamed'; priorDisplayName: string }
  | { kind: 'swapped'; priorExerciseDisplayName: string };

export type ExerciseComparison = {
  exercise: Exercise;
  sessionExerciseId: string;
  todaySets: Set[];
  priorSets: Set[] | null;
  edgeCase: EdgeCase;
  /** null when first-time or swapped (no prior data to compare against). */
  headline: {
    todayTopSet: { weightKg: number; reps: number } | null;
    priorTopSet: { weightKg: number; reps: number } | null;
    weightDelta: number | null;
    repsDelta: number | null;
  } | null;
  /** null when first-time or swapped. Individual fields can still be null
   *  (e.g., e1rmDelta when reps fall outside Epley validity). */
  secondary: {
    workingWeightDelta: number | null;
    topSetRepsDelta: number | null;
    volumeDelta: number | null;
    e1rmDelta: number | null;
  } | null;
  perSetDeltas: Array<{
    position: number;
    today: { weightKg: number | null; reps: number | null } | null;
    prior: { weightKg: number | null; reps: number | null } | null;
  }>;
};

/** Mean weight across non-drop, non-deleted sets with non-null weight. Returns
 *  null when no qualifying sets (endurance, all-drop, or empty). */
function meanWorkingWeight(sets: Set[]): number | null {
  const candidates = sets.filter(
    (s) => !s.isDropTier && !s.isDeleted && s.weightKg != null,
  );
  if (candidates.length === 0) return null;
  const sum = candidates.reduce((acc, s) => acc + (s.weightKg ?? 0), 0);
  return sum / candidates.length;
}

/** Group sets by position, taking the FIRST non-drop set per position as the
 *  lead. Drop tiers and soft-deleted sets are excluded. */
function leadSetByPosition(sets: Set[]): Map<number, Set> {
  const map = new Map<number, Set>();
  for (const s of sets) {
    if (s.isDeleted || s.isDropTier) continue;
    if (!map.has(s.position)) map.set(s.position, s);
  }
  return map;
}

/** Epley e1RM with validity check inlined — returns null instead of throwing
 *  when reps fall outside the [1, 30] window we trust. Used only inside this
 *  module to make secondary delta computation null-safe. */
function safeE1RM(top: { weightKg: number; reps: number } | null): number | null {
  if (!top) return null;
  if (!Number.isInteger(top.reps) || top.reps < 1 || top.reps > 30) return null;
  if (top.weightKg < 0) return null;
  return estimate1RM(top.weightKg, top.reps);
}

export function compareSessions(
  today: SessionView,
  prior: SessionView | null,
): ExerciseComparison[] {
  const todayDate = new Date(today.session.startedAt);
  const priorDate = prior ? new Date(prior.session.startedAt) : null;
  const daysGap =
    priorDate !== null
      ? Math.floor((todayDate.getTime() - priorDate.getTime()) / MS_PER_DAY)
      : null;
  const isStale = daysGap !== null && daysGap > STALE_DAYS;

  // Build lookup of prior's session_exercises by canonical exercise id and by
  // routine-slot position. The id lookup drives the normal/renamed/stale paths;
  // the position lookup detects slot swaps when an exercise is missing from
  // the id lookup.
  const priorByExerciseId = new Map<string, SessionView['exercises'][number]>();
  const priorByPosition = new Map<number, SessionView['exercises'][number]>();
  if (prior) {
    for (const ex of prior.exercises) {
      priorByExerciseId.set(ex.exercise.id, ex);
      priorByPosition.set(ex.sessionExercise.position, ex);
    }
  }

  return today.exercises.map((todayEx): ExerciseComparison => {
    const priorEx = priorByExerciseId.get(todayEx.exercise.id) ?? null;

    // ─── Edge case detection ─────────────────────────────────────────────
    let edgeCase: EdgeCase;
    if (!prior) {
      edgeCase = { kind: 'first-time' };
    } else if (!priorEx) {
      // Exercise absent from prior. Check whether a DIFFERENT exercise held
      // the same routine slot last time → that's a swap.
      const priorAtSamePos = priorByPosition.get(todayEx.sessionExercise.position);
      if (priorAtSamePos && priorAtSamePos.exercise.id !== todayEx.exercise.id) {
        edgeCase = {
          kind: 'swapped',
          priorExerciseDisplayName: priorAtSamePos.exercise.displayName,
        };
      } else {
        edgeCase = { kind: 'first-time' };
      }
    } else if (isStale) {
      edgeCase = { kind: 'stale', daysAgo: daysGap! };
    } else if (priorEx.exercise.displayName !== todayEx.exercise.displayName) {
      edgeCase = { kind: 'renamed', priorDisplayName: priorEx.exercise.displayName };
    } else {
      edgeCase = { kind: 'normal' };
    }

    const todayTop = topSet(todayEx.sets);
    const priorTop = priorEx ? topSet(priorEx.sets) : null;

    // Skip headline + secondary when there's no prior data to compare against.
    // 'first-time' AND 'swapped' both map to "no comparable prior" — the UI
    // shows today's numbers without deltas.
    const hasComparablePrior =
      edgeCase.kind !== 'first-time' && edgeCase.kind !== 'swapped' && priorEx !== null;

    const headline = hasComparablePrior
      ? {
          todayTopSet: todayTop,
          priorTopSet: priorTop,
          weightDelta:
            todayTop && priorTop ? todayTop.weightKg - priorTop.weightKg : null,
          repsDelta: todayTop && priorTop ? todayTop.reps - priorTop.reps : null,
        }
      : null;

    let secondary: ExerciseComparison['secondary'] = null;
    if (hasComparablePrior && priorEx) {
      const todayWW = meanWorkingWeight(todayEx.sets);
      const priorWW = meanWorkingWeight(priorEx.sets);
      const todayVol = exerciseVolume(todayEx.sets);
      const priorVol = exerciseVolume(priorEx.sets);
      const todayE = safeE1RM(todayTop);
      const priorE = safeE1RM(priorTop);
      secondary = {
        workingWeightDelta:
          todayWW !== null && priorWW !== null ? todayWW - priorWW : null,
        topSetRepsDelta:
          todayTop && priorTop ? todayTop.reps - priorTop.reps : null,
        volumeDelta: todayVol - priorVol,
        e1rmDelta: todayE !== null && priorE !== null ? todayE - priorE : null,
      };
    }

    // Per-set deltas: lead-set-per-position alignment. Drop tiers excluded
    // (they're summed into volume; rendering them as separate per-position
    // rows would create phantom prior=null mismatches).
    const todayLeads = leadSetByPosition(todayEx.sets);
    const priorLeads = priorEx
      ? leadSetByPosition(priorEx.sets)
      : new Map<number, Set>();
    const allPositions = new Set<number>([
      ...todayLeads.keys(),
      ...priorLeads.keys(),
    ]);

    const perSetDeltas = Array.from(allPositions)
      .sort((a, b) => a - b)
      .map((pos) => {
        const t = todayLeads.get(pos) ?? null;
        const p = priorLeads.get(pos) ?? null;
        return {
          position: pos,
          today: t ? { weightKg: t.weightKg, reps: t.reps } : null,
          prior: p ? { weightKg: p.weightKg, reps: p.reps } : null,
        };
      });

    return {
      exercise: todayEx.exercise,
      sessionExerciseId: todayEx.sessionExercise.id,
      todaySets: todayEx.sets,
      priorSets: priorEx ? priorEx.sets : null,
      edgeCase,
      headline,
      secondary,
      perSetDeltas,
    };
  });
}

export function isFirstTime(c: ExerciseComparison): boolean {
  return c.edgeCase.kind === 'first-time';
}

export function isStaleComparison(c: ExerciseComparison): boolean {
  return c.edgeCase.kind === 'stale';
}

/** Lower-level pair-wise delta primitive. Used by Phase 3 charts that want
 *  raw deltas without the full ExerciseComparison shape. */
export function computeExerciseDelta(
  today: Set[],
  prior: Set[] | null,
): { topSetWeightDelta: number | null; volumeDelta: number | null } {
  const todayTop = topSet(today);
  const priorTop = prior ? topSet(prior) : null;
  return {
    topSetWeightDelta:
      todayTop && priorTop ? todayTop.weightKg - priorTop.weightKg : null,
    volumeDelta: prior ? exerciseVolume(today) - exerciseVolume(prior) : null,
  };
}
