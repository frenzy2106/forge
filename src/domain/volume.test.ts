import { describe, it, expect } from 'vitest';
import { exerciseVolume, sessionVolume, topSet } from './volume';
import type { Set } from '@/db/schema';
import type { SessionView } from '@/db/queries/sessions';

const mkSet = (overrides: Partial<Set>): Set => ({
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
  loggedAt: '2026-05-10T10:00:00.000Z',
  isDeleted: false,
  createdAt: '2026-05-10T10:00:00.000Z',
  updatedAt: '2026-05-10T10:00:00.000Z',
  ...overrides,
});

describe('exerciseVolume', () => {
  it('sums weight × reps across all sets including drop tiers', () => {
    const sets = [
      mkSet({ position: 1, weightKg: 40, reps: 8 }),
      mkSet({ position: 2, weightKg: 40, reps: 7 }),
      mkSet({ position: 1, weightKg: 30, reps: 6, isDropTier: true }),
    ];
    expect(exerciseVolume(sets)).toBe(40 * 8 + 40 * 7 + 30 * 6);
  });

  it('returns 0 for endurance-only sets (null weight/reps)', () => {
    const sets = [mkSet({ durationSeconds: 600 })];
    expect(exerciseVolume(sets)).toBe(0);
  });

  it('skips sets where either weight or reps is null', () => {
    const sets = [
      mkSet({ weightKg: 40, reps: null }),
      mkSet({ weightKg: null, reps: 8 }),
      mkSet({ weightKg: 40, reps: 8 }),
    ];
    expect(exerciseVolume(sets)).toBe(40 * 8);
  });

  it('returns 0 for empty array', () => {
    expect(exerciseVolume([])).toBe(0);
  });
});

describe('topSet', () => {
  it('picks the heaviest non-drop set', () => {
    const sets = [
      mkSet({ weightKg: 40, reps: 8 }),
      mkSet({ weightKg: 42.5, reps: 6 }),
      mkSet({ weightKg: 40, reps: 7 }),
    ];
    expect(topSet(sets)).toEqual({ weightKg: 42.5, reps: 6 });
  });

  it('breaks ties on weight by preferring more reps', () => {
    const sets = [
      mkSet({ weightKg: 40, reps: 6 }),
      mkSet({ weightKg: 40, reps: 8 }),
      mkSet({ weightKg: 40, reps: 7 }),
    ];
    expect(topSet(sets)).toEqual({ weightKg: 40, reps: 8 });
  });

  it('ignores drop tiers', () => {
    const sets = [
      mkSet({ weightKg: 40, reps: 8 }),
      mkSet({ weightKg: 30, reps: 6, isDropTier: true }),
      mkSet({ weightKg: 50, reps: 4, isDropTier: true }), // higher weight but drop tier
    ];
    expect(topSet(sets)).toEqual({ weightKg: 40, reps: 8 });
  });

  it('ignores soft-deleted sets', () => {
    const sets = [
      mkSet({ weightKg: 40, reps: 8 }),
      mkSet({ weightKg: 50, reps: 4, isDeleted: true }),
    ];
    expect(topSet(sets)).toEqual({ weightKg: 40, reps: 8 });
  });

  it('returns null when no strength sets exist (endurance-only)', () => {
    const sets = [mkSet({ durationSeconds: 600 })];
    expect(topSet(sets)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(topSet([])).toBeNull();
  });
});

describe('sessionVolume', () => {
  it('sums exerciseVolume across all exercises in the view', () => {
    const view: SessionView = {
      session: {
        id: 's',
        routineId: null,
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
            exerciseId: 'bench',
            position: 1,
            notes: null,
            createdAt: '2026-05-10T10:00:00.000Z',
          },
          exercise: {
            id: 'bench',
            slug: 'bench',
            displayName: 'Bench',
            category: 'push',
            primaryMuscle: null,
            isCompound: true,
            defaultUnit: 'kg',
            defaultRestSeconds: 60,
            notes: null,
            createdAt: '2026-05-10T10:00:00.000Z',
            updatedAt: '2026-05-10T10:00:00.000Z',
          },
          sets: [mkSet({ weightKg: 40, reps: 8 }), mkSet({ weightKg: 40, reps: 7 })],
        },
        {
          sessionExercise: {
            id: 'se2',
            sessionId: 's',
            exerciseId: 'row',
            position: 2,
            notes: null,
            createdAt: '2026-05-10T10:00:00.000Z',
          },
          exercise: {
            id: 'row',
            slug: 'row',
            displayName: 'Row',
            category: 'pull',
            primaryMuscle: null,
            isCompound: true,
            defaultUnit: 'kg',
            defaultRestSeconds: 60,
            notes: null,
            createdAt: '2026-05-10T10:00:00.000Z',
            updatedAt: '2026-05-10T10:00:00.000Z',
          },
          sets: [mkSet({ weightKg: 30, reps: 10 })],
        },
      ],
    };
    expect(sessionVolume(view)).toBe(40 * 8 + 40 * 7 + 30 * 10);
  });

  it('returns 0 for empty session', () => {
    const view: SessionView = {
      session: {
        id: 's',
        routineId: null,
        startedAt: '2026-05-10T10:00:00.000Z',
        endedAt: null,
        localDate: '2026-05-10',
        intent: 'normal',
        notes: null,
        isDeleted: false,
        createdAt: '2026-05-10T10:00:00.000Z',
        updatedAt: '2026-05-10T10:00:00.000Z',
      },
      routine: null,
      exercises: [],
    };
    expect(sessionVolume(view)).toBe(0);
  });
});
