import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { verifySignedLinkToken } from "../_shared/linkTokens.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const EDGE_LINK_SIGNING_SECRET = Deno.env.get("EDGE_LINK_SIGNING_SECRET");

serve(async (req) => {
    const url = new URL(req.url);
    const entryId = url.searchParams.get("id");
    const token = url.searchParams.get("token");

    if (!entryId) {
        return new Response("Missing entry ID", { status: 400 });
    }

    try {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY || !EDGE_LINK_SIGNING_SECRET) {
            return new Response("Server misconfigured", { status: 500 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 1. Fetch Entry
        const { data: entry, error } = await supabase
            .from("schedule_entries")
            .select("*, schedules(label, user_id)")
            .eq("id", entryId)
            .single();

        if (error || !entry) {
            return new Response("Entry not found", { status: 404 });
        }

        // 2. Authorization:
        // - Public access must provide a valid signed token
        // - Otherwise caller must be authenticated owner of the schedule
        let authorized = false;
        if (token) {
            const payload = await verifySignedLinkToken(token, EDGE_LINK_SIGNING_SECRET);
            authorized = !!payload && payload.kind === "ics" && payload.entryId === entryId;
        } else {
            const userId = await getAuthenticatedUserId(req, SUPABASE_URL, SUPABASE_ANON_KEY);
            authorized = !!userId && userId === entry.schedules?.user_id;
        }

        if (!authorized) {
            return new Response("Unauthorized", { status: 401 });
        }

        // 3. Format Dates
        const pad = (n: number) => n.toString().padStart(2, '0');
        const formatICalDate = (date: Date) =>
            `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00Z`;

        const startDate = new Date(entry.start_time);
        const endDate = new Date(entry.end_time);
        const stamp = formatICalDate(new Date());
        const dtStart = formatICalDate(startDate);
        const dtEnd = formatICalDate(endDate);

        // 4. Assemble ICS
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
    } catch (err: unknown) {
        return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});
