// Verify prod has the expected seeded shape (28 exercises, 4 routines,
// 28 routine_exercises, target weights for known exercises).
//
//   node --env-file=.env.local scripts/verify-prod-seed.mjs

import { createClient } from '@libsql/client';

if (!process.env.TURSO_DATABASE_URL) {
  console.error('TURSO_DATABASE_URL is not set. Load .env.local first.');
  process.exit(1);
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const ex = await client.execute('SELECT COUNT(*) as c FROM exercises');
const r = await client.execute('SELECT slug, name FROM routines ORDER BY position');
const re = await client.execute('SELECT COUNT(*) as c FROM routine_exercises');

console.log('Exercises:        ', ex.rows[0].c);
console.log('Routines:         ', r.rows.map((row) => `${row.slug}=${row.name}`).join(', '));
console.log('Routine exercises:', re.rows[0].c);

console.log('\nMax-lift baselines on Push routine:');
const pushTargets = await client.execute(`
  SELECT e.display_name, re.target_weight_kg
  FROM routine_exercises re
  JOIN routines r ON r.id = re.routine_id
  JOIN exercises e ON e.id = re.exercise_id
  WHERE r.slug = 'push'
  ORDER BY re.position
`);
for (const row of pushTargets.rows) {
  console.log(`  ${row.display_name}: ${row.target_weight_kg ?? '—'} kg`);
}

console.log('\nSaturday Endurance station durations:');
const satTargets = await client.execute(`
  SELECT e.display_name, re.target_duration_seconds, re.target_distance_meters
  FROM routine_exercises re
  JOIN routines r ON r.id = re.routine_id
  JOIN exercises e ON e.id = re.exercise_id
  WHERE r.slug = 'saturday-endurance'
  ORDER BY re.position
`);
for (const row of satTargets.rows) {
  console.log(
    `  ${row.display_name}: ${row.target_duration_seconds ?? '—'} s` +
    (row.target_distance_meters ? `, ${row.target_distance_meters} m` : ''),
  );
}

await client.close();
