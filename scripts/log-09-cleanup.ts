#!/usr/bin/env node
// LOG-09 benchmark cleanup.
//
// Removes any sessions tagged with the [LOG-09-BENCH] notes prefix that the
// benchmark script (scripts/log-09-benchmark.ts) creates. Cascades to
// session_exercises and sets via the schema's onDelete: 'cascade' chain.
//
// Idempotent — safe to run before the benchmark too, just to clear any prior
// half-runs. Exit 0 always (no error if nothing to delete).
//
// Usage:
//   pnpm bench:cleanup

import { db } from '../src/db/client';
import { sessions } from '../src/db/schema';
import { like } from 'drizzle-orm';

async function main() {
  const result = await db
    .delete(sessions)
    .where(like(sessions.notes, '%[LOG-09-BENCH]%'));

  // libSQL's run-result shape varies; surface whatever rowsAffected we get.
  const rows =
    (result as unknown as { rowsAffected?: number }).rowsAffected ?? '?';
  console.log(
    `Deleted ${rows} bench session(s) tagged [LOG-09-BENCH] (cascades to session_exercises and sets).`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
