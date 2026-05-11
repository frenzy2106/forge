import { describe, it, expect } from 'vitest';
import { matchPriorPerformance } from './previous-set';
import type { Set } from '@/db/schema';

const mk = (overrides: Partial<Set>): Set => ({
  id: 'x',
  sessionExerciseId: 'se',
  position: 1,
  reps: null,
  weightKg: null,
  durationSeconds: null,
  distanceMeters: null,
  isDropTier: false,
  parentSetId: null,
  isWarmup: false,
  rpe: null,
  loggedAt: '2026-01-01T00:00:00.000Z',
  isDeleted: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('matchPriorPerformance', () => {
  it('returns the matching position when present', () => {
    const sets = [
      mk({ position: 1, weightKg: 40, reps: 8 }),
      mk({ position: 2, weightKg: 40, reps: 7 }),
    ];
    expect(matchPriorPerformance(sets, 2)).toMatchObject({ weightKg: 40, reps: 7 });
  });

  it('skips drop tiers', () => {
    const sets = [
      mk({ position: 1, weightKg: 40, reps: 8 }),
      // drop-tier set at the same position 1 — should be ignored
      mk({ position: 1, weightKg: 30, reps: 6, isDropTier: true }),
    ];
    expect(matchPriorPerformance(sets, 1)?.weightKg).toBe(40);
  });

  it('returns null when no prior at position', () => {
    expect(matchPriorPerformance([], 1)).toBeNull();
    expect(matchPriorPerformance(undefined, 1)).toBeNull();
    expect(matchPriorPerformance([mk({ position: 1 })], 5)).toBeNull();
  });

  it('returns null when only drop tiers exist at the requested position', () => {
    const sets = [mk({ position: 1, isDropTier: true })];
    expect(matchPriorPerformance(sets, 1)).toBeNull();
  });
});
