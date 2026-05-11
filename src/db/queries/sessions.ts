// src/db/queries/sessions.ts
//
// Session read/write paths. Plans 01-03 / 01-04 / 01-05 / 01-06 consume these.
//
// Key design decisions baked into this file:
//   - createSessionFromRoutine COPIES routine_exercises into session_exercises
//     in a single transaction (WORK-02, ARCHITECTURE.md Pattern 1, locked
//     decision in STATE.md). It is NOT a live FK join — editing a routine
//     after creating a session must NOT alter that session's exercise list.
//   - loadSessionView returns the aggregate-loaded shape so RSCs render the
//     full session tree in one round trip.
//   - findPriorIdenticalSession ignores blank sessions (routine_id IS NULL)
//     and only considers ENDED sessions (ended_at IS NOT NULL) so the
//     comparison report excludes the current in-progress session.

import { db } from '../client';
import {
  sessions,
  sessionExercises,
  sets,
  routines,
  routineExercises,
  exercises,
} from '../schema';
import { eq, and, lt, desc, asc, sql } from 'drizzle-orm';
import { nowUtcIso, localDateIso } from '@/lib/dates';
import type { Session, SessionExercise, Set, Routine, Exercise } from '../schema';

export type SessionView = {
  session: Session;
  routine: Routine | null;
  exercises: Array<{
    sessionExercise: SessionExercise;
    exercise: Exercise;
    sets: Set[]; // ordered by position then created_at; drop tiers immediately follow their lead by created_at
  }>;
};

export type SessionWithRoutineName = Session & { routineName: string | null };

/** Ad-hoc blank session (WORK-03). No routine, no copied exercises. */
export async function createBlankSession(): Promise<{ id: string }> {
  const startedAt = nowUtcIso();
  const id = crypto.randomUUID();
  await db.insert(sessions).values({
    id,
    startedAt,
    localDate: localDateIso(startedAt),
  });
  return { id };
}

/** WORK-02 copy-on-create. Reads routine_exercises and snapshots them into
 *  session_exercises inside a single transaction. The transaction is critical:
 *  without it, a partially-created session could end up with no exercises.
 *
 *  If the routine has zero exercises (pathological case — caller passed a
 *  freshly-created empty routine), we still create the session with an empty
 *  exercise list, equivalent to a blank session. The Server Action wrapper
 *  validates routineId exists upstream so this is defence-in-depth, not the
 *  primary check. */
export async function createSessionFromRoutine(
  routineId: string,
): Promise<{ id: string }> {
  const startedAt = nowUtcIso();
  const sessionId = crypto.randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(sessions).values({
      id: sessionId,
      routineId,
      startedAt,
      localDate: localDateIso(startedAt),
    });

    const reRows = await tx
      .select()
      .from(routineExercises)
      .where(eq(routineExercises.routineId, routineId))
      .orderBy(asc(routineExercises.position));

    if (reRows.length > 0) {
      await tx.insert(sessionExercises).values(
        reRows.map((re) => ({
          id: crypto.randomUUID(),
          sessionId,
          exerciseId: re.exerciseId,
          position: re.position,
        })),
      );
    }
  });

  return { id: sessionId };
}

/** Eager-loaded view: session + (optional) routine + ordered list of
 *  (sessionExercise, exercise, sets[]). Soft-deleted sets are excluded;
 *  soft-deleted sessions return null. */
export async function loadSessionView(id: string): Promise<SessionView | null> {
  const [s] = await db.select().from(sessions).where(eq(sessions.id, id));
  if (!s || s.isDeleted) return null;

  let routine: Routine | null = null;
  if (s.routineId) {
    const [r] = await db.select().from(routines).where(eq(routines.id, s.routineId));
    routine = r ?? null;
  }

  const exRows = await db
    .select({ se: sessionExercises, ex: exercises })
    .from(sessionExercises)
    .innerJoin(exercises, eq(sessionExercises.exerciseId, exercises.id))
    .where(eq(sessionExercises.sessionId, id))
    .orderBy(asc(sessionExercises.position));

  // Subquery scope: only sets whose session_exercise belongs to this session.
  // Drizzle's typed `inArray(... select ...)` is ergonomic but generates an IN
  // expression with full driver round-trips; raw sql with parameterised id is
  // simpler and the compiled SQL still parameterises ${id}.
  const setRows = await db
    .select()
    .from(sets)
    .where(
      and(
        eq(sets.isDeleted, false),
        sql`${sets.sessionExerciseId} IN (SELECT id FROM session_exercises WHERE session_id = ${id})`,
      ),
    )
    .orderBy(asc(sets.position), asc(sets.createdAt));

  return {
    session: s,
    routine,
    exercises: exRows.map((row) => ({
      sessionExercise: row.se,
      exercise: row.ex,
      sets: setRows.filter((st) => st.sessionExerciseId === row.se.id),
    })),
  };
}

