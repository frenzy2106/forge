import { parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

/**
 * Per PITFALLS Pitfall #9 — single-user single-tz app.
 * libSQL/SQLite has no native `timestamptz`; we store ISO-8601 UTC TEXT and
 * render in USER_TZ via these helpers. `sessions.local_date` is a denormalized
 * yyyy-MM-dd string in USER_TZ so "this week" / "today" queries are trivial.
 */
export const USER_TZ = 'Asia/Kolkata';

/** Returns ISO-8601 UTC string for the current moment.
 *  Use for sets.logged_at, sessions.started_at, etc. */
export function nowUtcIso(): string {
  return new Date().toISOString();
}

/** Converts a UTC ISO string into a yyyy-MM-dd local date in USER_TZ.
 *  Used for sessions.local_date denorm. */
export function localDateIso(utcIso: string): string {
  return formatInTimeZone(parseISO(utcIso), USER_TZ, 'yyyy-MM-dd');
}

/** Format a UTC ISO string for human display in USER_TZ. */
export function formatLocal(utcIso: string, fmt = 'yyyy-MM-dd HH:mm'): string {
  return formatInTimeZone(parseISO(utcIso), USER_TZ, fmt);
}
