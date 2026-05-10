import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

/**
 * Drizzle singleton wired to Turso libSQL.
 *
 * - Production: TURSO_DATABASE_URL=libsql://...turso.io  + TURSO_AUTH_TOKEN=...
 * - Local file DB: TURSO_DATABASE_URL=file:./local.db    + (no auth token)
 *
 * Server-only file. Never import from a Client Component — this file pulls in
 * the libSQL driver and your auth token must not appear in the client bundle.
 */
if (!process.env.TURSO_DATABASE_URL) {
  throw new Error(
    'TURSO_DATABASE_URL is not set. Copy .env.local.example to .env.local and fill in your Turso credentials.',
  );
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
