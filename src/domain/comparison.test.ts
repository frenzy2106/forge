import { describe, it, expect } from 'vitest';
import { compareSessions, isFirstTime, isStaleComparison, computeExerciseDelta } from './comparison';
import type { SessionView } from '@/db/queries/sessions';

// Test fixture builder. Compact spec → SessionView with all required fields.
// Drop tiers default isDropTier=false; pass `isDropTier:true` per set to test
// drop-tier behavior.
function mkSession(opts: {
  startedAt: string;
  routineId?: string;
  exercises: Array<{
    exerciseId: string;
    displayName: string;
    position: number;
    sets: Array<{
      position: number;
      weight?: number;
      reps?: number;
      isDropTier?: boolean;
    }>;
  }>;
}): SessionView {
  return {
    session: {
      id: 's-' + opts.startedAt,
      routineId: opts.routineId ?? null,
      startedAt: opts.startedAt,
      endedAt: opts.startedAt,
      localDate: opts.startedAt.slice(0, 10),
      intent: 'normal',
      notes: null,
      isDeleted: false,
      createdAt: opts.startedAt,
      updatedAt: opts.startedAt,
    },
    routine: null,
    exercises: opts.exercises.map((e) => ({
      sessionExercise: {
        id: `se-${e.exerciseId}-${opts.startedAt}`,
        sessionId: 's-' + opts.startedAt,
        exerciseId: e.exerciseId,
        position: e.position,
        notes: null,
        createdAt: opts.startedAt,
      },
      exercise: {
        id: e.exerciseId,
        slug: e.exerciseId,
        displayName: e.displayName,
        category: 'push',
        primaryMuscle: null,
        isCompound: true,
        defaultUnit: 'kg',
        defaultRestSeconds: 60,
        notes: null,
        createdAt: opts.startedAt,
        updatedAt: opts.startedAt,
      },
      sets: e.sets.map((s, i) => ({
        id: `set-${e.exerciseId}-${i}-${opts.startedAt}`,
        sessionExerciseId: `se-${e.exerciseId}-${opts.startedAt}`,
        position: s.position,
        weightKg: s.weight ?? null,
        reps: s.reps ?? null,
        durationSeconds: null,
        distanceMeters: null,
        isDropTier: s.isDropTier ?? false,
        parentSetId: null,
        isWarmup: false,
        rpe: null,
        loggedAt: opts.startedAt,
        isDeleted: false,
        createdAt: opts.startedAt,
        updatedAt: opts.startedAt,
      })),
    })),
  };
}

