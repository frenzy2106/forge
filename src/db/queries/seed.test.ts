// src/db/queries/seed.test.ts
//
// Hermetic tests for the starter-routines seed. Mirrors the script's logic
// against an in-memory libSQL DB so we catch:
//   - schema/seed shape drift (every routine_exercise must reference an
//     existing exercise slug)
//   - the four canonical routines and their slugs
//   - Saturday-endurance stations carry the duration targets per CONTEXT D-03d
//   - rerun is idempotent (zero new rows the second time through)

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq, and } from 'drizzle-orm';
import * as schema from '../schema';
import { STARTER_EXERCISES, STARTER_ROUTINES } from '../seed/starter-routines';
import { makeTestDb, type TestDb } from '../__test-helpers__/test-db';

let db: TestDb;
let cleanup: () => void;

beforeEach(async () => {
  ({ db, cleanup } = await makeTestDb());
});
afterEach(() => cleanup());

// Inline copy of the seed script's logic against the test DB. Kept in sync
// with scripts/seed-starter-routines.ts; the script itself imports the real
// `db` singleton (env-bound) which we cannot use in unit tests.
async function runSeed(database: TestDb): Promise<{
  inserted: { exercises: number; routines: number; routineExercises: number };
  skipped: { exercises: number; routines: number; routineExercises: number };
}> {
  const inserted = { exercises: 0, routines: 0, routineExercises: 0 };
  const skipped = { exercises: 0, routines: 0, routineExercises: 0 };

  for (const ex of STARTER_EXERCISES) {
    const existing = await database
      .select()
      .from(schema.exercises)
      .where(eq(schema.exercises.slug, ex.slug));
    if (existing.length === 0) {
      await database.insert(schema.exercises).values(ex);
      inserted.exercises++;
    } else {
      skipped.exercises++;
    }
  }

  for (const r of STARTER_ROUTINES) {
    let routineId: string;
    const existing = await database
      .select()
      .from(schema.routines)
      .where(eq(schema.routines.slug, r.routine.slug));
    if (existing.length === 0) {
      const [created] = await database
        .insert(schema.routines)
        .values(r.routine)
        .returning();
      routineId = created.id;
      inserted.routines++;
    } else {
      routineId = existing[0].id;
      skipped.routines++;
    }
    for (const re of r.exercises) {
      const [exRow] = await database
        .select()
        .from(schema.exercises)
        .where(eq(schema.exercises.slug, re.exerciseSlug));
      if (!exRow) continue;
      const existingRe = await database
        .select()
        .from(schema.routineExercises)
        .where(
          and(
            eq(schema.routineExercises.routineId, routineId),
            eq(schema.routineExercises.exerciseId, exRow.id),
            eq(schema.routineExercises.position, re.position),
          ),
        );
      if (existingRe.length === 0) {
        const { exerciseSlug: _slug, ...rest } = re;
        void _slug;
        await database
          .insert(schema.routineExercises)
          .values({ ...rest, routineId, exerciseId: exRow.id });
        inserted.routineExercises++;
      } else {
        skipped.routineExercises++;
      }
    }
  }

  return { inserted, skipped };
}

describe('starter routines seed: data shape', () => {
  it('every routine_exercise references an existing exercise slug', () => {
    const slugs = new Set(STARTER_EXERCISES.map((e) => e.slug));
    for (const r of STARTER_ROUTINES) {
      for (const re of r.exercises) {
        expect(slugs.has(re.exerciseSlug)).toBe(true);
      }
    }
  });

  it('seeds the 4 canonical routines with the expected slugs', () => {
    expect(STARTER_ROUTINES.map((r) => r.routine.slug).sort()).toEqual([
      'legs',
      'pull',
      'push',
      'saturday-endurance',
    ]);
  });

  it('Pull routine lists all 3 lat pulldown variants (D-03b)', () => {
    const pull = STARTER_ROUTINES.find((r) => r.routine.slug === 'pull');
    expect(pull).toBeDefined();
    const slugs = pull!.exercises.map((e) => e.exerciseSlug);
    expect(slugs).toEqual(
      expect.arrayContaining([
        'lat-pulldown-narrow',
        'lat-pulldown-wide',
        'lat-pulldown-close',
      ]),
    );
  });

  it('Saturday Endurance has timed stations with target_duration_seconds (D-03d)', () => {
    const sat = STARTER_ROUTINES.find((r) => r.routine.slug === 'saturday-endurance');
    expect(sat).toBeDefined();
    const timed = sat!.exercises.filter((e) => e.targetDurationSeconds !== undefined);
    expect(timed.length).toBeGreaterThanOrEqual(4);
    expect(
      sat!.exercises.find((e) => e.exerciseSlug === 'rowing-machine')
        ?.targetDurationSeconds,
    ).toBe(600);
    expect(
      sat!.exercises.find((e) => e.exerciseSlug === 'treadmill')?.targetDurationSeconds,
    ).toBe(600);
    expect(
      sat!.exercises.find((e) => e.exerciseSlug === 'cross-trainer')
        ?.targetDurationSeconds,
    ).toBe(300);
  });

  it("Push routine carries Ankit's max-lift baselines for known exercises", () => {
    const push = STARTER_ROUTINES.find((r) => r.routine.slug === 'push')!;
    expect(
      push.exercises.find((e) => e.exerciseSlug === 'incline-smith-machine-chest-press')
        ?.targetWeightKg,
    ).toBe(40);
    expect(
      push.exercises.find((e) => e.exerciseSlug === 'flat-smith-machine-chest-press')
        ?.targetWeightKg,
    ).toBe(40);
    expect(
      push.exercises.find((e) => e.exerciseSlug === 'standing-db-shoulder-press')
        ?.targetWeightKg,
    ).toBe(10);
  });

  it("Legs routine carries Ankit's max-lift baselines (DB squat 25, BB squat 90)", () => {
    const legs = STARTER_ROUTINES.find((r) => r.routine.slug === 'legs')!;
    expect(
      legs.exercises.find((e) => e.exerciseSlug === 'db-squat')?.targetWeightKg,
    ).toBe(25);
    expect(
      legs.exercises.find((e) => e.exerciseSlug === 'barbell-squat')?.targetWeightKg,
    ).toBe(90);
  });
});

describe('starter routines seed: end-to-end against in-memory DB', () => {
  it('first run inserts 28 exercises, 4 routines, and all routine_exercises', async () => {
    const result = await runSeed(db);
    expect(result.inserted.exercises).toBe(STARTER_EXERCISES.length);
    expect(result.inserted.exercises).toBeGreaterThanOrEqual(28);
    expect(result.inserted.routines).toBe(4);

    const totalRe = STARTER_ROUTINES.reduce((acc, r) => acc + r.exercises.length, 0);
    expect(result.inserted.routineExercises).toBe(totalRe);

    const exCount = await db.select().from(schema.exercises);
    const rCount = await db.select().from(schema.routines);
    const reCount = await db.select().from(schema.routineExercises);
    expect(exCount.length).toBe(STARTER_EXERCISES.length);
    expect(rCount.length).toBe(4);
    expect(reCount.length).toBe(totalRe);
  });

  it('second run is fully idempotent — zero inserts, all skipped', async () => {
    await runSeed(db);
    const second = await runSeed(db);
    expect(second.inserted.exercises).toBe(0);
    expect(second.inserted.routines).toBe(0);
    expect(second.inserted.routineExercises).toBe(0);
    expect(second.skipped.exercises).toBe(STARTER_EXERCISES.length);
    expect(second.skipped.routines).toBe(4);
  });
});
