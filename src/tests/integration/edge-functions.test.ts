import { describe, it, expect } from 'vitest';
import { supabase } from '../../lib/supabase';

describe('Edge Functions Integration', () => {

    it('get-ics: should generate a valid ICS string for an existing entry', async () => {
        // 1. Find an existing entry to test with
        const { data: entry, error: fetchErr } = await supabase
            .from('schedule_entries')
            .select('id')
            .limit(1)
            .maybeSingle();

        if (fetchErr || !entry) {
            console.warn('Skipping get-ics test: No entries found in database.');
            return;
        }

        // 2. Invoke function
        const { data, error } = await supabase.functions.invoke(`get-ics?id=${entry.id}`, {
            method: 'GET'
        });

        // 3. Assertions
        expect(error).toBeNull();
        const icsString = await data.text();
        expect(icsString).toContain('BEGIN:VCALENDAR');
        expect(icsString).toContain('BEGIN:VEVENT');
        expect(icsString).toContain('VERSION:2.0');
    });

    it('publish-schedule: should fail with non-existent schedule', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        const { error } = await supabase.functions.invoke('publish-schedule', {
            body: { schedule_id: fakeId }
        });

        expect(error).not.toBeNull();
        // The function returns 400 with "Schedule not found"
    });

    it('cancel-event: should fail with non-existent entry', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        const { error } = await supabase.functions.invoke('cancel-event', {
            body: {
                entry_id: fakeId,
                occurrence_date: '2026-01-01',
                reason: 'Testing'
            }
        });

        expect(error).not.toBeNull();
    });
});
