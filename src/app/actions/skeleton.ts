'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  createBlankSession,
  createSessionFromRoutine,
} from '@/db/queries/sessions';

/**
 * Form-action wrapper: starts a blank ad-hoc session (WORK-03), then redirects
 * to /log/<id>. The /log/<id> route is a stub in this plan (Plan 01-02) and
 * is replaced by the active-session UI in Plan 01-03.
 *
 * Per Next.js 16 form-action contract, the function receives FormData; we
 * discard it because the action takes no user-supplied input.
 */
export async function createBlankSessionForm(_formData: FormData): Promise<void> {
  const { id } = await createBlankSession();
  revalidatePath('/');
  redirect(`/log/${id}`);
}

/**
 * Form-action wrapper: starts a session from a starter routine (WORK-01 +
 * WORK-02 copy-on-create), then redirects to /log/<id>.
 *
 * The home page binds `routineId` per-button via `.bind(null, r.id)`. The
 * remaining FormData arg is discarded.
 *
 * routineId is validated only by the DB FK — passing a forged id results in
 * the FK rejecting the insert, which propagates as a 500. T-01-02-01 in the
 * plan's threat register documents that as the accepted disposition for
 * single-user app + Vercel function-invocation rate limits + Phase-4
 * deployment hardening.
 */
export async function createSessionFromRoutineForm(
  routineId: string,
  _formData: FormData,
): Promise<void> {
  const { id } = await createSessionFromRoutine(routineId);
  revalidatePath('/');
  redirect(`/log/${id}`);
}

/**
 * Internal-callable variants (return the new session id). Plan 01-03 will
 * call these directly from the active-session client to navigate without
 * going through a form. Kept side-effect-free aside from the DB write.
 */
export async function createBlankSession_internal(): Promise<{ id: string }> {
  const r = await createBlankSession();
  revalidatePath('/');
  return r;
}
export async function createSessionFromRoutine_internal(
  routineId: string,
): Promise<{ id: string }> {
  const r = await createSessionFromRoutine(routineId);
  revalidatePath('/');
  return r;
}
