'use server';

// src/app/actions/sessions.ts
//
// Server Actions for session lifecycle — addExerciseToSessionAction (called
// from the +Add Exercise drawer) and endSessionAction (called from the End
// Session confirmation dialog). The "create session" actions remain in
// src/app/actions/skeleton.ts for now (Plan 01-02 owned them).
//
// endSessionAction revalidates `/` (so the home page's recent-sessions list
// shows the new ended marker on next visit) and the `/sessions/[id]/compare`
// route (Plan 01-04 will own it; revalidation is harmless when the route is
// still a stub).

import { revalidatePath } from 'next/cache';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { sessions, sessionExercises } from '@/db/schema';
import { nowUtcIso } from '@/lib/dates';

const idSchema = z.string().min(1);

export async function addExerciseToSessionAction(
  sessionId: string,
  exerciseId: string,
): Promise<{ sessionExerciseId: string }> {
  idSchema.parse(sessionId);
  idSchema.parse(exerciseId);

  // Find current max position. COALESCE keeps an empty session safe
  // (sessions can be created blank via WORK-03 then have exercises added
  // mid-session — first +Add Exercise lands at position 1).
  const [{ maxPos }] = await db
    .select({
      maxPos: sql<number>`COALESCE(MAX(${sessionExercises.position}), 0)`.as(
        'max_pos',
      ),
    })
    .from(sessionExercises)
    .where(eq(sessionExercises.sessionId, sessionId));

  const id = crypto.randomUUID();
  await db.insert(sessionExercises).values({
    id,
    sessionId,
    exerciseId,
    position: (maxPos ?? 0) + 1,
  });
  return { sessionExerciseId: id };
}

export async function endSessionAction(sessionId: string): Promise<void> {
  idSchema.parse(sessionId);
  const now = nowUtcIso();
  await db
    .update(sessions)
    .set({ endedAt: now, updatedAt: now })
    .where(eq(sessions.id, sessionId));
  // Home page recent-sessions feed needs to reflect the new ended marker
  // immediately on next visit. The compare route is still a stub in 01-03;
  // revalidating is a no-op until 01-04 ships content.
  revalidatePath('/');
  revalidatePath(`/sessions/${sessionId}/compare`);
}

// ─── saveSessionNotesAction (Plan 01-04 / D-02f) ─────────────────────────
//
// Notes field on the comparison report saves on blur. Plain text only —
// React renders via JSX so XSS is not a concern (no dangerouslySetInnerHTML).
// 4000-char cap prevents pathological storage growth from a long-press paste.
//
// We update sessions.notes directly and revalidate the compare path so a
// post-save refresh reflects the persisted value. revalidating `/` is a
// no-op (notes aren't shown on home) but we keep that path's data cache
// uninvolved.

const SaveNotesSchema = z.object({
  sessionId: z.string().min(1),
  notes: z.string().max(4000),
});

export async function saveSessionNotesAction(input: {
  sessionId: string;
  notes: string;
}): Promise<void> {
  const parsed = SaveNotesSchema.parse(input);
  const now = nowUtcIso();
  await db
    .update(sessions)
    .set({ notes: parsed.notes, updatedAt: now })
    .where(eq(sessions.id, parsed.sessionId));
  revalidatePath(`/sessions/${parsed.sessionId}/compare`);
}

/**
 * Soft-delete a session. Used by:
 *   - "Discard session" on the active-session screen for empty sessions.
 *   - "Delete session" on the past-session detail screen for ended sessions
 *     the user wants to remove from history.
 *
 * Soft-delete preserves the row + audit trail (is_deleted = 1). loadSessionView
 * already filters these out so they vanish from every UI immediately.
 *
 * Caller redirects after the action returns (this action does not redirect
 * itself so it can be used from both client transitions and form actions).
 */
export async function deleteSessionAction(sessionId: string): Promise<void> {
  idSchema.parse(sessionId);
  const now = nowUtcIso();
  await db
    .update(sessions)
    .set({ isDeleted: true, updatedAt: now })
    .where(eq(sessions.id, sessionId));
  revalidatePath('/');
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/sessions/${sessionId}/compare`);
}
