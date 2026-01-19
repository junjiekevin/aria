-- Migration: Convert recurring entries to individual entries
-- This migration expands each entry with a recurrence_rule into multiple individual entries
-- and removes the original recurring entry.

-- Create a function to expand a recurring entry
CREATE OR REPLACE FUNCTION expand_recurring_entry(
    p_entry_id UUID,
    p_schedule_start DATE,
    p_schedule_weeks INTEGER
) RETURNS INTEGER AS $$
DECLARE
    v_entry RECORD;
    v_start_time TIMESTAMPTZ;
    v_end_time TIMESTAMPTZ;
    v_entry_day INTEGER;
    v_rule TEXT;
    v_freq TEXT;
    v_interval INTEGER;
    v_week INTEGER;
    v_days_to_first INTEGER;
    v_first_occurrence DATE;
    v_occurrence DATE;
    v_start_hour INTEGER;
    v_start_minute INTEGER;
    v_end_hour INTEGER;
    v_end_minute INTEGER;
    v_new_start TIMESTAMPTZ;
    v_new_end TIMESTAMPTZ;
    v_created_count INTEGER := 0;
BEGIN
    -- Get the entry details
    SELECT * INTO v_entry FROM schedule_entries WHERE id = p_entry_id;
    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    v_start_time := v_entry.start_time;
    v_end_time := v_entry.end_time;
    v_entry_day := EXTRACT(DOW FROM v_start_time)::INTEGER;
    v_rule := v_entry.recurrence_rule;

    -- Parse the frequency from the rule
    v_freq := COALESCE(
        (SELECT UPPER(m[1]) FROM regexp_matches(v_rule, 'FREQ=(\w+)') AS m),
        'WEEKLY'
    );
    v_interval := COALESCE(
        (SELECT m[1]::INTEGER FROM regexp_matches(v_rule, 'INTERVAL=(\d+)') AS m),
        1
    );

    -- Get time components
    v_start_hour := EXTRACT(HOUR FROM v_start_time)::INTEGER;
    v_start_minute := EXTRACT(MINUTE FROM v_start_time)::INTEGER;
    v_end_hour := EXTRACT(HOUR FROM v_end_time)::INTEGER;
    v_end_minute := EXTRACT(MINUTE FROM v_end_time)::INTEGER;

    -- Find the first occurrence of this day after schedule start
    v_days_to_first := v_entry_day - EXTRACT(DOW FROM p_schedule_start)::INTEGER;
    IF v_days_to_first < 0 THEN v_days_to_first := v_days_to_first + 7; END IF;
    v_first_occurrence := p_schedule_start + v_days_to_first;

    -- Generate entries for each week
    FOR v_week IN 0..p_schedule_weeks LOOP
        -- Check frequency rules
        IF v_freq = 'WEEKLY' THEN
            IF (v_week % v_interval) != 0 THEN CONTINUE; END IF;
        ELSIF v_freq = '2WEEKLY' THEN
            IF (v_week % 2) != 0 THEN CONTINUE; END IF;
        ELSIF v_freq = 'MONTHLY' THEN
            IF (v_week % 4) != 0 THEN CONTINUE; END IF;
        END IF;

        -- Calculate occurrence date
        v_occurrence := v_first_occurrence + (v_week * 7);

        -- Create the new entry (only the 5 actual columns)
        v_new_start := v_occurrence + (v_start_hour || ' hours')::INTERVAL + (v_start_minute || ' minutes')::INTERVAL;
        v_new_end := v_occurrence + (v_end_hour || ' hours')::INTERVAL + (v_end_minute || ' minutes')::INTERVAL;

        INSERT INTO schedule_entries (
            id,
            schedule_id,
            student_name,
            start_time,
            end_time,
            recurrence_rule
        ) VALUES (
            gen_random_uuid(),
            v_entry.schedule_id,
            v_entry.student_name,
            v_new_start,
            v_new_end,
            '' -- No recurrence rule - standalone entry
        );

        v_created_count := v_created_count + 1;
    END LOOP;

    -- Delete the original recurring entry
    DELETE FROM schedule_entries WHERE id = p_entry_id;

    RETURN v_created_count;
END;
$$ LANGUAGE plpgsql;

-- Migration: Run the expansion for all recurring entries
DO $$
DECLARE
    v_entry RECORD;
    v_schedule_start DATE;
    v_schedule_end DATE;
    v_total_weeks INTEGER;
    v_count INTEGER;
BEGIN
    -- Loop through all entries with recurrence rules
    FOR v_entry IN
        SELECT id, schedule_id, start_time, recurrence_rule
        FROM schedule_entries
        WHERE recurrence_rule IS NOT NULL AND recurrence_rule != ''
        ORDER BY schedule_id, start_time
    LOOP
        -- Get the schedule dates
        SELECT start_date, end_date INTO v_schedule_start, v_schedule_end
        FROM schedules
        WHERE id = v_entry.schedule_id;

        -- Calculate total weeks (use 13 weeks / ~3 months as default if schedule is very long)
        v_total_weeks := LEAST(13, (v_schedule_end - v_schedule_start)::INTEGER / 7);

        -- Expand the entry
        SELECT expand_recurring_entry(v_entry.id, v_schedule_start, v_total_weeks)
        INTO v_count;

        RAISE NOTICE 'Expanded entry %, created % new entries', v_entry.id, v_count;
    END LOOP;
END $$;

-- Clean up the function
DROP FUNCTION IF EXISTS expand_recurring_entry(UUID, DATE, INTEGER);
