// src/db/queries/sets.ts
//
// Set CRUD helpers used by the Plan 01-03 active-session UI's Server Actions.
//
// Soft-delete via `is_deleted` rather than hard delete (HIST-05): preserves
// the audit trail so HIST-06's edit history view in Plan 01-05 can show what
// the user originally logged before they deleted/edited it.
//
// Import path note: this file is server-only. Never import from a Client
// Component — pulls in the libSQL driver via @/db/client.

import { eq, and, asc } from 'drizzle-orm';
import { db } from '../client';
import { sets } from '../schema';
import { nowUtcIso } from '@/lib/dates';
import type { Set } from '../schema';

export type LogSetInput = {
  sessionExerciseId: string;
  position: number;
  reps?: number;
  weightKg?: number;
  durationSeconds?: number;
  distanceMeters?: number;
  isDropTier?: boolean;
  parentSetId?: string;
};

/** Insert a single set. Returns the created row (incl. server-side defaulted
 *  created_at/updated_at) so optimistic UI can replace its temp id with the
 *  authoritative one. */
export async function insertSet(input: LogSetInput): Promise<Set> {
  const id = crypto.randomUUID();
  const now = nowUtcIso();
  const [created] = await db
    .insert(sets)
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

/** Patch the value columns on a set. Bumps updated_at so HIST-06's edit
 *  history can render an "edited" badge. */
export async function updateSet(
  setId: string,
  patch: Partial<
    Pick<Set, 'reps' | 'weightKg' | 'durationSeconds' | 'distanceMeters'>
  >,
): Promise<void> {
  await db
    .update(sets)
    .set({ ...patch, updatedAt: nowUtcIso() })
    .where(eq(sets.id, setId));
}

/** Soft-delete (HIST-05). Reads always filter `is_deleted = false`. */
export async function softDeleteSet(setId: string): Promise<void> {
  await db
    .update(sets)
    .set({ isDeleted: true, updatedAt: nowUtcIso() })
    .where(eq(sets.id, setId));
}

/** Tag an existing set as a drop-tier child of `parentSetId`. The caller
 *  computes parent_id from the in-cache ordering: the most recent NON-drop
 *  set in the same session_exercise that was created BEFORE the target. */
export async function tagSetAsDropTier(
  setId: string,
  parentSetId: string,
): Promise<void> {
  await db
    .update(sets)
    .set({ isDropTier: true, parentSetId, updatedAt: nowUtcIso() })
    .where(eq(sets.id, setId));
}

/** Fetch all (non-deleted) sets for one session_exercise, ordered by
 *  position then created_at so drop tiers immediately follow their lead. */
export async function getSetsForSessionExercise(
  sessionExerciseId: string,
): Promise<Set[]> {
  return db
    .select()
    .from(sets)
    .where(
      and(eq(sets.sessionExerciseId, sessionExerciseId), eq(sets.isDeleted, false)),
    )
    .orderBy(asc(sets.position), asc(sets.createdAt));
}
