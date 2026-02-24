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
    v_total_abs_weeks INTEGER;
    v_occurrence DATE;
BEGIN
    -- Get the entry details
    SELECT * INTO v_entry FROM schedule_entries WHERE id = p_entry_id;
    IF NOT FOUND OR v_entry.start_time IS NULL THEN
        RETURN 0;
    END IF;

    v_start_time := v_entry.start_time;
    v_end_time := v_entry.end_time;
    v_entry_day := EXTRACT(DOW FROM v_start_time)::INTEGER;
    v_rule := v_entry.recurrence_rule;

    RAISE NOTICE 'Expanding entry % (%) starting at %', p_entry_id, v_entry.student_name, v_start_time;

    -- Parse the frequency and interval from the rule
    v_freq := COALESCE(
        (SELECT UPPER(m[1]) FROM regexp_matches(v_rule, 'FREQ=(\w+)') AS m),
        'WEEKLY'
    );
    v_interval := COALESCE(
        (SELECT m[1]::INTEGER FROM regexp_matches(v_rule, 'INTERVAL=(\d+)') AS m),
        1
    );

    -- Find the first occurrence of this day after schedule start
    v_days_to_first := v_entry_day - EXTRACT(DOW FROM p_schedule_start)::INTEGER;
    IF v_days_to_first < 0 THEN v_days_to_first := v_days_to_first + 7; END IF;
    v_first_occurrence := p_schedule_start + v_days_to_first;

    -- Generate entries for each week
    FOR v_week IN 0..p_schedule_weeks LOOP
        -- Calculate current occurrence date
        v_occurrence := v_first_occurrence + (v_week * 7);
        
        -- Calculate ABSOLUTE week offset from the original entry to preserve parity
        -- This ensures that biweekly/monthly logic is anchored to the original series
        v_total_abs_weeks := (v_occurrence - v_start_time::DATE) / 7;

        -- Check frequency rules against the absolute week offset
        -- Normalize interval for non-standard freq strings
        IF v_freq = '2WEEKLY' AND v_interval = 1 THEN v_interval := 2; v_freq := 'WEEKLY'; END IF;
        IF v_freq = 'MONTHLY' AND v_interval = 1 THEN v_interval := 4; v_freq := 'WEEKLY'; END IF;
        
        IF (v_total_abs_weeks % v_interval) != 0 THEN 
            CONTINUE; 
        END IF;

        -- Calculate start/end times preserving duration and timezone
        v_new_start := v_start_time + ((v_occurrence - v_start_time::DATE)) * INTERVAL '1 day';
        v_new_end := v_new_start + (v_end_time - v_start_time);

        RAISE NOTICE '  - Week % (Abs %): Creating entry for %', v_week, v_total_abs_weeks, v_new_start;

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

        -- Fallback: If schedule has no dates, use the entry's own start_time
        v_schedule_start := COALESCE(v_schedule_start, v_entry.start_time::DATE);
        v_schedule_end := COALESCE(v_schedule_end, v_schedule_start + INTERVAL '3 months');

        -- Calculate total weeks: default to 13 weeks (~3 months) if end date is missing
        v_total_weeks := COALESCE(
            CASE 
                WHEN v_schedule_end > v_schedule_start THEN (v_schedule_end - v_schedule_start)::INTEGER / 7
                ELSE 12 
            END, 
            12
        );
        v_total_weeks := LEAST(13, GREATEST(1, v_total_weeks)); -- Clamp between 1 and 13 weeks

        -- Expand the entry
        SELECT expand_recurring_entry(v_entry.id, v_schedule_start, v_total_weeks)
        INTO v_count;

        RAISE NOTICE 'Expanded entry %, created % new entries', v_entry.id, v_count;
    END LOOP;
END $$;

-- Clean up the function
DROP FUNCTION IF EXISTS expand_recurring_entry(UUID, DATE, INTEGER);
