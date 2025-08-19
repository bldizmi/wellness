-- Phase 5: Community Sharing Logic
-- Add instance-level sharing capability to recurring_instances table

-- Add shared_with column for instance-level sharing (development)
ALTER TABLE dev_recurring_instances 
ADD COLUMN IF NOT EXISTS shared_with text[];

-- Add shared_with column for instance-level sharing (production)  
ALTER TABLE recurring_instances 
ADD COLUMN IF NOT EXISTS shared_with text[];

-- Update recurring_instances with proper indexes for Phase 5 sharing queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recurring_instances_shared_with 
ON dev_recurring_instances USING GIN(shared_with);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recurring_instances_shared_with_prod 
ON recurring_instances USING GIN(shared_with);

-- Create composite index for shared instance visibility queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recurring_instances_sharing_lookup
ON dev_recurring_instances(template_id, occurrence_date, assigned_to);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recurring_instances_sharing_lookup_prod
ON recurring_instances(template_id, occurrence_date, assigned_to);

-- Verify the migration
SELECT 'dev_recurring_instances' as table_name, 
       column_name, 
       data_type 
FROM information_schema.columns 
WHERE table_name = 'dev_recurring_instances' 
AND column_name = 'shared_with'
UNION ALL
SELECT 'recurring_instances' as table_name, 
       column_name, 
       data_type 
FROM information_schema.columns 
WHERE table_name = 'recurring_instances' 
AND column_name = 'shared_with';