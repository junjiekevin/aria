-- Phase 1: Plan → Confirm → Execute
-- Stores proposed schedule changes for preview before committing.

CREATE TABLE IF NOT EXISTS public.schedule_plans (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    schedule_id uuid REFERENCES public.schedules(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) NOT NULL,
    status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'committed', 'expired')),
    changes jsonb NOT NULL DEFAULT '[]',
    conflicts jsonb DEFAULT '[]',
    summary text,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz DEFAULT (now() + interval '10 minutes')
);

-- Index for fast lookup by schedule
CREATE INDEX IF NOT EXISTS idx_schedule_plans_schedule_id ON public.schedule_plans(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_plans_status ON public.schedule_plans(status);

-- RLS
ALTER TABLE public.schedule_plans ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own plans
CREATE POLICY "Users manage own plans"
    ON public.schedule_plans
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
