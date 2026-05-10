// src/db/seed/starter-routines.ts
//
// Source of truth: C:/Users/Ankit/OneDrive/Documents/Ankit's KB/Areas/Health/Workout-Plan.md
//
// Per CONTEXT.md decisions:
//   D-03a flat list of four routines (Push / Pull / Legs / Saturday Endurance);
//          no Push A / Push B variants in v1.
//   D-03b "Pick 2 of 3 lat pulldowns" handled by listing all three and
//          treating an exercise with zero logged sets as skipped.
//   D-03c routine editing is via this seed file + scripts/seed-starter-routines.ts;
//          no routine-editor UI in v1.
//   D-03d Saturday endurance circuit modelled with each station as an exercise;
//          target_duration_seconds and target_distance_meters live on
//          routine_exercises (and on the corresponding sets at log time).
//
// Max-lift baselines are encoded in:
//   - exercises.notes (human-readable, what 01-02-PLAN explicitly asked for)
//   - routine_exercises.target_weight_kg (machine-readable; downstream plans
//     use this as the ghost-value placeholder for the very first session per
//     CONTEXT D-01c, until a real prior session exists)
//
// Idempotency: keep slugs stable. Renames go through display_name only.

import type { NewExercise, NewRoutine } from '../schema';

export type StarterExerciseSeed = Omit<NewExercise, 'id' | 'createdAt' | 'updatedAt'>;
export type StarterRoutineSeed = {
  routine: Omit<NewRoutine, 'id' | 'createdAt' | 'updatedAt'>;
  exercises: Array<{
    exerciseSlug: string; // resolved to exercise_id at insert time
    position: number;
    targetSets?: number;
    targetRepsLow?: number;
    targetRepsHigh?: number;
    targetWeightKg?: number;
    targetDurationSeconds?: number;
    targetDistanceMeters?: number;
    notes?: string;
  }>;
};

