-- Add phone_number column to user_profiles table
-- This prepares the system for future SMS/text message functionality

-- Production environment
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Development environment
ALTER TABLE dev_user_profiles
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.phone_number IS 'Optional mobile number for SMS notifications and text message features';
COMMENT ON COLUMN dev_user_profiles.phone_number IS 'Optional mobile number for SMS notifications and text message features';
