import { describe, it, expect, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { eq, sql } from 'drizzle-orm';
import * as schema from './schema';

let db: ReturnType<typeof drizzle>;

// drizzle-orm/libsql wraps the underlying libSQL error and re-throws with a
// generic "Failed query: ..." message. The semantic information is on the
// `cause` chain via the `code` / `extendedCode` property — match on those.
async function expectSqliteError(
  promise: Promise<unknown>,
  expected: 'SQLITE_CONSTRAINT_UNIQUE' | 'SQLITE_CONSTRAINT_FOREIGNKEY',
): Promise<void> {
  try {
    await promise;
  } catch (err) {
    // Walk the cause chain looking for a matching code / extendedCode.
    const codes = new Set<string>();
    let cur: unknown = err;
    while (cur && typeof cur === 'object') {
      const c = cur as { code?: string; extendedCode?: string | number; cause?: unknown };
      if (c.code) codes.add(c.code);
      if (c.extendedCode !== undefined) codes.add(String(c.extendedCode));
      cur = c.cause;
    }
    // SQLITE_CONSTRAINT is the parent code; the extended code identifies the
    // exact kind. libSQL is inconsistent: some FK violations come back as
    // SQLITE_CONSTRAINT_FOREIGNKEY, others as SQLITE_CONSTRAINT_TRIGGER (when
    // FKs are emulated via internal triggers). Both are valid signals that
    // the schema-level constraint we declared is being enforced; accept either
    // for FK assertions, but require the exact code for UNIQUE.
    const fkKinds = new Set([
      'SQLITE_CONSTRAINT_FOREIGNKEY',
      'SQLITE_CONSTRAINT_TRIGGER',
    ]);
    const ok =
      codes.has(expected) ||
      (expected === 'SQLITE_CONSTRAINT_FOREIGNKEY' &&
        [...codes].some((c) => fkKinds.has(c)));
    if (!ok) {
      throw new Error(
        `Expected ${expected} error, got codes=${[...codes].join(',')} message=${String(err)}`,
      );
    }
    return;
  }
  throw new Error(`Expected promise to reject with ${expected}, but it resolved.`);
}

beforeEach(async () => {
  // Fresh in-memory libSQL DB for each test, with FK enforcement explicitly ON.
  // Hosted Turso has FKs ON by default; :memory: needs the pragma to make our
  // RESTRICT/CASCADE tests assert real behaviour.
  const client = createClient({ url: ':memory:' });
  db = drizzle(client, { schema });
  await db.run(sql`PRAGMA foreign_keys = ON`);
  await migrate(db, { migrationsFolder: './drizzle/migrations' });
});

describe('schema: exercises', () => {
  it('has the expected columns (WORK-04: immutable IDs + display_name)', async () => {
    const cols = await db.run(sql`PRAGMA table_info('exercises')`);
    const names = (cols.rows as unknown as Array<{ name: string }>).map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'id',
        'slug',
        'display_name',
        'category',
        'primary_muscle',
        'is_compound',
        'default_unit',
        'default_rest_seconds',
        'notes',
        'created_at',
        'updated_at',
      ]),
    );
  });

  it('enforces unique slug', async () => {
    await db.insert(schema.exercises).values({
      slug: 'incline-smith-press',
      displayName: 'Incline Smith Press',
      category: 'push',
    });
    await expectSqliteError(
      db.insert(schema.exercises).values({
        slug: 'incline-smith-press',
        displayName: 'Different Display',
        category: 'push',
      }),
      'SQLITE_CONSTRAINT_UNIQUE',
    );
  });
});

