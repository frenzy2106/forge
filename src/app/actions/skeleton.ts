'use server';

import { db } from '@/db/client';
import { sessions } from '@/db/schema';
import { nowUtcIso, localDateIso } from '@/lib/dates';
import { revalidatePath } from 'next/cache';

/**
 * Walking-skeleton Server Action — returns the new session ID.
 *
 * Inserts a blank in-progress session row and revalidates `/`. No user input,
 * no validation surface — the surface is added in Plan 01-03 (active session
 * UI) and the threat-register entry T-01-01-06 (SQL-injection mitigation)
 * starts to matter then. For now we use Drizzle's parameterized insert.
 *
 * Plan 01-03 will call this directly and navigate to /session/<id>. For the
 * walking-skeleton home form, use `createBlankSessionForm` below — Next.js
 * `<form action={...}>` requires `Promise<void>`.
 */
export async function createBlankSession(): Promise<{ id: string }> {
  const startedAt = nowUtcIso();
  const id = crypto.randomUUID();

  await db.insert(sessions).values({
    id,
    startedAt,
    localDate: localDateIso(startedAt),
  });

  revalidatePath('/');
  return { id };
}

/**
 * Form-action adapter for `<form action={...}>`. Discards the return value so
 * the signature matches the `(formData: FormData) => void | Promise<void>`
 * type Next.js requires.
 */
export async function createBlankSessionForm(_formData: FormData): Promise<void> {
  await createBlankSession();
}
