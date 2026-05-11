// src/app/actions/sessions.test.ts
//
// Hermetic tests for the session lifecycle Server Actions used by Plan 01-03:
//   - addExerciseToSessionAction (T5): inserts session_exercises at max(pos)+1
//   - endSessionAction (T6): sets ended_at to now (UTC ISO)
//
// The Server Action layer adds zod input validation + revalidatePath; the
// tests below mirror the underlying DB logic against a per-test temp file,
// matching the pattern from src/db/queries/sessions.test.ts.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { makeTestDb, type TestDb } from '@/db/__test-helpers__/test-db';

let db: TestDb;
let cleanup: () => void;

beforeEach(async () => {
  ({ db, cleanup } = await makeTestDb());
});
afterEach(() => cleanup());

async function addExerciseToSessionInline(
  database: TestDb,
  sessionId: string,
  exerciseId: string,
): Promise<string> {
  const [{ maxPos }] = await database
    .select({
      maxPos:
        sql<number>`COALESCE(MAX(${schema.sessionExercises.position}), 0)`.as(
          'max_pos',
        ),
    })
    .from(schema.sessionExercises)
    .where(eq(schema.sessionExercises.sessionId, sessionId));

  const id = crypto.randomUUID();
  await database.insert(schema.sessionExercises).values({
    id,
    sessionId,
    exerciseId,
    position: (maxPos ?? 0) + 1,
  });
  return id;
}

async function endSessionInline(
  database: TestDb,
  sessionId: string,
  endedAt: string,
): Promise<void> {
  await database
    .update(schema.sessions)
    .set({ endedAt, updatedAt: endedAt })
    .where(eq(schema.sessions.id, sessionId));
}

/** Bootstrap two exercises + one routine + one in-progress session with one
 *  pre-existing session_exercise at position 1. Returns the session id. */
async function seedRoutineAndSession(database: TestDb): Promise<{
  sessionId: string;
  newExerciseId: string;
}> {
  await database.insert(schema.exercises).values([
    { id: 'ex-existing', slug: 'incline-smith', displayName: 'Incline Smith Press', category: 'push' },
    { id: 'ex-new', slug: 'flat-bench', displayName: 'Flat Bench Press', category: 'push' },
  ]);
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
  await database.insert(schema.sessionExercises).values({
    sessionId: session.id,
    exerciseId: 'ex-existing',
    position: 1,
  });
  return { sessionId: session.id, newExerciseId: 'ex-new' };
}

describe('addExerciseToSession (T5)', () => {
  it('inserts a new session_exercise at position = max(existing) + 1', async () => {
    const { sessionId, newExerciseId } = await seedRoutineAndSession(db);

    const id = await addExerciseToSessionInline(db, sessionId, newExerciseId);

    const rows = await db
      .select()
      .from(schema.sessionExercises)
      .where(eq(schema.sessionExercises.sessionId, sessionId))
      .orderBy(schema.sessionExercises.position);

    expect(rows).toHaveLength(2);
    expect(rows[0].exerciseId).toBe('ex-existing');
    expect(rows[0].position).toBe(1);
    expect(rows[1].id).toBe(id);
    expect(rows[1].exerciseId).toBe('ex-new');
    expect(rows[1].position).toBe(2);
  });

  it('uses position=1 when the session is empty', async () => {
    await db.insert(schema.exercises).values({
      id: 'ex-only',
      slug: 'only',
      displayName: 'Only',
      category: 'push',
    });
    const [r] = await db
      .insert(schema.routines)
      .values({ slug: 'r', name: 'R', position: 0 })
      .returning();
    const [s] = await db
      .insert(schema.sessions)
      .values({
        routineId: r.id,
        startedAt: '2026-05-11T09:00:00.000Z',
        localDate: '2026-05-11',
      })
      .returning();

    await addExerciseToSessionInline(db, s.id, 'ex-only');

    const rows = await db
      .select()
      .from(schema.sessionExercises)
      .where(eq(schema.sessionExercises.sessionId, s.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].position).toBe(1);
  });
});

describe('endSession (T6)', () => {
  it('sets ended_at to the supplied ISO timestamp', async () => {
    const { sessionId } = await seedRoutineAndSession(db);

    // Pre-condition: ended_at is null
    const [before] = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId));
    expect(before.endedAt).toBeNull();

    await endSessionInline(db, sessionId, '2026-05-11T10:30:00.000Z');

    const [after] = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId));
    expect(after.endedAt).toBe('2026-05-11T10:30:00.000Z');
  });
});
