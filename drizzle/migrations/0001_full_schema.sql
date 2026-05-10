CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`display_name` text NOT NULL,
	`category` text NOT NULL,
	`primary_muscle` text,
	`is_compound` integer DEFAULT false NOT NULL,
	`default_unit` text DEFAULT 'kg' NOT NULL,
	`default_rest_seconds` integer DEFAULT 90 NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_slug_idx` ON `exercises` (`slug`);--> statement-breakpoint
CREATE TABLE `routines` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `routines_slug_idx` ON `routines` (`slug`);--> statement-breakpoint
CREATE TABLE `routine_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`routine_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`target_sets` integer,
	`target_reps_low` integer,
	`target_reps_high` integer,
	`target_weight_kg` real,
	`target_duration_seconds` integer,
	`target_distance_meters` real,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `routine_exercises_routine_pos_idx` ON `routine_exercises` (`routine_id`,`position`);--> statement-breakpoint
-- ──────────────────────────────────────────────────────────────────────────
-- sessions: rebuild via the SQLite "new table + copy + drop + rename" dance.
--
-- Plan 01-01 created `sessions` without routine_id / intent / is_deleted /
-- updated_at and without an FK back to routines. SQLite ALTER TABLE cannot
-- ADD a column with an FK that has ON DELETE SET NULL (it can only attach
-- the bare REFERENCES clause), so we must recreate the table to express the
-- full FK semantics the schema declares.
--
-- The single smoke-test row from 01-01 is intentionally preserved for
-- continuity with the carry-forward note in 01-01-SUMMARY.md.
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE `__new_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`routine_id` text,
	`started_at` text NOT NULL,
	`ended_at` text,
	`local_date` text NOT NULL,
	`intent` text DEFAULT 'normal' NOT NULL,
	`notes` text,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_sessions` (`id`, `routine_id`, `started_at`, `ended_at`, `local_date`, `intent`, `notes`, `is_deleted`, `created_at`, `updated_at`)
SELECT `id`, NULL, `started_at`, `ended_at`, `local_date`, 'normal', `notes`, 0, `created_at`, `created_at`
FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
CREATE INDEX `sessions_routine_date_idx` ON `sessions` (`routine_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `sessions_local_date_idx` ON `sessions` (`local_date`);--> statement-breakpoint
CREATE TABLE `session_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `session_exercises_session_pos_idx` ON `session_exercises` (`session_id`,`position`);--> statement-breakpoint
CREATE TABLE `sets` (
	`id` text PRIMARY KEY NOT NULL,
	`session_exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`reps` integer,
	`weight_kg` real,
	`duration_seconds` integer,
	`distance_meters` real,
	`is_drop_tier` integer DEFAULT false NOT NULL,
	`parent_set_id` text,
	`is_warmup` integer DEFAULT false NOT NULL,
	`rpe` real,
	`logged_at` text NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`session_exercise_id`) REFERENCES `session_exercises`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_set_id`) REFERENCES `sets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `sets_session_exercise_idx` ON `sets` (`session_exercise_id`,`position`);--> statement-breakpoint
CREATE INDEX `sets_parent_set_idx` ON `sets` (`parent_set_id`);
