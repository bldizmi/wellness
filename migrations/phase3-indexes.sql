-- Phase 3: FAANG-Level Database Indexes for Calendar Optimization
-- Critical indexes for millions of users with predictable query performance

-- Ensure recurring_instances table exists (from Phase 2)
-- Production environment
CREATE TABLE IF NOT EXISTS recurring_instances (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  occurrence_date TEXT NOT NULL, -- YYYY-MM-DD format
  due_time TEXT, -- HH:MM format for specific time
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, skipped, failed
  assigned_to TEXT, -- can override template assignment
  completed_at TEXT,
  completed_by TEXT, -- who completed it (if different from assigned_to)
  verified BOOLEAN DEFAULT false,
  verified_by TEXT,
  verified_at TEXT,
  ai_verification_result TEXT, -- complete, not_complete, unclear
  ai_feedback TEXT,
  verification_image_url TEXT,
  notes TEXT, -- user notes for this specific occurrence
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Development environment
CREATE TABLE IF NOT EXISTS dev_recurring_instances (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  occurrence_date TEXT NOT NULL, -- YYYY-MM-DD format
  due_time TEXT, -- HH:MM format for specific time
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, skipped, failed
  assigned_to TEXT, -- can override template assignment
  completed_at TEXT,
  completed_by TEXT, -- who completed it (if different from assigned_to)
  verified BOOLEAN DEFAULT false,
  verified_by TEXT,
  verified_at TEXT,
  ai_verification_result TEXT, -- complete, not_complete, unclear
  ai_feedback TEXT,
  verification_image_url TEXT,
  notes TEXT, -- user notes for this specific occurrence
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Ensure recurring_templates table exists (from Phase 2)
-- Production environment
CREATE TABLE IF NOT EXISTS recurring_templates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  item_type TEXT NOT NULL, -- task, habit, goal, project
  verify_required BOOLEAN DEFAULT false,
  recurrence_pattern JSONB NOT NULL, -- stores frequency, days, etc.
  created_by TEXT NOT NULL,
  assigned_to TEXT, -- default assignee for new instances
  shared_with TEXT[], -- array of user IDs
  community_id TEXT,
  why_it_matters TEXT,
  time_frame TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  display_id TEXT
);

-- Development environment
CREATE TABLE IF NOT EXISTS dev_recurring_templates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  item_type TEXT NOT NULL, -- task, habit, goal, project
  verify_required BOOLEAN DEFAULT false,
  recurrence_pattern JSONB NOT NULL, -- stores frequency, days, etc.
  created_by TEXT NOT NULL,
  assigned_to TEXT, -- default assignee for new instances
  shared_with TEXT[], -- array of user IDs
  community_id TEXT,
  why_it_matters TEXT,
  time_frame TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  display_id TEXT
);

-- CRITICAL PERFORMANCE INDEXES FOR MILLIONS OF USERS

-- PRIMARY INDEX: Personal progress queries (covers 90% of traffic)
-- This is the most important index for calendar performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recurring_instances_user_date 
ON recurring_instances (assigned_to, occurrence_date) 
INCLUDE (status, verified);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dev_recurring_instances_user_date 
ON dev_recurring_instances (assigned_to, occurrence_date) 
INCLUDE (status, verified);

-- SECONDARY INDEX: Template-based lookups for metrics calculations (Phase 4)
-- Supports completion rate calculations and streak tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recurring_instances_template_date 
ON recurring_instances (template_id, occurrence_date) 
INCLUDE (status, completed_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dev_recurring_instances_template_date 
ON dev_recurring_instances (template_id, occurrence_date) 
INCLUDE (status, completed_at);

-- TERTIARY INDEX: Completion aggregations and reporting
-- Supports analytics and insights calculations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recurring_instances_date_status 
ON recurring_instances (occurrence_date, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dev_recurring_instances_date_status 
ON dev_recurring_instances (occurrence_date, status);

-- COMMUNITY INDEX: Sharing queries optimization
-- Supports community collaboration features
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recurring_templates_sharing 
ON recurring_templates (created_by) 
INCLUDE (shared_with, item_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dev_recurring_templates_sharing 
ON dev_recurring_templates (created_by) 
INCLUDE (shared_with, item_type);

-- WEEK BATCH INDEX: Optimizes week-range queries
-- Supports efficient week calendar loading
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recurring_instances_user_date_range 
ON recurring_instances (assigned_to, occurrence_date) 
WHERE occurrence_date >= CURRENT_DATE - INTERVAL '30 days';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dev_recurring_instances_user_date_range 
ON dev_recurring_instances (assigned_to, occurrence_date) 
WHERE occurrence_date >= CURRENT_DATE - INTERVAL '30 days';

-- ANALYTICS INDEX: Performance monitoring and insights
-- Supports observability and performance tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recurring_instances_analytics 
ON recurring_instances (created_at, status, verified) 
INCLUDE (assigned_to, template_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dev_recurring_instances_analytics 
ON dev_recurring_instances (created_at, status, verified) 
INCLUDE (assigned_to, template_id);

-- VERIFICATION INDEX: AI verification and completion tracking
-- Supports photo verification workflows
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recurring_instances_verification 
ON recurring_instances (verified, ai_verification_result) 
INCLUDE (template_id, occurrence_date, assigned_to);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dev_recurring_instances_verification 
ON dev_recurring_instances (verified, ai_verification_result) 
INCLUDE (template_id, occurrence_date, assigned_to);

-- Query performance validation (run after index creation)
-- These queries should execute in <5ms with proper indexes
/*
-- Test personal progress query performance
EXPLAIN ANALYZE 
SELECT ri.*, rt.title, rt.item_type, rt.verify_required 
FROM recurring_instances ri 
JOIN recurring_templates rt ON ri.template_id = rt.id 
WHERE ri.assigned_to = 'test-user-id' 
AND ri.occurrence_date = '2025-07-04';

-- Test week batch query performance  
EXPLAIN ANALYZE
SELECT ri.*, rt.title, rt.item_type, rt.verify_required 
FROM recurring_instances ri 
JOIN recurring_templates rt ON ri.template_id = rt.id 
WHERE ri.assigned_to = 'test-user-id' 
AND ri.occurrence_date = ANY(ARRAY['2025-07-01','2025-07-02','2025-07-03','2025-07-04','2025-07-05','2025-07-06','2025-07-07']);
*/