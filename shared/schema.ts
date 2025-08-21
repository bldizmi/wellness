import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Dynamic table naming based on environment
const TABLE_PREFIX = process.env.NODE_ENV === "development" ? "dev_" : "";
console.log("Table___________prefix:");
console.log(TABLE_PREFIX);

// Users table (enhanced for admin dashboard)
export const users = pgTable(`${TABLE_PREFIX}users`, {
  id: serial("id").primaryKey(),
  firebase_uid: text("firebase_uid").unique().notNull(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(), // Required for database compatibility
  display_name: text("display_name"),
  email: text("email").unique(),
  role: text("role").notNull().default("member"), // admin, member, pilot
  status: text("status").notNull().default("active"), // active, terminated, invited
  verified: boolean("verified").default(false),
  created_at: timestamp("created_at").defaultNow(),
  last_login: timestamp("last_login"),
  terminated_at: timestamp("terminated_at"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  display_name: true,
  email: true,
  role: true,
  status: true,
  verified: true,
});

// Admin-specific schemas
export const updateUserSchema = createInsertSchema(users)
  .pick({
    display_name: true,
    email: true,
    role: true,
    status: true,
    verified: true,
    terminated_at: true,
  })
  .extend({
    terminated_at: z.union([z.date(), z.string().datetime()]).optional(),
  })
  .partial();

export const createUserAdminSchema = createInsertSchema(users)
  .pick({
    username: true,
    display_name: true,
    email: true,
    role: true,
    status: true,
  })
  .extend({
    password: z.string().min(6, "Password must be at least 6 characters"),
  });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type CreateUserAdmin = z.infer<typeof createUserAdminSchema>;
export type User = typeof users.$inferSelect;

// Moods table
export const moods = pgTable(`${TABLE_PREFIX}moods`, {
  id: text("id").primaryKey(),
  user_id: text("user_id").notNull(),
  mood_emoji: text("mood_emoji").notNull(),
  timestamp: text("timestamp").notNull(),
  created_at: text("created_at").notNull(),
});

// Communities table
export const communities = pgTable(`${TABLE_PREFIX}communities`, {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  created_by: text("created_by").notNull(),
  type: text("type").notNull(), // family, roommates, team, custom
  created_at: text("created_at").notNull(),
  deleted_at: text("deleted_at"), // nullable timestamp for soft deletion
});

// Community members table
export const community_members = pgTable(`${TABLE_PREFIX}community_members`, {
  id: text("id").primaryKey(),
  community_id: text("community_id").notNull(),
  user_id: text("user_id").notNull(),
  role: text("role").notNull(), // owner, admin, member
  joined_at: text("joined_at").notNull(),
  removed_at: text("removed_at"), // nullable timestamp for soft deletion
});

// Community invitations table
export const community_invitations = pgTable(
  `${TABLE_PREFIX}community_invitations`,
  {
    id: text("id").primaryKey(),
    community_id: text("community_id").notNull(),
    inviter_id: text("inviter_id").notNull(), // Firebase UID of who sent the invite
    invitee_email: text("invitee_email").notNull(),
    status: text("status").notNull().default("pending"), // pending, accepted, declined
    created_at: timestamp("created_at").defaultNow(),
    expires_at: timestamp("expires_at").notNull(),
    responded_at: timestamp("responded_at"),
  },
);

// Community role changes audit table
export const community_role_changes = pgTable(
  `${TABLE_PREFIX}community_role_changes`,
  {
    id: text("id").primaryKey(),
    community_id: text("community_id").notNull(),
    user_id: text("user_id").notNull(), // whose role was changed
    changed_by: text("changed_by").notNull(), // admin/owner who made the change
    old_role: text("old_role").notNull(),
    new_role: text("new_role").notNull(),
    created_at: text("created_at").notNull(),
  },
);

// Display ID counter for globally unique IDs
export const displayIdCounter = pgTable(`${TABLE_PREFIX}display_id_counter`, {
  id: serial("id").primaryKey(),
  current_number: integer("current_number").notNull().default(1000),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

// Items table (tasks, habits, goals, projects)
export const items = pgTable(`${TABLE_PREFIX}items`, {
  id: text("id").primaryKey(),
  display_id: text("display_id").unique(), // Human-readable ID like #1000A - GLOBALLY UNIQUE
  user_id: text("user_id").notNull(), // deprecated, use created_by
  created_by: text("created_by").notNull().default(""), // who created the item
  assigned_to: text("assigned_to"), // who is responsible
  shared_with: jsonb("shared_with"), // JSONB array of user IDs with explicit access
  title: text("title").notNull(),
  item_type: text("item_type").notNull(), // task, habit, goal, project
  recurrence_type: text("recurrence_type"), // once, daily, weekly, monthly, yearly, custom
  custom_recurrence: text("custom_recurrence"), // Natural language custom recurrence pattern
  by_day: jsonb("by_day"), // Array of weekdays: ["monday", "wednesday"] for weekly recurrence
  by_monthday: integer("by_monthday"), // Day of month (1-31) for monthly/yearly recurrence
  by_week: integer("by_week"), // Week number (1-4) for "Nth weekday" patterns
  by_month: text("by_month"), // Month name for yearly recurrence
  due_date: text("due_date"), // ISO date string
  time_frame: integer("time_frame"), // minutes
  verify_required: boolean("verify_required").default(false),
  why_it_matters: text("why_it_matters"),
  created_at: text("created_at").notNull(),
  completed_at: text("completed_at"),
  status: text("status").default("open"), // open, complete, pending_review, pending_manual_review
  image_urls: text("image_urls").array(),
  photo_count: integer("photo_count").default(1),
  ai_verification_result: text("ai_verification_result"), // complete, not_complete, unclear
  ai_feedback: text("ai_feedback"),
  verified: boolean("verified"),
  verified_by: text("verified_by"),
  verified_by_user_id: text("verified_by_user_id"),
  verified_at: text("verified_at"),
  manual_review_requested_by: text("manual_review_requested_by"),
  manual_review_requested_at: text("manual_review_requested_at"),
  manual_review_reason: text("manual_review_reason"),
  community_id: text("community_id"), // Nullable — only shared items require this
});

// Item Completions table - tracks per-occurrence completion for recurring items
export const item_completions = pgTable(`${TABLE_PREFIX}item_completions`, {
  id: text("id").primaryKey(),
  item_id: text("item_id").notNull(),
  user_id: text("user_id").notNull(),
  completion_date: text("completion_date").notNull(), // YYYY-MM-DD format
  completed_at: text("completed_at").notNull(),
  verification_data: jsonb("verification_data"), // photo/AI results if applicable
  created_at: text("created_at").notNull(),
});

// Item Verification Attempts table - tracks photo verification attempts and AI feedback
export const item_verification_attempts = pgTable(
  `${TABLE_PREFIX}item_verification_attempts`,
  {
    id: text("id").primaryKey(),
    item_id: text("item_id").notNull(),
    user_id: text("user_id").notNull(),
    image_urls: text("image_urls").notNull(),
    photo_count: integer("photo_count").default(1),
    ai_verification_result: text("ai_verification_result").notNull(), // complete, not_complete, unclear
    ai_feedback: text("ai_feedback").notNull(),
    photo_uploaded_at: text("photo_uploaded_at").notNull(), // timestamp for automatic deletion
    auto_delete_at: text("auto_delete_at").notNull(), // calculated deletion date (14 days from upload)
    photo_deleted: boolean("photo_deleted").default(false), // manual deletion flag
    created_at: text("created_at").notNull(),
  },
);

// Manual Review Actions table - tracks admin/community member review actions
export const manual_review_actions = pgTable(
  `${TABLE_PREFIX}manual_review_actions`,
  {
    id: text("id").primaryKey(),
    item_id: text("item_id").notNull(),
    reviewer_user_id: text("reviewer_user_id").notNull(),
    action: text("action").notNull(), // approve, reject
    message: text("message"), // optional message from reviewer
    created_at: text("created_at").notNull(),
  },
);

// Rewards table - tracks user-proposed rewards and incentives
export const rewards = pgTable(`${TABLE_PREFIX}rewards`, {
  id: text("id").primaryKey(),
  created_by: text("created_by").notNull(), // user who proposed the reward
  shared_with: jsonb("shared_with"), // JSONB array of user IDs who can approve this reward
  title: text("title").notNull(),
  description: text("description"), // optional reward details (e.g., "Pizza night", "Gift card")
  target_metric: text("target_metric").notNull(), // "7-day streak", "100% completion for a week", etc.
  target_value: text("target_value"), // specific value/threshold for the metric
  duration_type: text("duration_type").notNull(), // "date_range", "days", "weeks", "custom"
  duration_value: text("duration_value"), // specific duration (e.g., "7", "2025-07-15")
  start_date: text("start_date"), // when tracking begins
  end_date: text("end_date"), // when tracking ends
  status: text("status").notNull().default("pending"), // pending, approved, active, completed, expired, rejected
  approved_by: text("approved_by"), // user ID who approved the reward
  approved_at: text("approved_at"),
  completed_at: text("completed_at"),
  delivered_by: text("delivered_by"), // user ID who marked reward as delivered
  delivered_at: text("delivered_at"),
  rejection_reason: text("rejection_reason"),
  community_id: text("community_id"), // optional community context
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

// Reward progress history - tracks progress changes over time for analytics
export const reward_progress_history = pgTable(
  `${TABLE_PREFIX}reward_progress_history`,
  {
    id: text("id").primaryKey(),
    reward_id: text("reward_id")
      .notNull()
      .references(() => rewards.id, { onDelete: "cascade" }),
    user_id: text("user_id").notNull(), // user whose progress is being tracked
    progress_percentage: integer("progress_percentage").notNull(), // 0-100
    milestone_reached: text("milestone_reached"), // description of milestone if applicable
    recorded_at: text("recorded_at").notNull(),
    created_at: text("created_at").notNull(),
  },
);

export const insertItemVerificationAttemptSchema = createInsertSchema(
  item_verification_attempts,
).pick({
  item_id: true,
  user_id: true,
  image_urls: true,
  ai_verification_result: true,
  ai_feedback: true,
});

export const insertManualReviewActionSchema = createInsertSchema(
  manual_review_actions,
).pick({
  item_id: true,
  reviewer_user_id: true,
  action: true,
  message: true,
});

export const insertRewardSchema = createInsertSchema(rewards).pick({
  title: true,
  description: true,
  target_metric: true,
  target_value: true,
  duration_type: true,
  duration_value: true,
  start_date: true,
  end_date: true,
  shared_with: true,
  community_id: true,
});

export const updateRewardSchema = createInsertSchema(rewards)
  .pick({
    status: true,
    approved_by: true,
    approved_at: true,
    completed_at: true,
    delivered_by: true,
    delivered_at: true,
    rejection_reason: true,
  })
  .partial();

export const insertRewardProgressHistorySchema = createInsertSchema(
  reward_progress_history,
).pick({
  reward_id: true,
  user_id: true,
  progress_percentage: true,
  milestone_reached: true,
  recorded_at: true,
});

// User Profile table for AI personalization
export const user_profiles = pgTable(`${TABLE_PREFIX}user_profiles`, {
  user_id: text("user_id").primaryKey(), // Firebase UID
  display_name: text("display_name").notNull(),
  avatar_url: text("avatar_url"),
  life_stage: jsonb("life_stage"), // array of strings: ["student", "parent", "entrepreneur"]
  values: jsonb("values"), // JSONB array: ["growth", "rest"]
  overall_goals: jsonb("overall_goals"), // JSONB array: ["build a business", "get healthy"]
  ai_nudge_level: text("ai_nudge_level").default("light"), // none, light, moderate, coach
  tone_preference: text("tone_preference").default("friendly"), // friendly, direct, gentle
  focus_window: text("focus_window").default("variable"), // morning, evening, variable
  energy_curve: text("energy_curve"), // user's natural energy patterns
  work_context: text("work_context"), // remote, 9-to-5, freelance, etc.
  habit_style: text("habit_style"), // routine, flexible
  task_style: text("task_style"), // deep work, many small tasks
  wake_time: text("wake_time"), // e.g. "07:30"
  sleep_time: text("sleep_time"), // e.g. "22:00"
  notification_opt_in: boolean("notification_opt_in").default(true),
  timezone: text("timezone").default("America/Los_Angeles"), // User's IANA timezone
  created_at: text("created_at").notNull(),
});

// MindDouble specific schemas

// Mood schema
export const moodSchema = z.object({
  id: z.string(),
  mood_emoji: z.string(),
  timestamp: z.string(), // ISO date string
  created_at: z.string(), // ISO date string
});

export type Mood = z.infer<typeof moodSchema>;
export const insertMoodSchema = moodSchema.omit({ id: true, created_at: true });
export type InsertMood = z.infer<typeof insertMoodSchema>;

// Item schema (tasks, habits, goals, projects)
export const itemSchema = z.object({
  id: z.string(),
  user_id: z.string(), // deprecated, use created_by
  created_by: z.string(), // who created the item
  assigned_to: z.string().optional().nullable(), // who is responsible
  shared_with: z.array(z.string()).optional().nullable(), // array of user IDs with explicit access
  title: z.string(),
  item_type: z.enum(["task", "habit", "goal", "project"]),
  recurrence_type: z
    .enum(["once", "daily", "weekly", "monthly", "yearly", "custom"])
    .optional(),
  custom_recurrence: z.string().optional(),
  by_day: z.array(z.string()).optional(), // Array of weekdays for weekly recurrence
  by_monthday: z.number().optional(), // Day of month (1-31) for monthly/yearly recurrence
  by_week: z.number().optional(), // Week number (1-4) for "Nth weekday" patterns
  by_month: z.string().optional(), // Month name for yearly recurrence
  due_date: z.string().optional().nullable(), // ISO date string
  time_frame: z.number().optional().nullable(), // minutes
  verify_required: z.boolean().optional(),
  why_it_matters: z.string().optional(),
  created_at: z.string(), // ISO date string
  completed_at: z.string().optional(), // ISO date string
  status: z
    .enum(["open", "complete", "pending_review", "pending_manual_review"])
    .optional(),
  image_url: z.string().optional(),
  ai_verification_result: z
    .enum(["complete", "not_complete", "unclear"])
    .optional(),
  ai_feedback: z.string().optional(),
  verified: z.boolean().optional(),
  verified_by: z.string().optional(),
  verified_at: z.string().optional(),
  community_id: z.string().optional(),
});

export type Item = z.infer<typeof itemSchema>;
export const insertItemSchema = z.object({
  title: z.string().min(1),
  item_type: z.enum(["task", "habit", "goal", "project"]),
  recurrence_type: z
    .enum(["once", "daily", "weekly", "monthly", "yearly", "custom"])
    .default("once"),
  custom_recurrence: z.string().optional(),
  by_day: z.array(z.string()).optional(),
  by_monthday: z.number().optional(),
  by_week: z.number().optional(),
  by_month: z.string().optional(),
  due_date: z.string().optional().nullable(),
  time_frame: z.number().optional().nullable(),
  verify_required: z.boolean().default(false),
  why_it_matters: z.string().optional(),
  assigned_to: z.string().optional().nullable(),
  shared_with: z.array(z.string()).optional().nullable(),
});
export type InsertItem = z.infer<typeof insertItemSchema>;

// Community schema
export const communitySchema = z.object({
  id: z.string(),
  name: z.string(),
  created_by: z.string(),
  type: z.enum(["family", "roommates", "team", "custom"]),
  created_at: z.string(),
});

export type Community = z.infer<typeof communitySchema>;
export const insertCommunitySchema = communitySchema.omit({
  id: true,
  created_at: true,
});

// Reward schema and types
export const rewardSchema = z.object({
  id: z.string(),
  created_by: z.string(),
  shared_with: z.array(z.string()).optional().nullable(),
  title: z.string(),
  description: z.string().optional().nullable(),
  target_metric: z.string(),
  target_value: z.string().optional().nullable(),
  duration_type: z.enum(["date_range", "days", "weeks", "custom"]),
  duration_value: z.string().optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  status: z.enum([
    "pending",
    "approved",
    "active",
    "completed",
    "expired",
    "rejected",
  ]),
  approved_by: z.string().optional().nullable(),
  approved_at: z.string().optional().nullable(),
  completed_at: z.string().optional().nullable(),
  delivered_by: z.string().optional().nullable(),
  delivered_at: z.string().optional().nullable(),
  rejection_reason: z.string().optional().nullable(),
  community_id: z.string().optional().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Reward = z.infer<typeof rewardSchema>;
export type InsertReward = z.infer<typeof insertRewardSchema>;
export type UpdateReward = z.infer<typeof updateRewardSchema>;
export type InsertCommunity = z.infer<typeof insertCommunitySchema>;

// Community member schema
export const communityMemberSchema = z.object({
  id: z.string(),
  community_id: z.string(),
  user_id: z.string(),
  role: z.enum(["owner", "admin", "member"]),
  joined_at: z.string(),
});

export type CommunityMember = z.infer<typeof communityMemberSchema>;
export const insertCommunityMemberSchema = communityMemberSchema.omit({
  id: true,
  joined_at: true,
});
export type InsertCommunityMember = z.infer<typeof insertCommunityMemberSchema>;

// Community invitation schema
export const communityInvitationSchema = z.object({
  id: z.string(),
  community_id: z.string(),
  inviter_id: z.string(),
  invitee_email: z.string(),
  status: z.enum(["pending", "accepted", "declined"]),
  created_at: z.string(),
  expires_at: z.string(),
});

export type CommunityInvitation = z.infer<typeof communityInvitationSchema>;
export const insertCommunityInvitationSchema = communityInvitationSchema.omit({
  id: true,
  created_at: true,
});
export type InsertCommunityInvitation = z.infer<
  typeof insertCommunityInvitationSchema
>;

// Community role change schema
export const communityRoleChangeSchema = z.object({
  id: z.string(),
  community_id: z.string(),
  user_id: z.string(),
  changed_by: z.string(),
  old_role: z.enum(["owner", "admin", "member"]),
  new_role: z.enum(["owner", "admin", "member"]),
  created_at: z.string(),
});

export type CommunityRoleChange = z.infer<typeof communityRoleChangeSchema>;
export const insertCommunityRoleChangeSchema = communityRoleChangeSchema.omit({
  id: true,
  created_at: true,
});
export type InsertCommunityRoleChange = z.infer<
  typeof insertCommunityRoleChangeSchema
>;

// AI Time Estimate schema
export const timeEstimateSchema = z.object({
  minutes: z.number(),
  formatted: z.string(),
});

export type TimeEstimate = z.infer<typeof timeEstimateSchema>;

// AI Day Plan schema
export const dayPlanSchema = z.object({
  explanation: z.string(),
  prioritized_tasks: z.array(itemSchema),
});

export type DayPlan = z.infer<typeof dayPlanSchema>;

// User Profile schema
export const userProfileSchema = z.object({
  user_id: z.string(),
  display_name: z.string().optional(),
  avatar_url: z.string().nullable(),
  life_stage: z.array(z.string()).optional(),
  values: z.array(z.string()).nullable(),
  overall_goals: z.array(z.string()).nullable(),
  ai_nudge_level: z.enum(["none", "light", "moderate", "coach"]).nullable(),
  tone_preference: z.enum(["friendly", "direct", "gentle"]).nullable(),
  focus_window: z.enum(["morning", "evening", "variable"]).nullable(),
  energy_curve: z.string().nullable(),
  work_context: z.string().nullable(),
  habit_style: z.string().nullable(),
  task_style: z.string().nullable(),
  wake_time: z.string().nullable(),
  sleep_time: z.string().nullable(),
  notification_opt_in: z.boolean().nullable(),
  timezone: z.string().nullable(), // User's timezone (e.g., "America/Los_Angeles")
  created_at: z.string(),
});

export type UserProfile = z.infer<typeof userProfileSchema>;

export const updateUserProfileSchema = userProfileSchema
  .omit({
    user_id: true,
    created_at: true,
  })
  .partial();

export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;

// Item skips schema for smart scheduling
export const itemSkipSchema = z.object({
  id: z.string(),
  item_id: z.string(),
  user_id: z.string(),
  skipped_date: z.string(), // YYYY-MM-DD format
  reason: z.string().optional(),
  created_at: z.string(),
});

export type ItemSkip = z.infer<typeof itemSkipSchema>;
export const insertItemSkipSchema = itemSkipSchema.omit({
  id: true,
  created_at: true,
});
export type InsertItemSkip = z.infer<typeof insertItemSkipSchema>;

// ===== PHASE 1: NEW RECURRING ITEM ARCHITECTURE =====
// Recurring Templates table - stores the recurring pattern definition
// FAANG-Level Architecture: Supports both recurring and one-time items
export const recurring_templates = pgTable(
  `${TABLE_PREFIX}recurring_templates`,
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    item_type: text("item_type").notNull(), // task, habit, goal, project
    why_it_matters: text("why_it_matters"),
    verify_required: boolean("verify_required").default(false),
    time_frame: integer("time_frame"), // minutes

    // FAANG-Level Recurrence Design
    is_recurring: boolean("is_recurring").notNull().default(false), // false for one-time items
    recurrence_type: text("recurrence_type"), // daily, weekly, monthly, yearly
    by_day: text("by_day").array(), // ['monday', 'wednesday', 'friday']
    by_monthday: integer("by_monthday").array(), // [1, 15, 30]
    by_week: integer("by_week").array(), // [1, 2, 3, 4] for monthly
    by_month: text("by_month").array(), // ['january', 'july']
    max_occurrences: integer("max_occurrences"), // 1 for one-time items

    // Metadata and ownership
    created_by: text("created_by").notNull(),
    assigned_to: text("assigned_to"), // default assignee for new instances
    community_id: text("community_id"),
    shared_with: text("shared_with").array(), // array of user IDs with explicit access

    // Status and timestamps
    is_active: boolean("is_active").default(true), // for soft deletion
    display_id: text("display_id"), // Global unique display ID (#1000A, #1001A, etc.)
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
);

// Recurring Instances table - individual occurrences of recurring templates
export const recurring_instances = pgTable(
  `${TABLE_PREFIX}recurring_instances`,
  {
    id: text("id").primaryKey(),
    template_id: text("template_id"), // nullable for one-time items
    occurrence_date: text("occurrence_date").notNull(), // YYYY-MM-DD format
    due_time: text("due_time"), // HH:MM format for specific time
    status: text("status").notNull().default("pending"), // pending, completed, skipped, failed
    assigned_to: text("assigned_to"), // can override template assignment
    image_urls: text("image_urls").array(),
    photo_count: integer("photo_count").default(1),
    shared_with: text("shared_with").array(), // Phase 5: instance-level sharing
    completed_at: text("completed_at"),
    completed_by: text("completed_by"), // who completed it (if different from assigned_to)
    verified: boolean("verified").default(false),
    verified_by: text("verified_by"),
    verified_at: text("verified_at"),
    ai_verification_result: text("ai_verification_result"), // complete, not_complete, unclear
    ai_feedback: text("ai_feedback"),
    verification_image_url: text("verification_image_url"),
    notes: text("notes"), // user notes for this specific occurrence
    display_id: text("display_id"), // Global unique display ID (#1000A, #1001A, etc.)
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
);

// Zod schemas for recurring templates
export const recurringTemplateSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  item_type: z.enum(["task", "habit", "goal", "project"]),
  recurrence_pattern: z.object({
    type: z.enum(["daily", "weekly", "monthly", "yearly", "custom"]),
    by_day: z.array(z.string()).optional(), // ["monday", "wednesday", "friday"]
    by_monthday: z.number().optional(), // 1-31
    by_week: z.number().optional(), // 1-4 for "nth weekday"
    by_month: z.string().optional(), // "january", "february", etc.
    interval: z.number().default(1), // every N days/weeks/months
    custom_rule: z.string().optional(), // for complex patterns
  }),
  created_by: z.string(),
  assigned_to: z.string().optional(),
  verify_required: z.boolean().default(false),
  why_it_matters: z.string().optional(),
  community_id: z.string().optional(),
  shared_with: z.array(z.string()).optional(),
  time_frame: z.number().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  is_active: z.boolean().default(true),
});

export type RecurringTemplate = z.infer<typeof recurringTemplateSchema>;

export const insertRecurringTemplateSchema = recurringTemplateSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertRecurringTemplate = z.infer<
  typeof insertRecurringTemplateSchema
>;

// Zod schemas for recurring instances
export const recurringInstanceSchema = z.object({
  id: z.string(),
  template_id: z.string(),
  occurrence_date: z.string(), // YYYY-MM-DD
  due_time: z.string().optional(), // HH:MM
  status: z
    .enum(["pending", "completed", "skipped", "failed"])
    .default("pending"),
  assigned_to: z.string().optional(),
  shared_with: z.array(z.string()).optional(), // Phase 5: instance-level sharing
  completed_at: z.string().optional(),
  completed_by: z.string().optional(),
  verified: z.boolean().default(false),
  verified_by: z.string().optional(),
  verified_at: z.string().optional(),
  image_urls: z.array(z.string()).optional(),
  photo_count: z.number().optional().default(1),
  ai_verification_result: z
    .enum(["complete", "not_complete", "unclear"])
    .optional(),
  ai_feedback: z.string().optional(),
  verification_image_url: z.string().optional(),
  notes: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type RecurringInstance = z.infer<typeof recurringInstanceSchema>;

export const insertRecurringInstanceSchema = recurringInstanceSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertRecurringInstance = z.infer<
  typeof insertRecurringInstanceSchema
>;
