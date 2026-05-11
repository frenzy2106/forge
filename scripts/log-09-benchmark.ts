#!/usr/bin/env node
// LOG-09 friction-budget benchmark.
//
// Measures end-to-end logSet latency against the deployed Vercel + Turso
// path. Two layers of measurement, run back-to-back inside one bench session:
//
//   1. HTTP layer (real upper bound for the network path):
//      POST /api/bench/log-set on the deployed URL. This is the same DB write
//      as logSetAction, just wrapped in a Route Handler instead of a Server
//      Action so we don't have to reverse-engineer the Next.js Server Action
//      wire protocol. The bench endpoint is added in this same plan and
//      removed in Task 3.
//
//   2. Direct DB layer (lower bound for the data path):
//      Direct insertSet() from this Node process to prod Turso. Skips the
//      Vercel function hop entirely.
//
// Subtraction (HTTP - DB) attributes the cost: if HTTP >> DB, Vercel cold
// start / function init / network are the bottleneck; if both are slow,
// Turso latency is.
//
// Usage:
//   pnpm bench
//      → http://localhost:3000 (default; requires `pnpm dev` running)
//   FORGE_BENCH_URL=https://forge-...vercel.app pnpm bench
//      → deployed URL (Phase 1 acceptance run)
//
// Note: env loading is via tsx --env-file=.env.local in the package.json
// script, mirroring `pnpm seed`. TURSO_DATABASE_URL and TURSO_AUTH_TOKEN
// must be set so the direct-DB layer can write to prod Turso.

import { db } from '../src/db/client';
import {
  sessions,
  sessionExercises,
  routines,
  routineExercises,
} from '../src/db/schema';
import { eq, asc } from 'drizzle-orm';
import { nowUtcIso, localDateIso } from '../src/lib/dates';
import { insertSet } from '../src/db/queries/sets';

const BASE_URL = (process.env.FORGE_BENCH_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);
const SETS_PER_SESSION = 25;
const BENCH_NOTES_TAG = '[LOG-09-BENCH]'; // cleanup script greps this

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
      "Push routine not seeded — run `pnpm seed` first (or check TURSO_DATABASE_URL points at the right DB).",
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
        'Push routine has no exercises — run `pnpm seed` to populate routine_exercises.',
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

async function logSetViaHttp(
  sessionExerciseId: string,
  position: number,
  weightKg: number,
  reps: number,
): Promise<number> {
  const start = performance.now();
  const resp = await fetch(`${BASE_URL}/api/bench/log-set`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionExerciseId, position, weightKg, reps }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(
      `logSet HTTP ${resp.status} ${resp.statusText}: ${text.slice(0, 500)}`,
    );
  }
  await resp.json();
  return performance.now() - start;
}

async function logSetViaDb(
  sessionExerciseId: string,
  position: number,
  weightKg: number,
  reps: number,
): Promise<number> {
  const start = performance.now();
  await insertSet({ sessionExerciseId, position, weightKg, reps });
  return performance.now() - start;
}

