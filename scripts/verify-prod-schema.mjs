// Walks the prod libSQL DB and prints the table list + a few key column
// signatures so we can confirm the 0001_full_schema migration landed.
//
// Usage: pnpm node --env-file=.env.local scripts/verify-prod-schema.mjs
//   (or: pnpm tsx scripts/verify-prod-schema.mjs after dotenv is auto-loaded)

import 'dotenv/config';
import { createClient } from '@libsql/client';

if (!process.env.TURSO_DATABASE_URL) {
  console.error('TURSO_DATABASE_URL is not set. Load .env.local first.');
  process.exit(1);
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const tablesRes = await client.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
);
console.log('Tables:');
for (const row of tablesRes.rows) {
  console.log('  ' + row.name);
}

console.log('\nPRAGMA foreign_keys:');
const fkRes = await client.execute('PRAGMA foreign_keys');
console.log('  ' + JSON.stringify(fkRes.rows[0]));

console.log('\nsets columns:');
const setsCols = await client.execute("PRAGMA table_info('sets')");
for (const row of setsCols.rows) {
  console.log(`  ${row.name} (${row.type})${row.notnull ? ' NOT NULL' : ''}${row.dflt_value !== null ? ' DEFAULT ' + row.dflt_value : ''}`);
}

console.log('\nsets foreign keys:');
const setsFk = await client.execute("PRAGMA foreign_key_list('sets')");
for (const row of setsFk.rows) {
  console.log(`  ${row.from} -> ${row.table}.${row.to} on_delete=${row.on_delete}`);
}

console.log('\nsessions columns:');
const sessCols = await client.execute("PRAGMA table_info('sessions')");
for (const row of sessCols.rows) {
  console.log(`  ${row.name} (${row.type})${row.notnull ? ' NOT NULL' : ''}${row.dflt_value !== null ? ' DEFAULT ' + row.dflt_value : ''}`);
}

console.log('\nsessions foreign keys:');
const sessFk = await client.execute("PRAGMA foreign_key_list('sessions')");
for (const row of sessFk.rows) {
  console.log(`  ${row.from} -> ${row.table}.${row.to} on_delete=${row.on_delete}`);
}

console.log('\nsessions row counts (carry-forward smoke-test row from 01-01):');
const sessCount = await client.execute('SELECT COUNT(*) as c FROM sessions');
console.log('  ' + JSON.stringify(sessCount.rows[0]));

await client.close();