describe('schema: routines + routine_exercises', () => {
  it('routines table has slug, name, position columns', async () => {
    const cols = await db.run(sql`PRAGMA table_info('routines')`);
    const names = (cols.rows as unknown as Array<{ name: string }>).map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining(['id', 'slug', 'name', 'position', 'notes', 'created_at', 'updated_at']),
    );
  });

  it('routine_exercises has FK to routines (CASCADE) and exercises (RESTRICT)', async () => {
    const [ex] = await db
      .insert(schema.exercises)
      .values({ slug: 'bench', displayName: 'Bench', category: 'push' })
      .returning();
    const [r] = await db
      .insert(schema.routines)
      .values({ slug: 'push', name: 'Push', position: 0 })
      .returning();

    await db.insert(schema.routineExercises).values({
      routineId: r.id,
      exerciseId: ex.id,
      position: 1,
    });

    // Deleting the exercise should be REJECTED while routine_exercises holds it.
    await expectSqliteError(
      db.delete(schema.exercises).where(eq(schema.exercises.id, ex.id)),
      'SQLITE_CONSTRAINT_FOREIGNKEY',
    );

    // Deleting the routine cascades to routine_exercises.
    await db.delete(schema.routines).where(eq(schema.routines.id, r.id));
    const remaining = await db.select().from(schema.routineExercises);
    expect(remaining).toHaveLength(0);
  });
});

describe('schema: sessions (replaces 01-01 minimal table)', () => {
  it('has routine_id (nullable, FK to routines, ON DELETE SET NULL) + intent + is_deleted', async () => {
    const cols = await db.run(sql`PRAGMA table_info('sessions')`);
    const names = (cols.rows as unknown as Array<{ name: string }>).map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'id',
        'routine_id',
        'started_at',
        'ended_at',
        'local_date',
        'intent',
        'notes',
        'is_deleted',
        'created_at',
        'updated_at',
      ]),
    );
  });

  it('inserts a blank session (no routine) and reads it back', async () => {
    const [s] = await db
      .insert(schema.sessions)
      .values({ startedAt: '2026-05-10T10:00:00.000Z', localDate: '2026-05-10' })
      .returning();
    expect(s.id).toBeTruthy();
    expect(s.routineId).toBeNull();
    expect(s.intent).toBe('normal');
    expect(s.isDeleted).toBe(false);
  });

  it('inserts a session linked to a routine, then deleting the routine sets routine_id to NULL (no cascade)', async () => {
    const [r] = await db
      .insert(schema.routines)
      .values({ slug: 'push', name: 'Push', position: 0 })
      .returning();
    const [s] = await db
      .insert(schema.sessions)
      .values({ routineId: r.id, startedAt: '2026-05-10T10:00:00.000Z', localDate: '2026-05-10' })
      .returning();

    await db.delete(schema.routines).where(eq(schema.routines.id, r.id));

    const [after] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, s.id));
    expect(after).toBeDefined();
    expect(after.routineId).toBeNull();
  });
});

describe('schema: session_exercises', () => {
  it('cascades on session delete, but RESTRICTs on exercise delete', async () => {
    const [ex] = await db
      .insert(schema.exercises)
      .values({ slug: 'bench', displayName: 'Bench', category: 'push' })
      .returning();
    const [s] = await db
      .insert(schema.sessions)
      .values({ startedAt: '2026-05-10T10:00:00.000Z', localDate: '2026-05-10' })
      .returning();
    await db.insert(schema.sessionExercises).values({
      sessionId: s.id,
      exerciseId: ex.id,
      position: 1,
    });

    // Cannot delete an exercise that has session_exercise history.
    await expectSqliteError(
      db.delete(schema.exercises).where(eq(schema.exercises.id, ex.id)),
      'SQLITE_CONSTRAINT_FOREIGNKEY',
    );

    // Deleting the session cascades to its session_exercises.
    await db.delete(schema.sessions).where(eq(schema.sessions.id, s.id));
    const remaining = await db.select().from(schema.sessionExercises);
    expect(remaining).toHaveLength(0);
  });
});

