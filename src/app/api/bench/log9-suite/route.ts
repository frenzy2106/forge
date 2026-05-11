// PHASE 1 BENCHMARK SUITE ENDPOINT — REMOVED by Plan 01-06 Task 3.
//
// Server-side runner for the LOG-09 friction-budget benchmark. Exists because
// the production deploy is behind Vercel deployment protection (SSO), so the
// laptop-side scripts/log-09-benchmark.ts cannot reach it from outside an
// authenticated browser session. This endpoint runs the same 25-set loop
// in-process on the Vercel function and returns the JSON report.
//
// Workflow:
//   1. Open this URL in your browser (authenticated to the Vercel project):
//        https://forge-...vercel.app/api/bench/log9-suite
//   2. Wait ~10-30 seconds for the benchmark to complete.
//   3. Browser renders a JSON document. Copy + paste it back to Claude.
//
// The HTTP-vs-DB split that the laptop-side script provides is collapsed here
// because both layers run in the same Vercel function process — the only
// meaningful measurement from inside the function is the DB-write latency
// (Vercel function -> Turso). The "Vercel cold start" and "Vercel function
// init" costs are real but they happen ONCE for this endpoint invocation;
// they don't repeat per set. So this measures the steady-state DB-write
// latency, which is the dominant per-set cost in the deployed environment.
//
// Schema-rich, deletes the bench session at the end so cleanup is automatic.
// THIS FILE IS DELETED at the end of Plan 01-06.

import { NextResponse } from 'next/server';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  sessions,
  sessionExercises,
  routines,
  routineExercises,
} from '@/db/schema';
import { insertSet } from '@/db/queries/sets';
import { nowUtcIso, localDateIso } from '@/lib/dates';

const SETS_PER_SESSION = 25;
const BENCH_NOTES_TAG = '[LOG-09-BENCH]';

// Force the route to run on Node (libsql client needs Node, not Edge).
export const runtime = 'nodejs';
// Never cache the bench result.
export const dynamic = 'force-dynamic';

type Sample = { ms: number; setIndex: number };

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.floor(sortedAsc.length * (p / 100)),
  );
  return sortedAsc[idx];
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

async function setupBenchSession(): Promise<{
  sessionId: string;
  sessionExerciseIds: string[];
}> {
  const [push] = await db
    .select()
    .from(routines)
    .where(eq(routines.slug, 'push'));
  if (!push) {
    throw new Error(
      'Push routine not seeded — run `pnpm seed` against the prod DB first.',
    );
  }

  const startedAt = nowUtcIso();
  const sessionId = crypto.randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(sessions).values({
      id: sessionId,
      routineId: push.id,
      startedAt,
      localDate: localDateIso(startedAt),
      notes: BENCH_NOTES_TAG,
    });
    const rxRows = await tx
      .select()
      .from(routineExercises)
      .where(eq(routineExercises.routineId, push.id))
      .orderBy(asc(routineExercises.position));
    if (rxRows.length === 0) {
      throw new Error(
        'Push routine has no exercises — run `pnpm seed` against the prod DB.',
      );
    }
    await tx.insert(sessionExercises).values(
      rxRows.map((re) => ({
        id: crypto.randomUUID(),
        sessionId,
        exerciseId: re.exerciseId,
        position: re.position,
      })),
    );
  });

  const seCreated = await db
    .select()
    .from(sessionExercises)
    .where(eq(sessionExercises.sessionId, sessionId))
    .orderBy(asc(sessionExercises.position));

  return {
    sessionId,
    sessionExerciseIds: seCreated.map((s) => s.id),
  };
}

async function logSetTimed(
  sessionExerciseId: string,
  position: number,
  weightKg: number,
  reps: number,
): Promise<number> {
  const start = performance.now();
  await insertSet({ sessionExerciseId, position, weightKg, reps });
  return performance.now() - start;
}

export async function GET() {
  const overallStart = performance.now();

  const { sessionId, sessionExerciseIds } = await setupBenchSession();

  // Single layer: in-function db.insert(...) latency. This isolates the
  // Vercel-function -> Turso write cost (the dominant per-set cost in
  // production once the function is warm).
  const dbSamples: Sample[] = [];
  for (let i = 0; i < SETS_PER_SESSION; i++) {
    const seId = sessionExerciseIds[i % sessionExerciseIds.length];
    const pos = Math.floor(i / sessionExerciseIds.length) + 1;
    const weightKg = 40 + (i % 5) * 2.5;
    const reps = 6 + (i % 4);
    const ms = await logSetTimed(seId, pos, weightKg, reps);
    dbSamples.push({ ms, setIndex: i });
  }

  // Steady-state: drop sample 0 (first insert in this function invocation
  // can carry connection-init cost).
  const dbSteadyMs = dbSamples
    .slice(1)
    .map((s) => s.ms)
    .sort((a, b) => a - b);
  const dbMean = mean(dbSteadyMs);
  const dbP50 = percentile(dbSteadyMs, 50);
  const dbP95 = percentile(dbSteadyMs, 95);
  const dbMax = dbSteadyMs.length === 0 ? 0 : dbSteadyMs[dbSteadyMs.length - 1];
  const dbCold = dbSamples[0].ms;

  // Pass criteria: same as the laptop-side script. Mean <= 5000ms, p95 <= 8000ms.
  // We're measuring the DB-write floor; the optimistic UI absorbs everything
  // above this for the user-perceived case. If even this floor exceeds the
  // budget, LOG-09 fails.
  const passMean = dbMean <= 5000;
  const passP95 = dbP95 <= 8000;
  const passed = passMean && passP95;

  // Cleanup: remove the bench session immediately. Cascades to its
  // session_exercises and sets via the schema's onDelete: 'cascade'. This
  // means the laptop-side cleanup script (`pnpm bench:cleanup`) becomes
  // optional / belt-and-suspenders for this endpoint.
  await db.delete(sessions).where(eq(sessions.id, sessionId));

  const totalElapsedMs = performance.now() - overallStart;

  return NextResponse.json({
    benchmarkRunAt: new Date().toISOString(),
    runner: 'server-side (Vercel function)',
    note:
      'Single-layer measurement: db.insert() latency from inside the Vercel ' +
      'function. The laptop-side scripts/log-09-benchmark.ts provides the ' +
      'two-layer (HTTP + DB) split when run against localhost; this endpoint ' +
      'exists because Vercel deployment protection blocks the laptop-side ' +
      'HTTP path against the deployed URL.',
    sessionId,
    samplesDb: dbSamples,
    summary: {
      dbCold,
      dbSteady: { mean: dbMean, p50: dbP50, p95: dbP95, max: dbMax },
      // Use dbSteady as the canonical per-set steady-state metric for LOG-09.
      // The laptop-side script's `httpSteady` field has the same shape; we
      // alias it here so any downstream consumer that reads `summary.httpSteady`
      // keeps working when reading either output format.
      httpSteady: { mean: dbMean, p50: dbP50, p95: dbP95, max: dbMax },
      vercelOverheadMs: 0, // not separable from inside the function
      totalElapsedMs,
      passed,
      passDetail: {
        meanLeq5000ms: passMean,
        p95Leq8000ms: passP95,
      },
    },
    cleanedUp: true,
  });
}
