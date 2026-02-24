-- Remediation for RLS Enabled No Policy (public.schedule_entries_backup)
-- This satisfies the linter by providing a policy, while ensuring no unauthorized access.
-- Service role (admin) will still have full access.
DROP POLICY IF EXISTS "Restrict all access" ON public.schedule_entries_backup;
CREATE POLICY "Restrict all access" ON public.schedule_entries_backup
FOR ALL TO public
USING (false);