describe('schema: sets (PITFALLS Pitfall #2 — hardest-to-undo decision)', () => {
  it('has parent_set_id self-FK + is_drop_tier + duration_seconds + distance_meters + rpe', async () => {
    const cols = await db.run(sql`PRAGMA table_info('sets')`);
    const names = (cols.rows as unknown as Array<{ name: string }>).map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'id',
        'session_exercise_id',
        'position',
        'reps',
        'weight_kg',
        'duration_seconds',
        'distance_meters',
        'is_drop_tier',
        'parent_set_id',
        'is_warmup',
        'rpe',
        'logged_at',
        'is_deleted',
        'created_at',
        'updated_at',
      ]),
    );
  });

  it('persists a drop-tier set linked via parent_set_id', async () => {
    const [ex] = await db
      .insert(schema.exercises)
      .values({ slug: 'bench', displayName: 'Bench', category: 'push' })
      .returning();
    const [s] = await db
      .insert(schema.sessions)
      .values({ startedAt: '2026-05-10T10:00:00.000Z', localDate: '2026-05-10' })
      .returning();
    const [se] = await db
      .insert(schema.sessionExercises)
      .values({ sessionId: s.id, exerciseId: ex.id, position: 1 })
      .returning();

    const [lead] = await db
      .insert(schema.sets)
      .values({
        sessionExerciseId: se.id,
        position: 1,
        reps: 8,
        weightKg: 40,
        loggedAt: '2026-05-10T10:01:00.000Z',
      })
      .returning();
    const [tier] = await db
      .insert(schema.sets)
      .values({
        sessionExerciseId: se.id,
        position: 1,
        reps: 6,
        weightKg: 30,
        isDropTier: true,
        parentSetId: lead.id,
        loggedAt: '2026-05-10T10:01:30.000Z',
      })
      .returning();

    expect(tier.parentSetId).toBe(lead.id);
    expect(tier.isDropTier).toBe(true);
    expect(lead.isDropTier).toBe(false);
    expect(lead.parentSetId).toBeNull();
  });

  it('cascades on session delete (session → session_exercises → sets)', async () => {
    const [ex] = await db
      .insert(schema.exercises)
      .values({ slug: 'bench', displayName: 'Bench', category: 'push' })
      .returning();
    const [s] = await db
      .insert(schema.sessions)
      .values({ startedAt: '2026-05-10T10:00:00.000Z', localDate: '2026-05-10' })
      .returning();
    const [se] = await db
      .insert(schema.sessionExercises)
      .values({ sessionId: s.id, exerciseId: ex.id, position: 1 })
      .returning();
    await db.insert(schema.sets).values({
      sessionExerciseId: se.id,
      position: 1,
      reps: 8,
      weightKg: 40,
      loggedAt: '2026-05-10T10:01:00.000Z',
    });

    await db.delete(schema.sessions).where(eq(schema.sessions.id, s.id));

    const remainingSes = await db.select().from(schema.sessionExercises);
    const remainingSets = await db.select().from(schema.sets);
    expect(remainingSes).toHaveLength(0);
    expect(remainingSets).toHaveLength(0);
  });

  it('persists endurance-style sets with duration_seconds + distance_meters (CONTEXT D-03d)', async () => {
    const [ex] = await db
      .insert(schema.exercises)
      .values({ slug: 'rowing-machine', displayName: 'Rowing Machine', category: 'endurance' })
      .returning();
    const [s] = await db
      .insert(schema.sessions)
      .values({ startedAt: '2026-05-10T10:00:00.000Z', localDate: '2026-05-10' })
      .returning();
    const [se] = await db
      .insert(schema.sessionExercises)
      .values({ sessionId: s.id, exerciseId: ex.id, position: 1 })
      .returning();
    const [row] = await db
      .insert(schema.sets)
      .values({
        sessionExerciseId: se.id,
        position: 1,
        durationSeconds: 600,
        distanceMeters: 2200,
        loggedAt: '2026-05-10T10:11:00.000Z',
      })
      .returning();

    expect(row.durationSeconds).toBe(600);
    expect(row.distanceMeters).toBe(2200);
    expect(row.reps).toBeNull();
    expect(row.weightKg).toBeNull();
  });
});
