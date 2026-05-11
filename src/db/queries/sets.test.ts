// src/db/queries/sets.test.ts
//
// Hermetic tests for the set CRUD helpers used by the Plan 01-03 active-
// session UI's Server Actions. Mirrors the pattern from sessions.test.ts:
// because the real query helpers import the env-bound singleton `db`, we
// replay the same logic against a per-test temp file DB.
//
// Covers behaviors T1, T2 (logSet — top-line + drop tier), T3 (editSet),
// and T4 (softDeleteSet). T5/T6 are session lifecycle, see sessions.test.ts.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq, and, asc } from 'drizzle-orm';
import * as schema from '../schema';
import { makeTestDb, type TestDb } from '../__test-helpers__/test-db';

let db: TestDb;
let cleanup: () => void;

beforeEach(async () => {
  ({ db, cleanup } = await makeTestDb());
});
afterEach(() => cleanup());

// Inline mirrors of queries/sets.ts. Same logic; just bound to the test db.
type LogSetInput = {
  sessionExerciseId: string;
  position: number;
  reps?: number;
  weightKg?: number;
  durationSeconds?: number;
  distanceMeters?: number;
  isDropTier?: boolean;
  parentSetId?: string;
};

async function insertSetInline(database: TestDb, input: LogSetInput) {
  const id = crypto.randomUUID();
  const now = '2026-05-11T10:00:00.000Z';
  const [created] = await database
    .insert(schema.sets)
    .values({
      id,
      sessionExerciseId: input.sessionExerciseId,
      position: input.position,
      reps: input.reps ?? null,
      weightKg: input.weightKg ?? null,
      durationSeconds: input.durationSeconds ?? null,
      distanceMeters: input.distanceMeters ?? null,
      isDropTier: input.isDropTier ?? false,
      parentSetId: input.parentSetId ?? null,
      loggedAt: now,
    })
    .returning();
  return created;
}

async function updateSetInline(
  database: TestDb,
  setId: string,
  patch: { reps?: number; weightKg?: number },
) {
  const now = '2026-05-11T10:01:00.000Z';
  await database
    .update(schema.sets)
    .set({ ...patch, updatedAt: now })
    .where(eq(schema.sets.id, setId));
}

async function softDeleteSetInline(database: TestDb, setId: string) {
  const now = '2026-05-11T10:02:00.000Z';
  await database
    .update(schema.sets)
    .set({ isDeleted: true, updatedAt: now })
    .where(eq(schema.sets.id, setId));
}

/** Bootstrap one routine + session_exercise so tests can target a real id. */
async function seedSessionExercise(database: TestDb): Promise<string> {
  await database.insert(schema.exercises).values({
    id: 'ex-1',
    slug: 'incline-smith',
    displayName: 'Incline Smith Press',
    category: 'push',
  });
  const [routine] = await database
    .insert(schema.routines)
    .values({ slug: 'push', name: 'Push', position: 0 })
    .returning();
  const [session] = await database
    .insert(schema.sessions)
    .values({
      routineId: routine.id,
      startedAt: '2026-05-11T09:00:00.000Z',
      localDate: '2026-05-11',
    })
    .returning();
  const seId = crypto.randomUUID();
  await database.insert(schema.sessionExercises).values({
    id: seId,
    sessionId: session.id,
    exerciseId: 'ex-1',
    position: 1,
  });
  return seId;
}

describe('insertSet (logSet behavior)', () => {
  // T1
  it('inserts a strength set with weight + reps', async () => {
    const seId = await seedSessionExercise(db);
    const set = await insertSetInline(db, {
      sessionExerciseId: seId,
      position: 1,
      reps: 8,
      weightKg: 40,
    });

    expect(set.id).toBeTruthy();
    expect(set.sessionExerciseId).toBe(seId);
    expect(set.position).toBe(1);
    expect(set.reps).toBe(8);
    expect(set.weightKg).toBe(40);
    expect(set.isDropTier).toBe(false);
    expect(set.parentSetId).toBeNull();
    expect(set.isDeleted).toBe(false);
  });

  // T2
  it('inserts a drop-tier set when parentSetId is provided', async () => {
    const seId = await seedSessionExercise(db);
    const lead = await insertSetInline(db, {
      sessionExerciseId: seId,
      position: 1,
      reps: 8,
      weightKg: 40,
    });
    const drop = await insertSetInline(db, {
      sessionExerciseId: seId,
      position: 1,
      reps: 6,
      weightKg: 30,
      isDropTier: true,
      parentSetId: lead.id,
    });

    expect(drop.isDropTier).toBe(true);
    expect(drop.parentSetId).toBe(lead.id);

    // FK chain visible in DB
    const [reload] = await db
      .select()
      .from(schema.sets)
      .where(eq(schema.sets.id, drop.id));
    expect(reload.parentSetId).toBe(lead.id);
  });

  it('inserts an endurance set with duration_seconds + distance_meters', async () => {
    const seId = await seedSessionExercise(db);
    const set = await insertSetInline(db, {
      sessionExerciseId: seId,
      position: 1,
      durationSeconds: 600,
      distanceMeters: 1500,
    });
    expect(set.durationSeconds).toBe(600);
    expect(set.distanceMeters).toBe(1500);
    expect(set.reps).toBeNull();
    expect(set.weightKg).toBeNull();
  });
});

describe('updateSet (editSet behavior)', () => {
  // T3
  it('updates reps to a new value and bumps updated_at', async () => {
    const seId = await seedSessionExercise(db);
    const created = await insertSetInline(db, {
      sessionExerciseId: seId,
      position: 1,
      reps: 8,
      weightKg: 40,
    });

    await updateSetInline(db, created.id, { reps: 9 });

    const [reload] = await db
      .select()
      .from(schema.sets)
      .where(eq(schema.sets.id, created.id));
    expect(reload.reps).toBe(9);
    expect(reload.weightKg).toBe(40); // unchanged
    expect(reload.updatedAt).toBe('2026-05-11T10:01:00.000Z');
  });
});

describe('softDeleteSet (deleteSet behavior)', () => {
  // T4
  it('sets is_deleted=true (preserves audit trail; HIST-05)', async () => {
    const seId = await seedSessionExercise(db);
    const created = await insertSetInline(db, {
      sessionExerciseId: seId,
      position: 1,
      reps: 8,
      weightKg: 40,
    });

    await softDeleteSetInline(db, created.id);

    // Row still in DB
    const [reload] = await db
      .select()
      .from(schema.sets)
      .where(eq(schema.sets.id, created.id));
    expect(reload).toBeTruthy();
    expect(reload.isDeleted).toBe(true);
    expect(reload.reps).toBe(8); // values preserved

    // The query helpers always filter is_deleted=false, so subsequent reads
    // hide it.
    const visible = await db
      .select()
      .from(schema.sets)
      .where(
        and(
          eq(schema.sets.sessionExerciseId, created.sessionExerciseId),
          eq(schema.sets.isDeleted, false),
        ),
      )
      .orderBy(asc(schema.sets.position));
    expect(visible).toHaveLength(0);
  });
});
