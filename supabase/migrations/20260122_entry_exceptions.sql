-- Add table to track skipped/exception dates for recurring entries
CREATE TABLE IF NOT EXISTS schedule_entry_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL REFERENCES schedule_entries(id) ON DELETE CASCADE,
    exception_date DATE NOT NULL, -- The date to skip/hide
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Allow anyone to view exceptions
CREATE POLICY "Allow public select on exceptions" ON schedule_entry_exceptions
FOR SELECT TO public USING (true);

-- Allow authenticated users to manage exceptions
CREATE POLICY "Allow authenticated CRUD on exceptions" ON schedule_entry_exceptions
FOR ALL TO authenticated USING (true);

-- Enable RLS
ALTER TABLE schedule_entry_exceptions ENABLE ROW LEVEL SECURITY;
