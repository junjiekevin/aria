-- Allow public to select schedule_entries by ID
-- This supports the CancelPage showing event details to participants
CREATE POLICY "Allow public select by id" ON public.schedule_entries
FOR SELECT TO public
USING (true);

-- Also allow public to view schedules (public label, etc.)
CREATE POLICY "Allow public select" ON public.schedules
FOR SELECT TO public
USING (status IN ('collecting', 'published'));
