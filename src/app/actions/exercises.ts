'use server';

// src/app/actions/exercises.ts
//
// Server Actions for the exercise catalog. Currently exposes one action:
// createExerciseAction — used by the +Add Exercise drawer's "Create new"
// form so users can extend the seeded 28 exercises with their own (e.g.,
// when the gym adds a new machine, or for variations).
//
// Slug strategy: kebab-case the display name; if it collides with an
// existing slug, append a short timestamp suffix. This keeps the slug
// human-readable in the common case and never blocks creation.

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { exercises } from '@/db/schema';

const idSchema = z.string().min(1);

const CreateExerciseSchema = z.object({
  displayName: z.string().min(1).max(80).trim(),
  category: z.enum(['push', 'pull', 'legs', 'core', 'endurance']),
  defaultRestSeconds: z.number().int().nonnegative().max(3600).default(60),
});

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return base || 'exercise';
}

export async function createExerciseAction(input: {
  displayName: string;
  category: 'push' | 'pull' | 'legs' | 'core' | 'endurance';
  defaultRestSeconds?: number;
}): Promise<{ id: string; slug: string; displayName: string }> {
  const parsed = CreateExerciseSchema.parse(input);

  let slug = slugify(parsed.displayName);
  const [existing] = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(eq(exercises.slug, slug))
    .limit(1);
  if (existing) {
    // Collision — append a short base-36 timestamp suffix.
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  const id = crypto.randomUUID();
  await db.insert(exercises).values({
    id,
    slug,
    displayName: parsed.displayName,
    category: parsed.category,
    defaultRestSeconds: parsed.defaultRestSeconds ?? 60,
    isCompound: false,
  });

  // Invalidate the search route's data cache so the new exercise appears
  // in subsequent autocomplete results immediately.
  revalidatePath('/api/exercises/search');

  return { id, slug, displayName: parsed.displayName };
}

// Used by client components to validate before submission.
export async function exerciseSlugExistsAction(slug: string): Promise<boolean> {
  idSchema.parse(slug);
  const [row] = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(eq(exercises.slug, slug))
    .limit(1);
  return !!row;
}
