CREATE TABLE "communities" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_by" text NOT NULL,
	"type" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_members" (
	"id" text PRIMARY KEY NOT NULL,
	"community_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"joined_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_by" text DEFAULT '' NOT NULL,
	"assigned_to" text,
	"shared_with" json,
	"title" text NOT NULL,
	"item_type" text NOT NULL,
	"recurrence_type" text,
	"custom_recurrence" text,
	"due_date" text,
	"time_frame" integer,
	"verify_required" boolean DEFAULT false,
	"why_it_matters" text,
	"created_at" text NOT NULL,
	"completed_at" text,
	"status" text DEFAULT 'open',
	"image_url" text,
	"ai_verification_result" text,
	"ai_feedback" text,
	"verified" boolean,
	"verified_by" text,
	"verified_by_user_id" text,
	"verified_at" text,
	"community_id" text
);
--> statement-breakpoint
CREATE TABLE "moods" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mood_emoji" text NOT NULL,
	"timestamp" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"life_stage" json,
	"values" json,
	"overall_goals" json,
	"ai_nudge_level" text DEFAULT 'light',
	"tone_preference" text DEFAULT 'friendly',
	"focus_window" text DEFAULT 'variable',
	"energy_curve" text,
	"work_context" text,
	"habit_style" text,
	"task_style" text,
	"wake_time" text,
	"sleep_time" text,
	"notification_opt_in" boolean DEFAULT true,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