describe('compareSessions', () => {
  it('normal case: matching exercises produce correct headline + secondary deltas', () => {
    const today = mkSession({
      startedAt: '2026-05-10T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 'bench',
          displayName: 'Bench',
          position: 1,
          sets: [
            { position: 1, weight: 42.5, reps: 8 },
            { position: 2, weight: 42.5, reps: 7 },
          ],
        },
      ],
    });
    const prior = mkSession({
      startedAt: '2026-05-07T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 'bench',
          displayName: 'Bench',
          position: 1,
          sets: [
            { position: 1, weight: 40, reps: 8 },
            { position: 2, weight: 40, reps: 8 },
          ],
        },
      ],
    });
    const [c] = compareSessions(today, prior);
    expect(c.edgeCase.kind).toBe('normal');
    expect(c.headline?.weightDelta).toBeCloseTo(2.5, 3);
    expect(c.headline?.repsDelta).toBe(0);
    expect(c.secondary?.volumeDelta).toBeCloseTo(42.5 * 8 + 42.5 * 7 - (40 * 8 + 40 * 8), 3);
    // working weight: today mean = 42.5; prior mean = 40 → +2.5
    expect(c.secondary?.workingWeightDelta).toBeCloseTo(2.5, 3);
    expect(c.perSetDeltas).toHaveLength(2);
  });

  it('first-time when prior session is null entirely', () => {
    const today = mkSession({
      startedAt: '2026-05-10T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 'bench',
          displayName: 'Bench',
          position: 1,
          sets: [{ position: 1, weight: 40, reps: 8 }],
        },
      ],
    });
    const result = compareSessions(today, null);
    expect(result).toHaveLength(1);
    expect(result[0].edgeCase.kind).toBe('first-time');
    expect(result[0].headline).toBeNull();
    expect(result[0].secondary).toBeNull();
    expect(result[0].perSetDeltas).toHaveLength(1);
    expect(result[0].perSetDeltas[0].today).not.toBeNull();
    expect(result[0].perSetDeltas[0].prior).toBeNull();
  });

  it('first-time when exercise was not in prior and no swap detected', () => {
    const today = mkSession({
      startedAt: '2026-05-10T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 'newex',
          displayName: 'New',
          position: 1,
          sets: [{ position: 1, weight: 20, reps: 10 }],
        },
      ],
    });
    // Prior has the same exercise at a DIFFERENT position (or no exercise at
    // position 1 at all). Use position 2 to avoid the swap path.
    const prior = mkSession({
      startedAt: '2026-05-07T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 'oldex',
          displayName: 'Old',
          position: 2,
          sets: [{ position: 1, weight: 20, reps: 10 }],
        },
      ],
    });
    const [c] = compareSessions(today, prior);
    // Today's 'newex' wasn't in prior; prior position 1 was empty → first-time.
    expect(c.edgeCase.kind).toBe('first-time');
  });

  it('swapped when same routine slot held a different exercise last time', () => {
    const today = mkSession({
      startedAt: '2026-05-10T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 'bbsquat',
          displayName: 'Barbell Squat',
          position: 1,
          sets: [{ position: 1, weight: 80, reps: 5 }],
        },
      ],
    });
    const prior = mkSession({
      startedAt: '2026-05-07T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 'smithsquat',
          displayName: 'Smith Squat',
          position: 1,
          sets: [{ position: 1, weight: 60, reps: 8 }],
        },
      ],
    });
    const [c] = compareSessions(today, prior);
    expect(c.edgeCase.kind).toBe('swapped');
    expect(c.edgeCase.kind === 'swapped' && c.edgeCase.priorExerciseDisplayName).toBe('Smith Squat');
    expect(c.headline).toBeNull();
    expect(c.secondary).toBeNull();
  });

  it('stale when prior is >14 days ago', () => {
    const today = mkSession({
      startedAt: '2026-05-30T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 'bench',
          displayName: 'Bench',
          position: 1,
          sets: [{ position: 1, weight: 40, reps: 8 }],
        },
      ],
    });
    const prior = mkSession({
      startedAt: '2026-05-10T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 'bench',
          displayName: 'Bench',
          position: 1,
          sets: [{ position: 1, weight: 40, reps: 8 }],
        },
      ],
    });
    const [c] = compareSessions(today, prior);
    expect(c.edgeCase.kind).toBe('stale');
    expect(c.edgeCase.kind === 'stale' && c.edgeCase.daysAgo).toBe(20);
    // Deltas STILL computed; UI overlays the badge.
    expect(c.headline?.weightDelta).toBe(0);
    expect(c.secondary?.volumeDelta).toBe(0);
  });

  it('NOT stale at exactly 14 days', () => {
    const today = mkSession({
      startedAt: '2026-05-24T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 'bench',
          displayName: 'Bench',
          position: 1,
          sets: [{ position: 1, weight: 40, reps: 8 }],
        },
      ],
    });
    const prior = mkSession({
      startedAt: '2026-05-10T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 'bench',
          displayName: 'Bench',
          position: 1,
          sets: [{ position: 1, weight: 40, reps: 8 }],
        },
      ],
    });
    const [c] = compareSessions(today, prior);
    expect(c.edgeCase.kind).toBe('normal');
  });

  it('renamed when same exercise id but display_name differs', () => {
    const today = mkSession({
      startedAt: '2026-05-10T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 'bench',
          displayName: 'Barbell Bench Press',
          position: 1,
          sets: [{ position: 1, weight: 40, reps: 8 }],
        },
      ],
    });
    const prior = mkSession({
      startedAt: '2026-05-07T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 'bench',
          displayName: 'Bench',
          position: 1,
          sets: [{ position: 1, weight: 40, reps: 8 }],
        },
      ],
    });
    const [c] = compareSessions(today, prior);
    expect(c.edgeCase.kind).toBe('renamed');
    expect(c.edgeCase.kind === 'renamed' && c.edgeCase.priorDisplayName).toBe('Bench');
    // Deltas still computed.
    expect(c.headline?.weightDelta).toBe(0);
  });

  it('orders exercises by today session order, not prior order', () => {
    const today = mkSession({
      startedAt: '2026-05-10T10:00:00.000Z',
      exercises: [
        { exerciseId: 'b', displayName: 'B', position: 1, sets: [{ position: 1, weight: 10, reps: 10 }] },
        { exerciseId: 'a', displayName: 'A', position: 2, sets: [{ position: 1, weight: 20, reps: 10 }] },
      ],
    });
    const prior = mkSession({
      startedAt: '2026-05-07T10:00:00.000Z',
      exercises: [
        { exerciseId: 'a', displayName: 'A', position: 1, sets: [{ position: 1, weight: 20, reps: 10 }] },
        { exerciseId: 'b', displayName: 'B', position: 2, sets: [{ position: 1, weight: 10, reps: 10 }] },
      ],
    });
    const result = compareSessions(today, prior);
    expect(result.map((c) => c.exercise.id)).toEqual(['b', 'a']);
  });

  it('per-set deltas align by position; missing positions render null on the missing side', () => {
    const today = mkSession({
      startedAt: '2026-05-10T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 'bench',
          displayName: 'Bench',
          position: 1,
          sets: [
            { position: 1, weight: 40, reps: 8 },
            { position: 2, weight: 40, reps: 7 },
            { position: 3, weight: 40, reps: 6 },
            { position: 4, weight: 35, reps: 5 },
          ],
        },
      ],
    });
    const prior = mkSession({
      startedAt: '2026-05-07T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 'bench',
          displayName: 'Bench',
          position: 1,
          sets: [
            { position: 1, weight: 40, reps: 8 },
            { position: 2, weight: 40, reps: 8 },
            { position: 3, weight: 40, reps: 7 },
          ],
        },
      ],
    });
    const [c] = compareSessions(today, prior);
    expect(c.perSetDeltas).toHaveLength(4);
    expect(c.perSetDeltas[3].today).not.toBeNull();
    expect(c.perSetDeltas[3].prior).toBeNull();
    expect(c.perSetDeltas[0].today).toEqual({ weightKg: 40, reps: 8 });
    expect(c.perSetDeltas[0].prior).toEqual({ weightKg: 40, reps: 8 });
  });

  it('drop tiers do not appear as separate per-set delta rows; volume includes them', () => {
    const today = mkSession({
      startedAt: '2026-05-10T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 'bench',
          displayName: 'Bench',
          position: 1,
          sets: [
            { position: 1, weight: 40, reps: 8 },
            { position: 1, weight: 30, reps: 6, isDropTier: true },
            { position: 1, weight: 20, reps: 4, isDropTier: true },
          ],
        },
      ],
    });
    const prior = mkSession({
      startedAt: '2026-05-07T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 'bench',
          displayName: 'Bench',
          position: 1,
          sets: [{ position: 1, weight: 40, reps: 8 }],
        },
      ],
    });
    const [c] = compareSessions(today, prior);
    expect(c.perSetDeltas).toHaveLength(1);
    // top set ignores drop tiers
    expect(c.headline?.todayTopSet).toEqual({ weightKg: 40, reps: 8 });
    // volume INCLUDES drop tiers
    expect(c.secondary?.volumeDelta).toBeCloseTo(40 * 8 + 30 * 6 + 20 * 4 - 40 * 8, 3);
  });

  it('e1RM delta computed via Epley; null when reps out of range', () => {
    const today = mkSession({
      startedAt: '2026-05-10T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 'bench',
          displayName: 'Bench',
          position: 1,
          sets: [{ position: 1, weight: 40, reps: 8 }],
        },
      ],
    });
    const prior = mkSession({
      startedAt: '2026-05-07T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 'bench',
          displayName: 'Bench',
          position: 1,
          sets: [{ position: 1, weight: 40, reps: 6 }],
        },
      ],
    });
    const [c] = compareSessions(today, prior);
    // today e1RM = 40 * (1 + 8/30) = 50.667
    // prior e1RM = 40 * (1 + 6/30) = 48
    expect(c.secondary?.e1rmDelta).toBeCloseTo(50.6667 - 48, 2);
  });

  it('e1RM delta is null when top set reps exceed Epley validity (>30)', () => {
    const today = mkSession({
      startedAt: '2026-05-10T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 'bw',
          displayName: 'Bodyweight',
          position: 1,
          sets: [{ position: 1, weight: 0, reps: 50 }],
        },
      ],
    });
    const prior = mkSession({
      startedAt: '2026-05-07T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 'bw',
          displayName: 'Bodyweight',
          position: 1,
          sets: [{ position: 1, weight: 0, reps: 40 }],
        },
      ],
    });
    const [c] = compareSessions(today, prior);
    expect(c.secondary?.e1rmDelta).toBeNull();
  });

  it('endurance exercises (no weight/reps) produce null headline + secondary, no crashes', () => {
    const today: SessionView = {
      session: {
        id: 's',
        routineId: 'r',
        startedAt: '2026-05-10T10:00:00.000Z',
        endedAt: '2026-05-10T11:00:00.000Z',
        localDate: '2026-05-10',
        intent: 'normal',
        notes: null,
        isDeleted: false,
        createdAt: '2026-05-10T10:00:00.000Z',
        updatedAt: '2026-05-10T10:00:00.000Z',
      },
      routine: null,
      exercises: [
        {
          sessionExercise: {
            id: 'se1',
            sessionId: 's',
            exerciseId: 'rowing',
            position: 1,
            notes: null,
            createdAt: '2026-05-10T10:00:00.000Z',
          },
          exercise: {
            id: 'rowing',
            slug: 'rowing',
            displayName: 'Rowing',
            category: 'endurance',
            primaryMuscle: null,
            isCompound: true,
            defaultUnit: 'kg',
            defaultRestSeconds: 60,
            notes: null,
            createdAt: '2026-05-10T10:00:00.000Z',
            updatedAt: '2026-05-10T10:00:00.000Z',
          },
          sets: [
            {
              id: 'set1',
              sessionExerciseId: 'se1',
              position: 1,
              reps: null,
              weightKg: null,
              durationSeconds: 600,
              distanceMeters: null,
              isDropTier: false,
              parentSetId: null,
              isWarmup: false,
              rpe: null,
              loggedAt: '2026-05-10T10:00:00.000Z',
              isDeleted: false,
              createdAt: '2026-05-10T10:00:00.000Z',
              updatedAt: '2026-05-10T10:00:00.000Z',
            },
          ],
        },
      ],
    };
    const result = compareSessions(today, null);
    expect(result).toHaveLength(1);
    expect(result[0].edgeCase.kind).toBe('first-time');
    // No crash; headline null because first-time path skips it.
    expect(result[0].headline).toBeNull();
  });
});

