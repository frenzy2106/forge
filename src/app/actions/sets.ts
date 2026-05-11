'use server';

// src/app/actions/sets.ts
//
// Server Actions for set CRUD — invoked by the active-session UI's TanStack
// Query mutations (use-active-session.ts). These are the public-internet
// entry points that the threat register (T-01-03-01..06) governs.
//
// Important: do NOT call revalidatePath('/log/[sessionId]') from these
// actions. The active-session route is owned by TanStack Query during a live
// session; an RSC re-render here would stomp on the optimistic cache state
// and the user would see their just-logged set "blink" away then back. We
// only revalidate when the user navigates away (endSession in sessions.ts).

import { z } from 'zod';
import {
  insertSet,
  updateSet,
  softDeleteSet,
  tagSetAsDropTier,
} from '@/db/queries/sets';

// id columns are crypto.randomUUID() so we accept any non-empty string id.
// (zod's `.uuid()` would over-constrain — sqlite stores them as plain text,
// and a stricter check buys nothing for a single-user app.)
const idSchema = z.string().min(1);

const LogSetSchema = z.object({
  sessionExerciseId: idSchema,
  position: z.number().int().positive(),
  reps: z.number().int().nonnegative().optional(),
  weightKg: z.number().nonnegative().optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
  distanceMeters: z.number().nonnegative().optional(),
  parentSetId: idSchema.optional(),
});
export type LogSetActionInput = z.infer<typeof LogSetSchema>;

export async function logSetAction(
  input: LogSetActionInput,
): Promise<{ id: string }> {
  const parsed = LogSetSchema.parse(input);
  const set = await insertSet({
    ...parsed,
    isDropTier: !!parsed.parentSetId,
  });
  return { id: set.id };
}

const EditSetSchema = z.object({
  setId: idSchema,
  reps: z.number().int().nonnegative().optional(),
  weightKg: z.number().nonnegative().optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
  distanceMeters: z.number().nonnegative().optional(),
});
export type EditSetActionInput = z.infer<typeof EditSetSchema>;

export async function editSetAction(input: EditSetActionInput): Promise<void> {
  const parsed = EditSetSchema.parse(input);
  const { setId, ...patch } = parsed;
  await updateSet(setId, patch);
}

export async function deleteSetAction(setId: string): Promise<void> {
  idSchema.parse(setId);
  await softDeleteSet(setId);
}

export async function tagAsDropTierAction(
  setId: string,
  parentSetId: string,
): Promise<void> {
  idSchema.parse(setId);
  idSchema.parse(parentSetId);
  await tagSetAsDropTier(setId, parentSetId);
}
