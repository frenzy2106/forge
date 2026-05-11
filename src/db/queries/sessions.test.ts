// src/db/queries/sessions.test.ts
//
// Hermetic tests for createSessionFromRoutine copy-on-create (WORK-02 +
// ARCHITECTURE.md Pattern 1). This is the single most important
// architectural property in Phase 1: editing a routine after a session has
// been created MUST NOT alter that session's exercise list.
//
// Backed by a temp-file libSQL test DB (see __test-helpers__/test-db.ts) —
// `:memory:` cannot be used because the libSQL JS client loses its in-memory
// state across `db.transaction()` calls.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq, asc, desc, and } from 'drizzle-orm';
import * as schema from '../schema';
import { makeTestDb, type TestDb } from '../__test-helpers__/test-db';

let db: TestDb;
let cleanup: () => void;

beforeEach(async () => {
  ({ db, cleanup } = await makeTestDb());
});
afterEach(() => cleanup());

// Inline mirror of queries/sessions.ts::createSessionFromRoutine. The real fn
// imports `db` from the env-bound singleton; the test DB is a different
// instance, so we replay the same transactional logic here.
async function createSessionFromRoutineInline(
  database: TestDb,
  routineId: string,
): Promise<string> {
  const sessionId = crypto.randomUUID();
  await database.transaction(async (tx) => {
    await tx.insert(schema.sessions).values({
      id: sessionId,
      routineId,
      startedAt: '2026-05-10T10:00:00.000Z',
      localDate: '2026-05-10',
    });
    const reRows = await tx
      .select()
      .from(schema.routineExercises)
      .where(eq(schema.routineExercises.routineId, routineId))
      .orderBy(asc(schema.routineExercises.position));
    if (reRows.length > 0) {
      await tx.insert(schema.sessionExercises).values(
        reRows.map((re) => ({
          id: crypto.randomUUID(),
          sessionId,
          exerciseId: re.exerciseId,
          position: re.position,
        })),
      );
    }
  });
  return sessionId;
}

describe('createSessionFromRoutine: copy-on-create (WORK-02)', () => {
  it('copies routine_exercises into session_exercises at session-create time', async () => {
    // Setup: 1 routine with 3 exercises in positions 1, 2, 3.
    const exIds = ['ex-1', 'ex-2', 'ex-3'];
    for (const id of exIds) {
      await db
        .insert(schema.exercises)
        .values({ id, slug: id, displayName: id.toUpperCase(), category: 'push' });
    }
    const [r] = await db
      .insert(schema.routines)
      .values({ slug: 'r1', name: 'R1', position: 0 })
      .returning();
    for (let i = 0; i < exIds.length; i++) {
      await db
        .insert(schema.routineExercises)
        .values({ routineId: r.id, exerciseId: exIds[i], position: i + 1 });
    }

    const sessionId = await createSessionFromRoutineInline(db, r.id);

    const seRowsBefore = await db
      .select()
      .from(schema.sessionExercises)
      .where(eq(schema.sessionExercises.sessionId, sessionId))
      .orderBy(asc(schema.sessionExercises.position));
    expect(seRowsBefore.length).toBe(3);
    expect(seRowsBefore.map((row) => row.exerciseId)).toEqual(exIds);

    // MUTATE the routine after session creation: add a 4th exercise.
    await db
      .insert(schema.exercises)
      .values({ id: 'ex-4', slug: 'ex-4', displayName: 'EX-4', category: 'push' });
    await db
      .insert(schema.routineExercises)
      .values({ routineId: r.id, exerciseId: 'ex-4', position: 4 });

    // The pre-existing session must be UNCHANGED — copy-on-create, not live join.
    const seRowsAfter = await db
      .select()
      .from(schema.sessionExercises)
      .where(eq(schema.sessionExercises.sessionId, sessionId))
      .orderBy(asc(schema.sessionExercises.position));
    expect(seRowsAfter.length).toBe(3);
    expect(seRowsAfter.map((row) => row.exerciseId)).toEqual(exIds);

    // BUT a NEW session created right now should pick up the 4th exercise.
    const newSessionId = await createSessionFromRoutineInline(db, r.id);
    const newSe = await db
      .select()
      .from(schema.sessionExercises)
      .where(eq(schema.sessionExercises.sessionId, newSessionId))
      .orderBy(asc(schema.sessionExercises.position));
    expect(newSe.length).toBe(4);
  });

  it('handles a routine with zero exercises (degenerate but valid)', async () => {
    const [r] = await db
      .insert(schema.routines)
      .values({ slug: 'empty', name: 'Empty', position: 0 })
      .returning();

    const sessionId = await createSessionFromRoutineInline(db, r.id);

    const [s] = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId));
    expect(s).toBeDefined();
    expect(s.routineId).toBe(r.id);
    const se = await db
      .select()
      .from(schema.sessionExercises)
      .where(eq(schema.sessionExercises.sessionId, sessionId));
    expect(se.length).toBe(0);
  });
});

