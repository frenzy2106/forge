import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
  foreignKey,
} from 'drizzle-orm/sqlite-core';
import { sql, relations } from 'drizzle-orm';

/**
 * Forge — full v1 schema (Plan 01-02).
 *
 * Replaces the Plan 01-01 walking-skeleton `sessions` placeholder with the
 * shape Plans 01-03 / 01-04 / 01-05 / 01-06 will consume:
 *
 *   exercises (catalog)              — WORK-04: immutable IDs, editable display_name
 *   routines (templates)              — WORK-01: ordered exercise lists
 *     ↳ routine_exercises             — junction with target prescription
 *   sessions (instances)              — WORK-03: routine_id NULLABLE for ad-hoc
 *     ↳ session_exercises             — WORK-02: COPIED at create-time, not joined
 *       ↳ sets                        — WORK-05: one row per performed set,
 *                                         parent_set_id self-FK for drop tiers
 *                                         (PITFALLS #2 — hardest-to-undo decision)
 *
 * D-03d (Saturday endurance) is modelled by reusing the same `sets` table with
 * `duration_seconds` + `distance_meters` columns left null for strength sets.
 *
 * `local_date` denormalises yyyy-MM-dd in Asia/Kolkata so "today" / "this week"
 * queries are trivial (PITFALLS #9). All timestamp columns are ISO-8601 UTC TEXT.
 */

// ─── EXERCISES (catalog) ───────────────────────────────────────────────────
// WORK-04: id is immutable; display_name is the only renameable field. The
// "renamed exercise" badge in HIST-03 / D-02e is computed by joining via id
// while showing the latest display_name.
export const exercises = sqliteTable(
  'exercises',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    slug: text('slug').notNull(), // stable URL-safe matcher (e.g. 'incline-smith-press')
    displayName: text('display_name').notNull(),
    category: text('category', {
      enum: ['push', 'pull', 'legs', 'core', 'endurance'],
    }).notNull(),
    primaryMuscle: text('primary_muscle'),
    isCompound: integer('is_compound', { mode: 'boolean' }).notNull().default(false),
    defaultUnit: text('default_unit', { enum: ['kg', 'lb'] }).notNull().default('kg'),
    // CONTEXT D-01g: rest timer auto-starts at this default after a set is logged.
    defaultRestSeconds: integer('default_rest_seconds').notNull().default(90),
    notes: text('notes'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => ({
    slugIdx: uniqueIndex('exercises_slug_idx').on(t.slug),
  }),
);

// ─── ROUTINES (templates) ──────────────────────────────────────────────────
// CONTEXT D-03a: flat ordered lists; no Push A / Push B distinction in v1.
// CONTEXT D-03c: routine editing is via the seed JSON + script in v1.
export const routines = sqliteTable(
  'routines',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(), // 'Push' | 'Pull' | 'Legs' | 'Saturday Endurance'
    slug: text('slug').notNull(),
    position: integer('position').notNull().default(0), // home-page display order
    notes: text('notes'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => ({
    slugIdx: uniqueIndex('routines_slug_idx').on(t.slug),
  }),
);

// ─── ROUTINE_EXERCISES (junction with optional target prescription) ────────
// Cascade on routine delete (templates own their exercise list). RESTRICT on
// exercise delete — you can't delete a catalog exercise still referenced by a
// routine; soft-delete the exercise instead in a future plan.
export const routineExercises = sqliteTable(
  'routine_exercises',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    routineId: text('routine_id')
      .notNull()
      .references(() => routines.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
    targetSets: integer('target_sets'),
    targetRepsLow: integer('target_reps_low'),
    targetRepsHigh: integer('target_reps_high'),
    targetWeightKg: real('target_weight_kg'), // baseline (max-lift seed)
    targetDurationSeconds: integer('target_duration_seconds'), // CONTEXT D-03d
    targetDistanceMeters: real('target_distance_meters'),
    notes: text('notes'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => ({
    routinePosIdx: index('routine_exercises_routine_pos_idx').on(t.routineId, t.position),
  }),
);

// ─── SESSIONS (instances) — REPLACES the Plan 01-01 minimal sessions table ─
// routine_id is nullable (WORK-03 ad-hoc blank sessions) and ON DELETE SET NULL
// because we never want a session deleted just because its routine template was.
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    routineId: text('routine_id').references(() => routines.id, { onDelete: 'set null' }),
    startedAt: text('started_at').notNull(), // ISO-8601 UTC
    endedAt: text('ended_at'), // null while session is in progress
    localDate: text('local_date').notNull(), // yyyy-MM-dd in Asia/Kolkata; PITFALLS #9
    intent: text('intent', {
      enum: ['normal', 'deload', 'test', 'technique', 'ad_hoc'],
    })
      .notNull()
      .default('normal'),
    notes: text('notes'),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false), // HIST-05 soft delete
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => ({
    routineDateIdx: index('sessions_routine_date_idx').on(t.routineId, t.startedAt),
    localDateIdx: index('sessions_local_date_idx').on(t.localDate),
  }),
);

// ─── SESSION_EXERCISES (which exercises happened in this session, in order) ─
// WORK-02: COPIED from routine_exercises at session-create time. NOT a live
// join — editing a routine doesn't rewrite history. Done in a transaction
// inside src/db/queries/sessions.ts::createSessionFromRoutine().
export const sessionExercises = sqliteTable(
  'session_exercises',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
    notes: text('notes'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => ({
    sessionPosIdx: index('session_exercises_session_pos_idx').on(t.sessionId, t.position),
  }),
);

// ─── SETS (the atom of logging) ────────────────────────────────────────────
// PITFALLS Pitfall #2 + WORK-05: ONE ROW PER PERFORMED SET. parent_set_id
// makes drop-tier sets first-class without a parallel data shape, and
// duration_seconds + distance_meters cover D-03d Saturday endurance without
// a parallel cardio table. RPE column is reserved for v2 UI (LOG-V2-02);
// adding it now is free, retrofitting later is a migration.
export const sets = sqliteTable(
  'sets',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionExerciseId: text('session_exercise_id')
      .notNull()
      .references(() => sessionExercises.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(), // set number within the exercise (1..N)
    reps: integer('reps'), // null for endurance-only sets
    weightKg: real('weight_kg'), // null for endurance-only sets
    durationSeconds: integer('duration_seconds'), // null for strength sets
    distanceMeters: real('distance_meters'), // null when not measured
    isDropTier: integer('is_drop_tier', { mode: 'boolean' }).notNull().default(false),
    parentSetId: text('parent_set_id'), // self-FK declared below to avoid forward-ref
    isWarmup: integer('is_warmup', { mode: 'boolean' }).notNull().default(false),
    rpe: real('rpe'), // LOG-V2-02 — schema in v1, UI in v2
    loggedAt: text('logged_at').notNull(), // moment user tapped done; ISO-8601 UTC
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false), // HIST-05
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => ({
    sessionExerciseIdx: index('sets_session_exercise_idx').on(
      t.sessionExerciseId,
      t.position,
    ),
    parentSetIdx: index('sets_parent_set_idx').on(t.parentSetId),
    // Self-FK for the drop-tier chain. SET NULL on parent delete so a child
    // tier becomes a standalone set rather than disappearing silently.
    parentSetFk: foreignKey({
      columns: [t.parentSetId],
      foreignColumns: [t.id],
      name: 'sets_parent_set_id_fk',
    }).onDelete('set null'),
  }),
);

// ─── Drizzle relations (for queries/sessions.ts aggregate loads) ───────────
export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  routine: one(routines, { fields: [sessions.routineId], references: [routines.id] }),
  exercises: many(sessionExercises),
}));

