-- Migration: Add preferred timings columns to form_responses
-- Created: 2026-01-19
-- Description: Adds columns for storing up to 3 preferred time slots for each student

-- Make top_choices and email nullable (we use preferred timings instead)
ALTER TABLE form_responses
ALTER COLUMN top_choices DROP NOT NULL;

ALTER TABLE form_responses
ALTER COLUMN email DROP NOT NULL;

-- Add columns for Preferred Timing 1 (required)
ALTER TABLE form_responses
ADD COLUMN IF NOT EXISTS preferred_1_day VARCHAR(20);

ALTER TABLE form_responses
ADD COLUMN IF NOT EXISTS preferred_1_start TIME;

ALTER TABLE form_responses
ADD COLUMN IF NOT EXISTS preferred_1_end TIME;

ALTER TABLE form_responses
ADD COLUMN IF NOT EXISTS preferred_1_frequency VARCHAR(20);

-- Add columns for Preferred Timing 2 (optional)
ALTER TABLE form_responses
ADD COLUMN IF NOT EXISTS preferred_2_day VARCHAR(20);

ALTER TABLE form_responses
ADD COLUMN IF NOT EXISTS preferred_2_start TIME;

ALTER TABLE form_responses
ADD COLUMN IF NOT EXISTS preferred_2_end TIME;

ALTER TABLE form_responses
ADD COLUMN IF NOT EXISTS preferred_2_frequency VARCHAR(20);

-- Add columns for Preferred Timing 3 (optional)
ALTER TABLE form_responses
ADD COLUMN IF NOT EXISTS preferred_3_day VARCHAR(20);

ALTER TABLE form_responses
ADD COLUMN IF NOT EXISTS preferred_3_start TIME;

ALTER TABLE form_responses
ADD COLUMN IF NOT EXISTS preferred_3_end TIME;

ALTER TABLE form_responses
ADD COLUMN IF NOT EXISTS preferred_3_frequency VARCHAR(20);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_form_responses_preferred_1_day
ON form_responses(preferred_1_day);

CREATE INDEX IF NOT EXISTS idx_form_responses_schedule_id
ON form_responses(schedule_id);

CREATE INDEX IF NOT EXISTS idx_form_responses_student_name
ON form_responses(student_name);

-- Allow public inserts for development (only if policy doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public inserts' AND tablename = 'form_responses') THEN
        CREATE POLICY "Allow public inserts"
        ON form_responses
        FOR INSERT
        TO public
        WITH CHECK (true);
    END IF;
END $$;
