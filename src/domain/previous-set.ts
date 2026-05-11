import type { Set } from '@/db/schema';

/**
 * Pure helper for picking the prior performance to surface as ghost-text on a
 * given set row in the active-session UI (CONTEXT D-01c, LOG-02).
 *
 * Skips drop-tier sets — drop tiers are not the "what did I do at set 1 last
 * time" baseline; the user wants the top-line set. If the prior performance
 * has no top-line set at the requested position (e.g. the user did 2 sets
 * last time and is on set 3 now), returns null and the SetRow renders an
 * em-dash placeholder.
 */
export function matchPriorPerformance(
  priorSets: Set[] | undefined,
  position: number,
): Set | null {
  if (!priorSets) return null;
  return priorSets.find((s) => s.position === position && !s.isDropTier) ?? null;
}