// HIST-04 (Plan 01-05): the routine filter on the home page's recent-sessions
// list. The queries function takes an options bag with an optional `routineId`
// — we replay the same query shape inline here against a hermetic DB.
async function listRecentSessionsInline(
  database: TestDb,
  opts: { limit?: number; routineId?: string | null } = {},
) {
  const { limit = 20, routineId } = opts;
  const conditions = [eq(schema.sessions.isDeleted, false)];
  if (routineId) conditions.push(eq(schema.sessions.routineId, routineId));
  const rows = await database
    .select({
      session: schema.sessions,
      routineName: schema.routines.name,
    })
    .from(schema.sessions)
    .leftJoin(schema.routines, eq(schema.sessions.routineId, schema.routines.id))
    .where(and(...conditions))
    .orderBy(desc(schema.sessions.startedAt))
    .limit(limit);
  return rows.map((row) => ({ ...row.session, routineName: row.routineName }));
}

describe('listRecentSessions: routine filter (HIST-04)', () => {
  it('returns ALL non-deleted sessions when no routineId is supplied', async () => {
    // Two routines, one blank (NULL routine_id), all non-deleted.
    const [push] = await db
      .insert(schema.routines)
      .values({ slug: 'push', name: 'Push', position: 0 })
      .returning();
    const [pull] = await db
      .insert(schema.routines)
      .values({ slug: 'pull', name: 'Pull', position: 1 })
      .returning();

    await db.insert(schema.sessions).values([
      {
        id: 's-push-1',
        routineId: push.id,
        startedAt: '2026-05-08T10:00:00.000Z',
        localDate: '2026-05-08',
      },
      {
        id: 's-pull-1',
        routineId: pull.id,
        startedAt: '2026-05-09T10:00:00.000Z',
        localDate: '2026-05-09',
      },
      {
        id: 's-blank-1',
        routineId: null,
        startedAt: '2026-05-10T10:00:00.000Z',
        localDate: '2026-05-10',
      },
    ]);

    const all = await listRecentSessionsInline(db);
    expect(all).toHaveLength(3);
    // Newest first
    expect(all.map((s) => s.id)).toEqual(['s-blank-1', 's-pull-1', 's-push-1']);
    // Blank session has null routineName (left join produces this)
    expect(all.find((s) => s.id === 's-blank-1')!.routineName).toBeNull();
    expect(all.find((s) => s.id === 's-push-1')!.routineName).toBe('Push');
  });

  it('returns ONLY sessions matching the supplied routineId', async () => {
    const [push] = await db
      .insert(schema.routines)
      .values({ slug: 'push', name: 'Push', position: 0 })
      .returning();
    const [pull] = await db
      .insert(schema.routines)
      .values({ slug: 'pull', name: 'Pull', position: 1 })
      .returning();

    await db.insert(schema.sessions).values([
      {
        id: 's-push-1',
        routineId: push.id,
        startedAt: '2026-05-07T10:00:00.000Z',
        localDate: '2026-05-07',
      },
      {
        id: 's-pull-1',
        routineId: pull.id,
        startedAt: '2026-05-08T10:00:00.000Z',
        localDate: '2026-05-08',
      },
      {
        id: 's-push-2',
        routineId: push.id,
        startedAt: '2026-05-09T10:00:00.000Z',
        localDate: '2026-05-09',
      },
      {
        id: 's-blank-1',
        routineId: null,
        startedAt: '2026-05-10T10:00:00.000Z',
        localDate: '2026-05-10',
      },
    ]);

    // Filter by Push: only the two Push sessions, newest first. The blank
    // session is excluded because its routine_id is NULL (NULL never equals
    // a string id), which matches the home-page UX intent.
    const pushOnly = await listRecentSessionsInline(db, { routineId: push.id });
    expect(pushOnly.map((s) => s.id)).toEqual(['s-push-2', 's-push-1']);

    // Filter by Pull: only the one Pull session.
    const pullOnly = await listRecentSessionsInline(db, { routineId: pull.id });
    expect(pullOnly.map((s) => s.id)).toEqual(['s-pull-1']);

    // Filter by an id that doesn't match any session: empty list (this is
    // the "stale URL ?routine=<deleted-routine>" path).
    const noMatch = await listRecentSessionsInline(db, {
      routineId: 'nonexistent-routine-id',
    });
    expect(noMatch).toEqual([]);
  });

  it('excludes soft-deleted sessions from the filtered list (HIST-05 audit-trail invariant)', async () => {
    const [push] = await db
      .insert(schema.routines)
      .values({ slug: 'push', name: 'Push', position: 0 })
      .returning();

    await db.insert(schema.sessions).values([
      {
        id: 's-keep',
        routineId: push.id,
        startedAt: '2026-05-08T10:00:00.000Z',
        localDate: '2026-05-08',
      },
      {
        id: 's-deleted',
        routineId: push.id,
        startedAt: '2026-05-09T10:00:00.000Z',
        localDate: '2026-05-09',
        isDeleted: true,
      },
    ]);

    const out = await listRecentSessionsInline(db, { routineId: push.id });
    expect(out.map((s) => s.id)).toEqual(['s-keep']);
  });

  it('treats undefined/null routineId as "no filter"', async () => {
    const [push] = await db
      .insert(schema.routines)
      .values({ slug: 'push', name: 'Push', position: 0 })
      .returning();
    await db.insert(schema.sessions).values({
      id: 's-1',
      routineId: push.id,
      startedAt: '2026-05-08T10:00:00.000Z',
      localDate: '2026-05-08',
    });

    expect(await listRecentSessionsInline(db, {})).toHaveLength(1);
    expect(
      await listRecentSessionsInline(db, { routineId: undefined }),
    ).toHaveLength(1);
    expect(
      await listRecentSessionsInline(db, { routineId: null }),
    ).toHaveLength(1);
  });
});