// ─── EXERCISES (catalog) ───────────────────────────────────────────────────
export const STARTER_EXERCISES: StarterExerciseSeed[] = [
  // Push — Workout-Plan.md "Push Day" table
  {
    slug: 'incline-smith-machine-chest-press',
    displayName: 'Incline Smith Machine Chest Press',
    category: 'push',
    primaryMuscle: 'chest',
    isCompound: true,
    defaultRestSeconds: 120,
    notes: 'Max 40 kg (per Workout-Plan.md, 2026-05-10)',
  },
  {
    slug: 'flat-smith-machine-chest-press',
    displayName: 'Flat Smith Machine Chest Press',
    category: 'push',
    primaryMuscle: 'chest',
    isCompound: true,
    defaultRestSeconds: 120,
    notes: 'Max 40 kg',
  },
  {
    slug: 'machine-fly',
    displayName: 'Machine Fly',
    category: 'push',
    primaryMuscle: 'chest',
    isCompound: false,
    defaultRestSeconds: 90,
    notes: 'Max TBD',
  },
  {
    slug: 'standing-db-shoulder-press',
    displayName: 'Standing Dumbbell Shoulder Press',
    category: 'push',
    primaryMuscle: 'shoulders',
    isCompound: true,
    defaultRestSeconds: 120,
    notes: 'Max 10 kg each',
  },
  {
    slug: 'db-lateral-raise',
    displayName: 'Dumbbell Lateral Raise',
    category: 'push',
    primaryMuscle: 'shoulders',
    isCompound: false,
    defaultRestSeconds: 60,
    notes: '10 kg each',
  },
  {
    slug: 'cable-rope-triceps-pushdown',
    displayName: 'Cable Rope Triceps Pushdown',
    category: 'push',
    primaryMuscle: 'triceps',
    isCompound: false,
    defaultRestSeconds: 60,
  },
  {
    slug: 'triceps-overhead-extension-rope',
    displayName: 'Triceps Overhead Extension (rope)',
    category: 'push',
    primaryMuscle: 'triceps',
    isCompound: false,
    defaultRestSeconds: 60,
  },

  // Pull — Workout-Plan.md "Pull Day" table.
  // D-03b: list ALL THREE Lat Pulldown variants; user picks 2/day, the third
  // gets zero sets logged and is treated as skipped.
  {
    slug: 'lat-pulldown-narrow',
    displayName: 'Lat Pulldown (Narrow grip)',
    category: 'pull',
    primaryMuscle: 'back',
    isCompound: true,
    defaultRestSeconds: 90,
    notes: 'Pick 2 of 3 lat pulldowns per session',
  },
  {
    slug: 'lat-pulldown-wide',
    displayName: 'Lat Pulldown (Wide grip)',
    category: 'pull',
    primaryMuscle: 'back',
    isCompound: true,
    defaultRestSeconds: 90,
    notes: 'Pick 2 of 3 lat pulldowns per session',
  },
  {
    slug: 'lat-pulldown-close',
    displayName: 'Lat Pulldown (Close grip)',
    category: 'pull',
    primaryMuscle: 'back',
    isCompound: true,
    defaultRestSeconds: 90,
    notes: 'Pick 2 of 3 lat pulldowns per session',
  },
  {
    slug: 'seated-cable-row',
    displayName: 'Seated Cable Row',
    category: 'pull',
    primaryMuscle: 'back',
    isCompound: true,
    defaultRestSeconds: 90,
  },
  {
    slug: 'deadlift',
    displayName: 'Deadlifts',
    category: 'pull',
    primaryMuscle: 'back',
    isCompound: true,
    defaultRestSeconds: 180,
  },
  {
    slug: 'db-row',
    displayName: 'Dumbbell Row',
    category: 'pull',
    primaryMuscle: 'back',
    isCompound: true,
    defaultRestSeconds: 90,
    notes: 'Bilateral or unilateral',
  },
  {
    slug: 'bicep-curl',
    displayName: 'Bicep Curls',
    category: 'pull',
    primaryMuscle: 'biceps',
    isCompound: false,
    defaultRestSeconds: 60,
  },
  {
    slug: 'hammer-curl',
    displayName: 'Hammer Curls',
    category: 'pull',
    primaryMuscle: 'biceps',
    isCompound: false,
    defaultRestSeconds: 60,
  },

  // Legs — Workout-Plan.md "Legs Day" table
  {
    slug: 'db-squat',
    displayName: 'Dumbbell Squats',
    category: 'legs',
    primaryMuscle: 'quads',
    isCompound: true,
    defaultRestSeconds: 120,
    notes: 'Max 25 kg each',
  },
  {
    slug: 'barbell-squat',
    displayName: 'Barbell Squats',
    category: 'legs',
    primaryMuscle: 'quads',
    isCompound: true,
    defaultRestSeconds: 180,
    notes: 'Max 90 kg',
  },
  {
    slug: 'leg-press',
    displayName: 'Leg Press',
    category: 'legs',
    primaryMuscle: 'quads',
    isCompound: true,
    defaultRestSeconds: 120,
  },
  {
    slug: 'leg-extension',
    displayName: 'Leg Extension',
    category: 'legs',
    primaryMuscle: 'quads',
    isCompound: false,
    defaultRestSeconds: 60,
  },
  {
    slug: 'leg-curl',
    displayName: 'Leg Curl',
    category: 'legs',
    primaryMuscle: 'hamstrings',
    isCompound: false,
    defaultRestSeconds: 60,
  },
  {
    slug: 'db-lunge',
    displayName: 'Lunges with Dumbbells',
    category: 'legs',
    primaryMuscle: 'quads',
    isCompound: true,
    defaultRestSeconds: 90,
  },
  {
    slug: 'standing-calf-raise',
    displayName: 'Standing Calf Raises',
    category: 'legs',
    primaryMuscle: 'calves',
    isCompound: false,
    defaultRestSeconds: 60,
  },

  // Saturday endurance circuit — D-03d
  {
    slug: 'jumping-jacks',
    displayName: 'Jumping Jacks',
    category: 'endurance',
    primaryMuscle: 'full-body',
    isCompound: false,
    defaultRestSeconds: 30,
    notes: 'Warm-up',
  },
  {
    slug: 'plank',
    displayName: 'Plank',
    category: 'endurance',
    primaryMuscle: 'core',
    isCompound: false,
    defaultRestSeconds: 30,
    notes: 'Hold',
  },
  {
    slug: 'rowing-machine',
    displayName: 'Rowing Machine',
    category: 'endurance',
    primaryMuscle: 'full-body',
    isCompound: true,
    defaultRestSeconds: 60,
  },
  {
    slug: 'treadmill',
    displayName: 'Treadmill',
    category: 'endurance',
    primaryMuscle: 'legs',
    isCompound: true,
    defaultRestSeconds: 60,
  },
  {
    slug: 'burpees',
    displayName: 'Burpees',
    category: 'endurance',
    primaryMuscle: 'full-body',
    isCompound: true,
    defaultRestSeconds: 60,
  },
  {
    slug: 'cross-trainer',
    displayName: 'Cross Trainer',
    category: 'endurance',
    primaryMuscle: 'full-body',
    isCompound: true,
    defaultRestSeconds: 60,
  },
];

