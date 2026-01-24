-- Add working hours columns to schedules table
ALTER TABLE public.schedules
ADD COLUMN working_hours_start INTEGER DEFAULT 8 NOT NULL,
ADD COLUMN working_hours_end INTEGER DEFAULT 21 NOT NULL;

-- Add check constraint to ensure start < end
ALTER TABLE public.schedules
ADD CONSTRAINT working_hours_check CHECK (working_hours_start < working_hours_end);
