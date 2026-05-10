// src/db/queries/routines.ts
//
// Routine read paths for Plans 01-02 / 01-03.
// All queries are server-only (the underlying `db` import is server-only).

import { db } from '../client';
import { routines, routineExercises, exercises } from '../schema';
import { eq, asc } from 'drizzle-orm';
import type { Routine, RoutineExercise, Exercise } from '../schema';

export type RoutineWithExercises = {
  routine: Routine;
  exercises: Array<{ routineExercise: RoutineExercise; exercise: Exercise }>;
};

/** Ordered by routines.position so the home page renders Push / Pull / Legs / Saturday in that order. */
export async function listRoutines(): Promise<Routine[]> {
  return db.select().from(routines).orderBy(asc(routines.position));
}

/** Eager-loaded routine + its exercises in display order.
 *  Used by Plan 01-03's createSessionFromRoutine flow and (future) routine-detail pages. */
export async function getRoutineWithExercises(
  routineId: string,
): Promise<RoutineWithExercises | null> {
  const [r] = await db.select().from(routines).where(eq(routines.id, routineId));
  if (!r) return null;

  const rows = await db
    .select({ re: routineExercises, ex: exercises })
    .from(routineExercises)
    .innerJoin(exercises, eq(routineExercises.exerciseId, exercises.id))
    .where(eq(routineExercises.routineId, routineId))
    .orderBy(asc(routineExercises.position));

  return {
    routine: r,
    exercises: rows.map((row) => ({ routineExercise: row.re, exercise: row.ex })),
  };
}