describe('isFirstTime / isStaleComparison helpers', () => {
  it('isFirstTime returns true only for first-time edge case', () => {
    const today = mkSession({
      startedAt: '2026-05-10T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 'bench',
          displayName: 'Bench',
          position: 1,
          sets: [{ position: 1, weight: 40, reps: 8 }],
        },
      ],
    });
    const [c] = compareSessions(today, null);
    expect(isFirstTime(c)).toBe(true);
    expect(isStaleComparison(c)).toBe(false);
  });

  it('isStaleComparison returns true only for stale edge case', () => {
    const today = mkSession({
      startedAt: '2026-05-30T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 'bench',
          displayName: 'Bench',
          position: 1,
          sets: [{ position: 1, weight: 40, reps: 8 }],
        },
      ],
    });
    const prior = mkSession({
      startedAt: '2026-05-10T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 'bench',
          displayName: 'Bench',
          position: 1,
          sets: [{ position: 1, weight: 40, reps: 8 }],
        },
      ],
    });
    const [c] = compareSessions(today, prior);
    expect(isStaleComparison(c)).toBe(true);
    expect(isFirstTime(c)).toBe(false);
  });
});

describe('computeExerciseDelta', () => {
  it('returns top-set weight delta + volume delta for a normal pair', () => {
    const today = [
      { id: '1', sessionExerciseId: 'se', position: 1, weightKg: 42.5, reps: 8, durationSeconds: null, distanceMeters: null, isDropTier: false, parentSetId: null, isWarmup: false, rpe: null, loggedAt: 'x', isDeleted: false, createdAt: 'x', updatedAt: 'x' },
    ];
    const prior = [
      { id: '2', sessionExerciseId: 'se', position: 1, weightKg: 40, reps: 8, durationSeconds: null, distanceMeters: null, isDropTier: false, parentSetId: null, isWarmup: false, rpe: null, loggedAt: 'x', isDeleted: false, createdAt: 'x', updatedAt: 'x' },
    ];
    const d = computeExerciseDelta(today, prior);
    expect(d.topSetWeightDelta).toBeCloseTo(2.5);
    expect(d.volumeDelta).toBeCloseTo(42.5 * 8 - 40 * 8);
  });

  it('returns null deltas when prior is null', () => {
    const today = [
      { id: '1', sessionExerciseId: 'se', position: 1, weightKg: 40, reps: 8, durationSeconds: null, distanceMeters: null, isDropTier: false, parentSetId: null, isWarmup: false, rpe: null, loggedAt: 'x', isDeleted: false, createdAt: 'x', updatedAt: 'x' },
    ];
    const d = computeExerciseDelta(today, null);
    expect(d.topSetWeightDelta).toBeNull();
    expect(d.volumeDelta).toBeNull();
  });
});