/** Most recent ENDED session of the same routine before the given UTC time.
 *  Returns null when:
 *    - routineId is null (blank sessions have no comparable prior — D-02e edge case "first time")
 *    - no prior ended session exists for this routine
 *  Plan 01-04's comparison report renders the "first time" badge for null. */
export async function findPriorIdenticalSession(
  routineId: string | null,
  beforeUtcIso: string,
): Promise<SessionView | null> {
  if (!routineId) return null;

  const [prior] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.routineId, routineId),
        eq(sessions.isDeleted, false),
        lt(sessions.startedAt, beforeUtcIso),
        sql`${sessions.endedAt} IS NOT NULL`,
      ),
    )
    .orderBy(desc(sessions.startedAt))
    .limit(1);

  if (!prior) return null;
  return loadSessionView(prior.id);
}

/** For each given exerciseId, return the sets from the most recent prior
 *  ENDED session that contained that exercise. Used by the active-session UI
 *  (Plan 01-03) to render ghost-text previous-values per (exerciseId, setPosition)
 *  per CONTEXT D-01c / LOG-02.
 *
 *  Returns: Map<exerciseId, Set[]>  — sets ordered by position then created_at.
 *  Excludes any prior session older than `maxAgeDays` (default 90) so a
 *  rebuild of the same routine after a long break starts with a clean slate
 *  rather than ghost-texting a 2-year-old number. PITFALLS Pitfall #2 §5.
 *
 *  Per CONTEXT D-02 / HIST-03: caller renders the "first time" UX from missing
 *  keys; this function never returns synthetic placeholders. */
export async function loadPriorPerformances(
  exerciseIds: string[],
  beforeUtcIso: string,
  maxAgeDays = 90,
): Promise<Map<string, Set[]>> {
  const result = new Map<string, Set[]>();
  if (exerciseIds.length === 0) return result;

  const cutoff = new Date(
    new Date(beforeUtcIso).getTime() - maxAgeDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  // One query per exercise. N is small (one routine = ~7 exercises) and the
  // alternative — a single window-function query — is harder to read and not
  // measurably faster at this scale. Re-evaluate when phase 3's history view
  // needs to render this for 12 weeks of sessions.
  for (const exId of exerciseIds) {
    const [priorSe] = await db
      .select({ se: sessionExercises })
      .from(sessionExercises)
      .innerJoin(sessions, eq(sessionExercises.sessionId, sessions.id))
      .where(
        and(
          eq(sessionExercises.exerciseId, exId),
          eq(sessions.isDeleted, false),
          sql`${sessions.endedAt} IS NOT NULL`,
          lt(sessions.startedAt, beforeUtcIso),
          sql`${sessions.startedAt} >= ${cutoff}`,
        ),
      )
      .orderBy(desc(sessions.startedAt))
      .limit(1);

    if (!priorSe) continue;

    const priorSets = await db
      .select()
      .from(sets)
      .where(
        and(eq(sets.sessionExerciseId, priorSe.se.id), eq(sets.isDeleted, false)),
      )
      .orderBy(asc(sets.position), asc(sets.createdAt));

    if (priorSets.length > 0) result.set(exId, priorSets);
  }

  return result;
}

/** Recent (non-deleted) sessions joined with their routine's display name.
 *  Used by the home page's "Recent sessions" card and (later) the history list.
 *  The leftJoin produces routineName=null for blank/ad-hoc sessions. */
export async function listRecentSessions(
  limit = 20,
): Promise<SessionWithRoutineName[]> {
  const rows = await db
    .select({
      session: sessions,
      routineName: routines.name,
    })
    .from(sessions)
    .leftJoin(routines, eq(sessions.routineId, routines.id))
    .where(eq(sessions.isDeleted, false))
    .orderBy(desc(sessions.startedAt))
    .limit(limit);

  return rows.map((row) => ({ ...row.session, routineName: row.routineName }));
}
