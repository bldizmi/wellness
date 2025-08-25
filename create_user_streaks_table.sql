CREATE TABLE IF NOT EXISTS "dev_user_streaks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_completion_date" text,
	"streak_start_date" text,
	"total_completion_days" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "dev_user_streaks_user_id_unique" UNIQUE("user_id")
);