// ─── ROUTINES (templates with ordered exercise lists) ──────────────────────
export const STARTER_ROUTINES: StarterRoutineSeed[] = [
  {
    routine: {
      name: 'Push',
      slug: 'push',
      position: 0,
      notes: 'Chest / Triceps / Shoulders',
    },
    exercises: [
      {
        exerciseSlug: 'incline-smith-machine-chest-press',
        position: 1,
        targetSets: 4,
        targetRepsLow: 6,
        targetRepsHigh: 10,
        targetWeightKg: 40,
      },
      {
        exerciseSlug: 'flat-smith-machine-chest-press',
        position: 2,
        targetSets: 3,
        targetRepsLow: 6,
        targetRepsHigh: 10,
        targetWeightKg: 40,
      },
      {
        exerciseSlug: 'machine-fly',
        position: 3,
        targetSets: 3,
        targetRepsLow: 10,
        targetRepsHigh: 15,
      },
      {
        exerciseSlug: 'standing-db-shoulder-press',
        position: 4,
        targetSets: 3,
        targetRepsLow: 8,
        targetRepsHigh: 12,
        targetWeightKg: 10,
      },
      {
        exerciseSlug: 'db-lateral-raise',
        position: 5,
        targetSets: 3,
        targetRepsLow: 10,
        targetRepsHigh: 15,
        targetWeightKg: 10,
      },
      {
        exerciseSlug: 'cable-rope-triceps-pushdown',
        position: 6,
        targetSets: 3,
        targetRepsLow: 10,
        targetRepsHigh: 15,
      },
      {
        exerciseSlug: 'triceps-overhead-extension-rope',
        position: 7,
        targetSets: 3,
        targetRepsLow: 10,
        targetRepsHigh: 15,
      },
    ],
  },
  {
    routine: {
      name: 'Pull',
      slug: 'pull',
      position: 1,
      notes: 'Back / Biceps. Pick 2 of the 3 lat pulldown variants per session.',
    },
    exercises: [
      {
        exerciseSlug: 'lat-pulldown-narrow',
        position: 1,
        targetSets: 3,
        targetRepsLow: 8,
        targetRepsHigh: 12,
        notes: 'Pick 2 of 3',
      },
      {
        exerciseSlug: 'lat-pulldown-wide',
        position: 2,
        targetSets: 3,
        targetRepsLow: 8,
        targetRepsHigh: 12,
        notes: 'Pick 2 of 3',
      },
      {
        exerciseSlug: 'lat-pulldown-close',
        position: 3,
        targetSets: 3,
        targetRepsLow: 8,
        targetRepsHigh: 12,
        notes: 'Pick 2 of 3',
      },
      {
        exerciseSlug: 'seated-cable-row',
        position: 4,
        targetSets: 3,
        targetRepsLow: 8,
        targetRepsHigh: 12,
      },
      {
        exerciseSlug: 'deadlift',
        position: 5,
        targetSets: 3,
        targetRepsLow: 5,
        targetRepsHigh: 8,
      },
      {
        exerciseSlug: 'db-row',
        position: 6,
        targetSets: 3,
        targetRepsLow: 8,
        targetRepsHigh: 12,
      },
      {
        exerciseSlug: 'bicep-curl',
        position: 7,
        targetSets: 3,
        targetRepsLow: 10,
        targetRepsHigh: 15,
      },
      {
        exerciseSlug: 'hammer-curl',
        position: 8,
        targetSets: 3,
        targetRepsLow: 10,
        targetRepsHigh: 15,
      },
    ],
  },
  {
    routine: {
      name: 'Legs',
      slug: 'legs',
      position: 2,
      notes: 'Quads / Hamstrings / Glutes / Calves',
    },
    exercises: [
      {
        exerciseSlug: 'db-squat',
        position: 1,
        targetSets: 3,
        targetRepsLow: 8,
        targetRepsHigh: 12,
        targetWeightKg: 25,
      },
      {
        exerciseSlug: 'barbell-squat',
        position: 2,
        targetSets: 4,
        targetRepsLow: 5,
        targetRepsHigh: 8,
        targetWeightKg: 90,
      },
      {
        exerciseSlug: 'leg-press',
        position: 3,
        targetSets: 3,
        targetRepsLow: 10,
        targetRepsHigh: 15,
      },
      {
        exerciseSlug: 'leg-extension',
        position: 4,
        targetSets: 3,
        targetRepsLow: 10,
        targetRepsHigh: 15,
      },
      {
        exerciseSlug: 'leg-curl',
        position: 5,
        targetSets: 3,
        targetRepsLow: 10,
        targetRepsHigh: 15,
      },
      {
        exerciseSlug: 'db-lunge',
        position: 6,
        targetSets: 3,
        targetRepsLow: 10,
        targetRepsHigh: 15,
      },
      {
        exerciseSlug: 'standing-calf-raise',
        position: 7,
        targetSets: 3,
        targetRepsLow: 12,
        targetRepsHigh: 20,
      },
    ],
  },
  {
    routine: {
      name: 'Saturday Endurance',
      slug: 'saturday-endurance',
      position: 3,
      notes: 'Endurance circuit — durations and distances, not weights and reps',
    },
    exercises: [
      {
        exerciseSlug: 'jumping-jacks',
        position: 1,
        targetSets: 1,
        targetDurationSeconds: 120,
        notes: 'Warm-up, 2 min',
      },
      {
        exerciseSlug: 'plank',
        position: 2,
        targetSets: 3,
        targetDurationSeconds: 60,
        notes: 'Hold; 3 × 60 s',
      },
      {
        exerciseSlug: 'rowing-machine',
        position: 3,
        targetSets: 1,
        targetDurationSeconds: 600, // 10 min
      },
      {
        exerciseSlug: 'treadmill',
        position: 4,
        targetSets: 1,
        targetDurationSeconds: 600, // 10 min
      },
      {
        exerciseSlug: 'burpees',
        position: 5,
        targetSets: 3,
        targetRepsLow: 10,
        targetRepsHigh: 15,
      },
      {
        exerciseSlug: 'cross-trainer',
        position: 6,
        targetSets: 1,
        targetDurationSeconds: 300, // 5 min
      },
    ],
  },
];
