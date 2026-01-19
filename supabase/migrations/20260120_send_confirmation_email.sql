-- Add send_confirmation_email column to schedules table
-- This allows the schedule owner to enable/disable automatic confirmation emails

ALTER TABLE schedules
ADD COLUMN IF NOT EXISTS send_confirmation_email boolean DEFAULT false;

-- Update existing collecting schedules to have confirmation emails enabled by default
UPDATE schedules
SET send_confirmation_email = true
WHERE status = 'collecting' AND send_confirmation_email IS NULL;

-- Create a policy to allow users to update their own schedule's email setting
CREATE POLICY "Allow users to update send_confirmation_email"
ON schedules
FOR UPDATE
TO authenticated
USING (
    auth.uid() IN (
        SELECT id FROM auth.users WHERE email = (
            SELECT email FROM auth.users WHERE id = schedules.user_id
        )
    )
);
