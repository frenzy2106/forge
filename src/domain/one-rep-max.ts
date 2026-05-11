/**
 * Epley estimated 1-rep max: W × (1 + R/30).
 *
 * Plan 01-04 / research SUMMARY R2 chose Epley for trend consistency. The
 * formula is reasonable in the 1–10 rep range and tolerable up to ~30; beyond
 * that the linear extrapolation diverges sharply from real-world max strength
 * (PITFALLS Pitfall #5). We cap reps at 30 to prevent the comparison report
 * showing nonsense e1RM jumps for high-rep cardio-style sets.
 *
 * Caller must validate input. We throw rather than returning null because:
 *   - This is a low-level numeric primitive; silent null bubbling would mask
 *     bugs upstream (e.g., a stray reps=0 from a half-saved set).
 *   - The site that needs nullable behavior — `compareSessions` — checks the
 *     range explicitly before calling and returns null e1RMDelta itself.
 */
export function estimate1RM(weightKg: number, reps: number): number {
  if (weightKg < 0) {
    throw new Error(`estimate1RM: weight must be non-negative (got ${weightKg})`);
  }
  if (!Number.isInteger(reps) || reps < 1 || reps > 30) {
    throw new Error(`estimate1RM: reps must be integer in [1, 30] (got ${reps})`);
  }
  return weightKg * (1 + reps / 30);
}
