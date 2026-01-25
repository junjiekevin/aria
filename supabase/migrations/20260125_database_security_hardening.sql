-- ==============================================================================
-- MIGRATION: 20260125_database_security_hardening.sql
-- DESCRIPTION: Fixes the "Schedule not found" bug for anonymous participants and
--              hardens the database by restricting public access while ensuring
--              the Owner (authenticated) has full CRUD liberty over their data.
-- ==============================================================================

-- ==========================================
-- 1. FIX SCHEDULES (OWNER FULL LIBERTY + PUBLIC READ)
-- ==========================================

-- Ensure owner has full control (CRUD)
DROP POLICY IF EXISTS "Users can view own schedules" ON schedules;
DROP POLICY IF EXISTS "Users can insert own schedules" ON schedules;
DROP POLICY IF EXISTS "Users can update own schedules" ON schedules;
DROP POLICY IF EXISTS "Users can delete own schedules" ON schedules;
DROP POLICY IF EXISTS "Owners have full control of their schedules" ON schedules;

CREATE POLICY "Owners have full control of their schedules" ON schedules
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Fix "Not Found" bug for anonymous participants
-- Allows participants to see basic schedule info so the form can load
DROP POLICY IF EXISTS "Allow public select for active schedules" ON schedules;
CREATE POLICY "Allow public select for active schedules" ON schedules
FOR SELECT TO public
USING (status IN ('collecting', 'archived'));


-- ==========================================
-- 2. HARDEN SCHEDULE ENTRIES (EVENTS)
-- ==========================================

-- Ensure owner has full CRUD for events related to their schedules
DROP POLICY IF EXISTS "Users can view own schedule entries" ON schedule_entries;
DROP POLICY IF EXISTS "Users can insert schedule entries" ON schedule_entries;
DROP POLICY IF EXISTS "Users can update own schedule entries" ON schedule_entries;
DROP POLICY IF EXISTS "Users can delete own schedule entries" ON schedule_entries;
DROP POLICY IF EXISTS "Owners can manage schedule entries" ON schedule_entries;

CREATE POLICY "Owners can manage schedule entries" ON schedule_entries
FOR ALL TO authenticated
USING (
  auth.uid() = (SELECT user_id FROM schedules WHERE id = schedule_entries.schedule_id)
)
WITH CHECK (
  auth.uid() = (SELECT user_id FROM schedules WHERE id = schedule_entries.schedule_id)
);


-- ==========================================
-- 3. HARDEN FORM RESPONSES (PARTICIPANTS)
-- ==========================================

-- A. Remove potential vulnerabilities (clearing out all old/incorrect policies)
DROP POLICY IF EXISTS "Allow anyone to delete form responses" ON form_responses;
DROP POLICY IF EXISTS "Allow authenticated delete" ON form_responses;
DROP POLICY IF EXISTS "Allow authenticated updates" ON form_responses;
DROP POLICY IF EXISTS "Allow authenticated inserts" ON form_responses;
DROP POLICY IF EXISTS "Allow public inserts" ON form_responses;
DROP POLICY IF EXISTS "Allow public select" ON form_responses;
DROP POLICY IF EXISTS "Users can view own form responses" ON form_responses;
DROP POLICY IF EXISTS "Public can submit responses during collecting" ON form_responses;
DROP POLICY IF EXISTS "Public select for duplicate check" ON form_responses;
DROP POLICY IF EXISTS "Owners can manage form responses" ON form_responses;

-- B. Ensure owner has full CRUD (management liberty)
CREATE POLICY "Owners can manage form responses" ON form_responses
FOR ALL TO authenticated
USING (
  auth.uid() = (SELECT user_id FROM schedules WHERE id = form_responses.schedule_id)
);

-- C. Explicitly allow public submission during 'collecting' status
CREATE POLICY "Public can submit responses during collecting" ON form_responses
FOR INSERT TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM schedules 
    WHERE id = form_responses.schedule_id 
    AND status = 'collecting'
  )
);

-- D. Restrict public read privacy (limited to duplicate checking only)
CREATE POLICY "Public select for duplicate check" ON form_responses
FOR SELECT TO public
USING (
  EXISTS (
    SELECT 1 FROM schedules 
    WHERE id = form_responses.schedule_id 
    AND status = 'collecting'
  )
);
