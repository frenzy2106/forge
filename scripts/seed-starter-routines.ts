// scripts/seed-starter-routines.ts
//
// Idempotent starter-routines seeder.
//
//   pnpm seed
//   # or directly:
//   pnpm tsx scripts/seed-starter-routines.ts
//
// Reads STARTER_EXERCISES + STARTER_ROUTINES from src/db/seed/starter-routines.ts
// (sourced from the user's Workout-Plan.md) and upserts on natural keys:
//   - exercises.slug
//   - routines.slug
//   - routine_exercises uniqueness composite: (routine_id, exercise_id, position)
//
// Re-running produces zero new rows: every upsert is a "skip if present" check.
// Reports inserted/skipped counts so you can confirm at a glance.
//
// Targets whichever DB the .env.local TURSO_DATABASE_URL points to. Loaded
// via Node's --env-file flag (configured in package.json's `seed` script);
// Next.js auto-loads .env.local for the dev/prod runtime, but tsx scripts
// do not. Keeping the env load OUT of the import graph means downstream
// `db` imports observe a fully-populated process.env regardless of ESM
// hoisting order.

import { eq, and } from 'drizzle-orm';
import { db } from '../src/db/client';
import { exercises, routines, routineExercises } from '../src/db/schema';
import { STARTER_EXERCISES, STARTER_ROUTINES } from '../src/db/seed/starter-routines';

async function seedExercises(): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;
  for (const ex of STARTER_EXERCISES) {
    const existing = await db.select().from(exercises).where(eq(exercises.slug, ex.slug));
    if (existing.length === 0) {
      await db.insert(exercises).values(ex);
      inserted++;
    } else {
      skipped++;
    }
  }
  return { inserted, skipped };
}

async function seedRoutines(): Promise<{
  routinesInserted: number;
  routinesSkipped: number;
  reInserted: number;
  reSkipped: number;
}> {
  let routinesInserted = 0;
  let routinesSkipped = 0;
  let reInserted = 0;
  let reSkipped = 0;

  for (const r of STARTER_ROUTINES) {
    let routineId: string;
    const existing = await db.select().from(routines).where(eq(routines.slug, r.routine.slug));
    if (existing.length === 0) {
      const [created] = await db.insert(routines).values(r.routine).returning();
      routineId = created.id;
      routinesInserted++;
    } else {
      routineId = existing[0].id;
      routinesSkipped++;
    }

    for (const re of r.exercises) {
      // Resolve exercise_id from the slug.
      const [exRow] = await db
        .select()
        .from(exercises)
        .where(eq(exercises.slug, re.exerciseSlug));
      if (!exRow) {
        console.warn(
          `  ⚠ Skipping routine_exercise: exercise slug '${re.exerciseSlug}' not found in catalog.`,
        );
        continue;
      }
      // Idempotency key: (routine_id, exercise_id, position) — matches how the
      // seed file declares the exercise's slot in the routine. Re-runs find
      // the existing row and skip.
      const existingRe = await db
        .select()
        .from(routineExercises)
        .where(
          and(
            eq(routineExercises.routineId, routineId),
            eq(routineExercises.exerciseId, exRow.id),
            eq(routineExercises.position, re.position),
          ),
        );
      if (existingRe.length === 0) {
        // Strip the slug-only field; everything else is a real column.
        const { exerciseSlug: _slug, ...rest } = re;
        void _slug;
        await db.insert(routineExercises).values({
          ...rest,
          routineId,
          exerciseId: exRow.id,
        });
        reInserted++;
      } else {
        reSkipped++;
      }
    }
  }

  return { routinesInserted, routinesSkipped, reInserted, reSkipped };
}

async function main(): Promise<void> {
  const target = process.env.TURSO_DATABASE_URL ?? '<unset>';
  console.log(`Seeding starter routines into: ${target}`);
  const exResult = await seedExercises();
  console.log(
    `  Exercises:         ${exResult.inserted} inserted, ${exResult.skipped} skipped (already present)`,
  );
  const rResult = await seedRoutines();
  console.log(
    `  Routines:          ${rResult.routinesInserted} inserted, ${rResult.routinesSkipped} skipped`,
  );
  console.log(
    `  Routine-exercises: ${rResult.reInserted} inserted, ${rResult.reSkipped} skipped`,
  );
  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
