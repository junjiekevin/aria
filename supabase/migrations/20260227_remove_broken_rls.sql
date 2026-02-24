-- Remove broken RLS policy on schedules that queries auth.users directly.
-- The authenticated role does not have SELECT permissions on auth.users, causing a permission denied error.
-- The owner already has full CRUD via "Owners have full control of their schedules" from 20260125_database_security_hardening.sql

DROP POLICY IF EXISTS "Allow users to update send_confirmation_email" ON schedules;