export const sessionExercisesRelations = relations(sessionExercises, ({ one, many }) => ({
  session: one(sessions, { fields: [sessionExercises.sessionId], references: [sessions.id] }),
  exercise: one(exercises, {
    fields: [sessionExercises.exerciseId],
    references: [exercises.id],
  }),
  sets: many(sets),
}));

export const setsRelations = relations(sets, ({ one }) => ({
  sessionExercise: one(sessionExercises, {
    fields: [sets.sessionExerciseId],
    references: [sessionExercises.id],
  }),
}));

export const routinesRelations = relations(routines, ({ many }) => ({
  exercises: many(routineExercises),
}));

export const routineExercisesRelations = relations(routineExercises, ({ one }) => ({
  routine: one(routines, {
    fields: [routineExercises.routineId],
    references: [routines.id],
  }),
  exercise: one(exercises, {
    fields: [routineExercises.exerciseId],
    references: [exercises.id],
  }),
}));

// ─── Inferred types — exported for queries/* and Server Actions ────────────
export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;
export type Routine = typeof routines.$inferSelect;
export type NewRoutine = typeof routines.$inferInsert;
export type RoutineExercise = typeof routineExercises.$inferSelect;
export type NewRoutineExercise = typeof routineExercises.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type SessionExercise = typeof sessionExercises.$inferSelect;
export type NewSessionExercise = typeof sessionExercises.$inferInsert;
export type Set = typeof sets.$inferSelect;
export type NewSet = typeof sets.$inferInsert;
