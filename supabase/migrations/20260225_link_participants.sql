-- Add participant_id to schedule_entries to link them to form_responses (participants)
-- This allows us to reliably get the participant's email for notifications
ALTER TABLE public.schedule_entries 
ADD COLUMN IF NOT EXISTS participant_id uuid REFERENCES public.form_responses(id) ON DELETE SET NULL;

-- Create an index to improve lookup performance
DROP INDEX IF EXISTS public.idx_schedule_entries_participant_id;
CREATE INDEX idx_schedule_entries_participant_id ON public.schedule_entries(participant_id);
