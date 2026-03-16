-- BLD-007: Canonical availability intake persistence (dual-write bridge)

CREATE TABLE IF NOT EXISTS public.availability_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    public_link_id uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
    participant_name text NOT NULL,
    participant_email text NOT NULL,
    choices jsonb NOT NULL DEFAULT '[]'::jsonb,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_availability_submissions_public_link
    ON public.availability_submissions(public_link_id, created_at DESC);

ALTER TABLE public.availability_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can read availability submissions" ON public.availability_submissions;
CREATE POLICY "Owners can read availability submissions"
    ON public.availability_submissions
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.schedules s
        WHERE s.id = availability_submissions.public_link_id
          AND s.user_id = auth.uid()
      )
    );

DROP POLICY IF EXISTS "Public can submit availability for active schedules" ON public.availability_submissions;
CREATE POLICY "Public can submit availability for active schedules"
    ON public.availability_submissions
    FOR INSERT TO public
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.schedules s
        WHERE s.id = availability_submissions.public_link_id
          AND s.status IN ('collecting', 'archived')
      )
    );
