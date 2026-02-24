// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
    const url = new URL(req.url);
    const entryId = url.searchParams.get("id");

    if (!entryId) {
        return new Response("Missing entry ID", { status: 400 });
    }

    try {
        const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

        // 1. Fetch Entry
        const { data: entry, error } = await supabase
            .from("schedule_entries")
            .select("*, schedules(label)")
            .eq("id", entryId)
            .single();

        if (error || !entry) {
            return new Response("Entry not found", { status: 404 });
        }

        // 2. Format Dates
        const pad = (n: number) => n.toString().padStart(2, '0');
        const formatICalDate = (date: Date) =>
            `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00Z`;

        const startDate = new Date(entry.start_time);
        const endDate = new Date(entry.end_time);
        const stamp = formatICalDate(new Date());
        const dtStart = formatICalDate(startDate);
        const dtEnd = formatICalDate(endDate);

        // 3. Assemble ICS
        const icsLines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Aria Scheduling//EN",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            "BEGIN:VEVENT",
            `UID:${entry.id}@aria.app`,
            `DTSTAMP:${stamp}`,
            `DTSTART:${dtStart}`,
            `DTEND:${dtEnd}`,
            `SUMMARY:${entry.student_name} - ${entry.schedules.label}`,
        ];

        if (entry.recurrence_rule) {
            icsLines.push(`RRULE:${entry.recurrence_rule}`);
        }

        icsLines.push("END:VEVENT");
        icsLines.push("END:VCALENDAR");

        return new Response(icsLines.join("\r\n"), {
            headers: {
                "Content-Type": "text/calendar",
                "Content-Disposition": `attachment; filename="event_${entryId}.ics"`,
            },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});
