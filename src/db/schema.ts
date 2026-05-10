import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Walking-skeleton schema (Plan 01-01).
 *
 * Plan 01-02 EXPANDS this with exercises, routines, routine_exercises,
 * session_exercises, sets (with parent_set_id, is_drop_tier, duration_seconds,
 * distance_meters). Do NOT add other tables here in this plan — schema
 * surface is intentionally minimal so the deployed page round-trips.
 */
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  startedAt: text('started_at').notNull(),    // ISO-8601 UTC; src/lib/dates.ts nowUtcIso()
  endedAt: text('ended_at'),                   // null while in progress
  localDate: text('local_date').notNull(),     // yyyy-mm-dd in Asia/Kolkata; PITFALLS #9
  notes: text('notes'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
