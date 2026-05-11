import type { Set } from '@/db/schema';
import type { SessionView } from '@/db/queries/sessions';

/**
 * Pure volume + top-set primitives consumed by the comparison report (Plan 01-04)
 * and Phase 3 charts.
 *
 * Design notes:
 *   - exerciseVolume includes drop tiers in the sum (PITFALLS Pitfall #5: total
 *     volume is a secondary metric, but when shown it should reflect ALL work
 *     performed, including drop tiers). topSet IGNORES drop tiers because the
 *     "top set" concept means the heaviest *intended working set*, not the
 *     descending tail of a drop set.
 *   - sets with null weight or null reps (endurance sets, half-saved rows)
 *     contribute 0 to volume rather than NaN. Endurance sets are handled
 *     separately by Phase 3 cardio-distance charts.
 *   - Soft-deleted sets are filtered out everywhere — they should never
 *     contribute to comparison-report numbers.
 */

export function exerciseVolume(sets: Set[]): number {
  return sets.reduce((acc, s) => {
    if (s.isDeleted) return acc;
    if (s.weightKg == null || s.reps == null) return acc;
    return acc + s.weightKg * s.reps;
  }, 0);
}

export function sessionVolume(view: SessionView): number {
  return view.exercises.reduce((acc, ex) => acc + exerciseVolume(ex.sets), 0);
}

/**
 * Heaviest non-drop-tier, non-deleted set with non-null weight + reps.
 * Tiebreaker on weight: prefer more reps (more reps at the same weight is
 * objectively a stronger set).
 *
 * Returns null when no strength sets exist (e.g., endurance-only exercises
 * like Rowing, or an exercise that only contains drop tiers, or no sets at
 * all). Callers branch on null to render endurance-format headlines or skip
 * top-set deltas entirely.
 */
export function topSet(sets: Set[]): { weightKg: number; reps: number } | null {
  const candidates = sets.filter(
    (s) => !s.isDropTier && !s.isDeleted && s.weightKg != null && s.reps != null,
  );
  if (candidates.length === 0) return null;
  const top = candidates.reduce((max, s) => {
    // Both weight and reps are non-null per the filter above; the bangs are safe.
    if (s.weightKg! > max.weightKg!) return s;
    if (s.weightKg! === max.weightKg! && s.reps! > max.reps!) return s;
    return max;
  });
  return { weightKg: top.weightKg!, reps: top.reps! };
}
