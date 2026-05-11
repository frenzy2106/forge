// PHASE 1 BENCHMARK ENDPOINT — REMOVED by Plan 01-06 Task 3.
//
// Wraps insertSet() identically to logSetAction (src/app/actions/sets.ts) so
// HTTP latency can be measured by scripts/log-09-benchmark.ts without
// reverse-engineering the Next.js Server Action wire protocol.
//
// THIS FILE IS DELETED at the end of Plan 01-06. It must NOT ship to the
// production app surface beyond this plan. Threat T-01-06-01: anyone with
// the URL can insert sets into any session_exercise UUID. Accepted risk for
// the brief benchmark window; verify deletion via curl returning 404.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { insertSet } from '@/db/queries/sets';

const idSchema = z.string().min(1);

const Schema = z.object({
  sessionExerciseId: idSchema,
  position: z.number().int().positive(),
  reps: z.number().int().nonnegative().optional(),
  weightKg: z.number().nonnegative().optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
  distanceMeters: z.number().nonnegative().optional(),
  parentSetId: idSchema.optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const set = await insertSet({
    ...parsed.data,
    isDropTier: !!parsed.data.parentSetId,
  });
  return NextResponse.json({ id: set.id });
}
