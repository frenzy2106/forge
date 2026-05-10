// src/db/queries/exercises.ts
//
// Exercise catalog read paths. Used by the Plan 01-03 mid-session
// "+ Add exercise" autocomplete (CONTEXT D-01e) and any future
// catalog-management screens.

import { db } from '../client';
import { exercises } from '../schema';
import { like, or, asc } from 'drizzle-orm';
import type { Exercise } from '../schema';

/** All catalog exercises, sorted by display name for autocomplete. */
export async function listExercises(): Promise<Exercise[]> {
  return db.select().from(exercises).orderBy(asc(exercises.displayName));
}

/** Substring search over display_name + slug.
 *  - Empty/whitespace query returns the full list (sorted) — convenient for
 *    rendering the catalog when the user opens the search drawer without typing.
 *  - Limited to 20 results so the autocomplete list stays glanceable on mobile.
 *  - libSQL/SQLite LIKE is case-insensitive for ASCII by default (the catalog
 *    is ASCII), so we don't need explicit lower() wrapping. */
export async function searchExercises(query: string): Promise<Exercise[]> {
  if (!query.trim()) return listExercises();
  const pattern = `%${query.trim()}%`;
  return db
    .select()
    .from(exercises)
    .where(or(like(exercises.displayName, pattern), like(exercises.slug, pattern)))
    .orderBy(asc(exercises.displayName))
    .limit(20);
}
