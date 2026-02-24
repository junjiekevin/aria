-- Phase 0: Security Hardening (Fixing Supabase Lints)
ALTER TABLE public.form_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_entries_backup ENABLE ROW LEVEL SECURITY;
ALTER FUNCTION public.handle_new_user SET search_path = '';

-- Phase 1: Agentic Operations Database Changes
-- Add cancellation_policy_hours column
ALTER TABLE public.schedules 
ADD COLUMN IF NOT EXISTS cancellation_policy_hours integer DEFAULT 24 NOT NULL;

-- Update status constraint to include 'published'
-- Note: We first drop the existing constraint and then add the new one.
-- Assuming the constraint is named something like 'schedules_status_check'
DO $$ 
BEGIN 
    ALTER TABLE public.schedules DROP CONSTRAINT IF EXISTS schedules_status_check;
    ALTER TABLE public.schedules 
    ADD CONSTRAINT schedules_status_check 
    CHECK (status IN ('draft', 'collecting', 'published', 'archived', 'trashed'));
END $$;
