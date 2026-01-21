-- Add RLS policies for schedules table
-- The 406 error was because there were no policies for authenticated users

-- Enable RLS on schedules
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own schedules" ON schedules;
DROP POLICY IF EXISTS "Users can insert own schedules" ON schedules;
DROP POLICY IF EXISTS "Users can update own schedules" ON schedules;
DROP POLICY IF EXISTS "Users can delete own schedules" ON schedules;

-- Allow authenticated users to view their own schedules
CREATE POLICY "Users can view own schedules" ON schedules
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Allow authenticated users to insert their own schedules
CREATE POLICY "Users can insert own schedules" ON schedules
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Allow authenticated users to update their own schedules
CREATE POLICY "Users can update own schedules" ON schedules
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow authenticated users to delete their own schedules
CREATE POLICY "Users can delete own schedules" ON schedules
FOR DELETE TO authenticated
USING (user_id = auth.uid());
