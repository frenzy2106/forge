// Walking-skeleton smoke test (Plan 01-01).
// Confirms: schema applied → INSERT round-trips → SELECT returns the row.
// Run with: TURSO_DATABASE_URL="file:./local.db" node scripts/smoke-test.mjs

import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error('TURSO_DATABASE_URL is not set.');
  process.exit(1);
}

const client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const startedAt = new Date().toISOString();
const id = crypto.randomUUID();
// Compute local_date in Asia/Kolkata via Intl.
const localDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date(startedAt));

await client.execute({
  sql: 'INSERT INTO sessions (id, started_at, local_date) VALUES (?, ?, ?)',
  args: [id, startedAt, localDate],
});

const result = await client.execute(
  'SELECT id, started_at, local_date FROM sessions ORDER BY started_at DESC LIMIT 5',
);
console.log(`Rows: ${result.rows.length}`);
for (const row of result.rows) {
  console.log(`  ${row.id} | ${row.started_at} | ${row.local_date}`);
}

if (!result.rows.find((r) => r.id === id)) {
  console.error('FAIL: inserted row not found.');
  process.exit(2);
}
console.log('OK: smoke test passed.');
