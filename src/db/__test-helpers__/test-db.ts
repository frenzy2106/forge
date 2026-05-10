// src/db/__test-helpers__/test-db.ts
//
// Spawn a fresh test DB backed by a temp file.
//
// We DO NOT use libSQL `:memory:` for tests because the libSQL JS client
// drops its connection (and therefore the in-memory DB) the first time
// `db.transaction()` is called — see Sqlite3Client.transaction() at
// node_modules/.../@libsql/client/lib-esm/sqlite3.js:158, which sets
// `this.#db = null` and lazily opens a brand-new in-memory DB on the next
// query. That makes any test that exercises a transaction (createSessionFromRoutine,
// any future loadSessionView write path) silently lose its schema.
//
// The supported workaround on Windows + libSQL's local sqlite3 driver is a
// per-test temp file. We migrate the schema once, hand the drizzle client to
// the test, and clean the file up afterwards in `afterEach`.

import { drizzle } from 'drizzle-orm/libsql';
import { createClient, type Client } from '@libsql/client';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync, existsSync } from 'node:fs';
import * as schema from '../schema';

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

export async function makeTestDb(): Promise<{
  db: TestDb;
  client: Client;
  cleanup: () => void;
}> {
  const path = join(tmpdir(), `forge-test-${randomUUID()}.db`);
  const client = createClient({ url: `file:${path}` });
  const db = drizzle(client, { schema });

  // FK enforcement on. (Hosted Turso defaults this to ON; the local sqlite3
  // driver does not, and our cascade/restrict tests would silently no-op
  // without it.)
  await db.run(sql`PRAGMA foreign_keys = ON`);
  await migrate(db, { migrationsFolder: './drizzle/migrations' });

  return {
    db,
    client,
    cleanup: () => {
      try {
        client.close();
      } catch {
        /* noop */
      }
      // Windows: the file may still be EBUSY for a moment after close().
      // Best-effort delete; OS reaps it on next reboot if it lingers.
      try {
        if (existsSync(path)) unlinkSync(path);
      } catch {
        /* noop */
      }
    },
  };
}