async function main() {
  console.log(`LOG-09 benchmark against ${BASE_URL}`);
  console.log(`Target: mean <= 5000ms/set, p95 <= 8000ms/set\n`);

  const { sessionId, sessionExerciseIds } = await setupBenchSession();
  console.log(
    `Created bench session ${sessionId} with ${sessionExerciseIds.length} session_exercises.\n`,
  );

  const httpSamples: Sample[] = [];
  const dbSamples: Sample[] = [];

  console.log('=== HTTP latency (Vercel function -> Turso) ===');
  for (let i = 0; i < SETS_PER_SESSION; i++) {
    const seId = sessionExerciseIds[i % sessionExerciseIds.length];
    const pos = Math.floor(i / sessionExerciseIds.length) + 1;
    // Vary the values just enough to be realistic; not load-testing the DB.
    const weightKg = 40 + (i % 5) * 2.5;
    const reps = 6 + (i % 4);
    const ms = await logSetViaHttp(seId, pos, weightKg, reps);
    httpSamples.push({ ms, setIndex: i });
    process.stdout.write(
      `  set ${String(i + 1).padStart(2, ' ')}: ${ms.toFixed(0).padStart(5, ' ')}ms${
        i === 0 ? '  (cold start)' : ''
      }\n`,
    );
  }

  console.log('\n=== Direct DB latency (process -> Turso, no Vercel hop) ===');
  for (let i = 0; i < SETS_PER_SESSION; i++) {
    const seId = sessionExerciseIds[i % sessionExerciseIds.length];
    // +100 offset so positions don't collide with HTTP-layer rows on the same
    // session_exercise (no unique constraint, but keeps the bench data tidy).
    const pos = Math.floor(i / sessionExerciseIds.length) + 1 + 100;
    const weightKg = 40 + (i % 5) * 2.5;
    const reps = 6 + (i % 4);
    const ms = await logSetViaDb(seId, pos, weightKg, reps);
    dbSamples.push({ ms, setIndex: i });
    process.stdout.write(
      `  set ${String(i + 1).padStart(2, ' ')}: ${ms.toFixed(0).padStart(5, ' ')}ms\n`,
    );
  }

  // Steady-state stats exclude sample 0 (cold start dominates that one).
  const httpSteadyMs = httpSamples
    .slice(1)
    .map((s) => s.ms)
    .sort((a, b) => a - b);
  const dbSteadyMs = dbSamples
    .slice(1)
    .map((s) => s.ms)
    .sort((a, b) => a - b);

  const httpMean = mean(httpSteadyMs);
  const httpP50 = percentile(httpSteadyMs, 50);
  const httpP95 = percentile(httpSteadyMs, 95);
  const httpMax = httpSteadyMs.length === 0 ? 0 : httpSteadyMs[httpSteadyMs.length - 1];
  const dbMean = mean(dbSteadyMs);
  const dbP50 = percentile(dbSteadyMs, 50);
  const dbP95 = percentile(dbSteadyMs, 95);
  const dbMax = dbSteadyMs.length === 0 ? 0 : dbSteadyMs[dbSteadyMs.length - 1];

  const passMean = httpMean <= 5000;
  const passP95 = httpP95 <= 8000;
  const passed = passMean && passP95;

  console.log('\n=== Results ===');
  console.log(`HTTP cold (1st sample): ${httpSamples[0].ms.toFixed(0)}ms`);
  console.log(
    `HTTP steady (n=${httpSteadyMs.length}): mean ${httpMean.toFixed(0)}ms | p50 ${httpP50.toFixed(0)}ms | p95 ${httpP95.toFixed(0)}ms | max ${httpMax.toFixed(0)}ms`,
  );
  console.log(
    `DB direct  (n=${dbSteadyMs.length}): mean ${dbMean.toFixed(0)}ms | p50 ${dbP50.toFixed(0)}ms | p95 ${dbP95.toFixed(0)}ms | max ${dbMax.toFixed(0)}ms`,
  );
  console.log(
    `Vercel overhead (HTTP-DB mean): ~${(httpMean - dbMean).toFixed(0)}ms per set`,
  );

  console.log(`\n${passed ? 'PASS' : 'FAIL'} — LOG-09 friction budget`);
  console.log(
    `  Mean <= 5000ms: ${passMean ? 'PASS' : 'FAIL'} (${httpMean.toFixed(0)}ms)`,
  );
  console.log(
    `  P95  <= 8000ms: ${passP95 ? 'PASS' : 'FAIL'} (${httpP95.toFixed(0)}ms)`,
  );
  console.log(
    '\nNote: with optimistic UI (Plan 01-03), perceived latency on the user\'s phone is near-zero —',
  );
  console.log(
    'the UI updates synchronously and these network latencies only affect the rare case of tapping',
  );
  console.log(
    'done faster than the network can confirm. Phase 4 re-verifies live in a real gym session per',
  );
  console.log('CONTEXT.md / PITFALLS Pitfall #4.');

  const out = {
    benchmarkRunAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    sessionId,
    samplesHttp: httpSamples,
    samplesDb: dbSamples,
    summary: {
      httpCold: httpSamples[0].ms,
      httpSteady: { mean: httpMean, p50: httpP50, p95: httpP95, max: httpMax },
      dbSteady: { mean: dbMean, p50: dbP50, p95: dbP95, max: dbMax },
      vercelOverheadMs: httpMean - dbMean,
      passed,
    },
  };
  console.log('\n=== JSON ===');
  console.log(JSON.stringify(out, null, 2));

  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error('Benchmark crashed:', err);
  process.exit(2);
});
