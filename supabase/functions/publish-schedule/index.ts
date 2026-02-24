import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { createSignedLinkToken } from "../_shared/linkTokens.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const EDGE_LINK_SIGNING_SECRET = Deno.env.get("EDGE_LINK_SIGNING_SECRET");

type PublishRequestBody = {
    schedule_id?: string;
    scheduleId?: string;
};

type EntryRow = {
    id: string;
    student_name: string;
    start_time: string;
    form_responses?: {
        email?: string;
        student_name?: string;
    } | null;
};

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

serve(async (req) => {
    try {
        if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY || !EDGE_LINK_SIGNING_SECRET) {
            return json({ error: "Missing required environment variables." }, 500);
        }

        const userId = await getAuthenticatedUserId(req, SUPABASE_URL, SUPABASE_ANON_KEY);
        if (!userId) {
            return json({ error: "Unauthorized" }, 401);
        }

        const body = (await req.json()) as PublishRequestBody;
        const scheduleId = body.schedule_id ?? body.scheduleId;
        if (!scheduleId) {
            return json({ error: "Missing schedule_id" }, 400);
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 1. Fetch Schedule
        const { data: schedule, error: schedError } = await supabase
            .from("schedules")
            .select("*")
            .eq("id", scheduleId)
            .eq("user_id", userId)
            .single();

        if (schedError || !schedule) throw new Error("Schedule not found");

        // 2. Fetch Entries join with Participants
        const { data: entries, error: entriesError } = await supabase
            .from("schedule_entries")
            .select(`
        id,
        student_name,
        start_time,
        form_responses(email, student_name)
      `)
            .eq("schedule_id", scheduleId);

        if (entriesError) throw new Error("Failed to fetch entries: " + entriesError.message);

        // 3. Update status to 'published'
        const { error: updateError } = await supabase
            .from("schedules")
            .update({ status: "published" })
            .eq("id", scheduleId)
            .eq("user_id", userId);

        if (updateError) throw new Error("Failed to update status: " + updateError.message);

        // 4. BLAST EMAILS via Resend
        // We group by participant email to avoid sending multiple emails to the same person if they have multiple slots
        const participantMap = new Map<string, EntryRow[]>();
        (entries ?? []).forEach((entry: EntryRow) => {
            const email = entry.form_responses?.email;
            if (email) {
                if (!participantMap.has(email)) {
                    participantMap.set(email, []);
                }
                participantMap.get(email).push(entry);
            }
        });

        const emailResults = [];
        const ORIGIN = req.headers.get("origin") || "https://aria-scheduling.vercel.app"; // Fallback URL

        for (const [email, pEntries] of participantMap.entries()) {
            const studentName = pEntries[0].form_responses?.student_name || "Participant";

            // Generate list of slots with actual action links
            const entryItemsHtml = await Promise.all(pEntries.map(async (e) => {
                const occurrenceDate = e.start_time.split('T')[0];
                const tokenExpiry = Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30); // 30 days
                const icsToken = await createSignedLinkToken(
                    { kind: "ics", entryId: e.id, exp: tokenExpiry },
                    EDGE_LINK_SIGNING_SECRET
                );
                const cancelToken = await createSignedLinkToken(
                    { kind: "cancel", entryId: e.id, occurrenceDate, exp: tokenExpiry },
                    EDGE_LINK_SIGNING_SECRET
                );

                const icsUrl = `${SUPABASE_URL}/functions/v1/get-ics?id=${encodeURIComponent(e.id)}&token=${encodeURIComponent(icsToken)}`;
                const cancelUrl = `${ORIGIN}/cancel/${encodeURIComponent(e.id)}?date=${encodeURIComponent(occurrenceDate)}&token=${encodeURIComponent(cancelToken)}`;
                const safeStudentName = escapeHtml(e.student_name);

                return `
                    <div style="margin-bottom: 12px; padding: 10px; border: 1px solid #eee; border-radius: 6px;">
                        <strong>${safeStudentName}</strong><br/>
                        ${new Date(e.start_time).toLocaleDateString()} @ ${new Date(e.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}<br/>
                        <a href="${icsUrl}" style="color: #2563eb; text-decoration: none; font-size: 13px;">Add to Calendar</a> | 
                        <a href="${cancelUrl}" style="color: #dc2626; text-decoration: none; font-size: 13px;">Cancel session</a>
                    </div>
                `;
            }));
            const entryItemsHtmlJoined = entryItemsHtml.join("");

            const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${RESEND_API_KEY}`,
                },
                body: JSON.stringify({
                    from: "Aria <onboarding@resend.dev>", // Replace with verified domain in production
                    to: email,
                    subject: `Confirmed: Your schedule for ${schedule.label}`,
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2>Schedule Finalized</h2>
                            <p>Hi ${escapeHtml(studentName)},</p>
                            <p>Your host has finalized the schedule for <strong>${escapeHtml(schedule.label)}</strong>. Below are your assigned slots:</p>
                            ${entryItemsHtmlJoined}
                            <p style="font-size: 12px; color: #666; margin-top: 20px;">
                                This is an automated notification from Aria. Please contact your host directly for questions.
                            </p>
                        </div>
                    `,
                }),
            });

            const result = await res.json();
            emailResults.push({ email, result });
        }

        return new Response(JSON.stringify({
            success: true,
            message: `Schedule published. ${participantMap.size} participants notified.`,
            notification_count: participantMap.size
        }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (err: unknown) {
        return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }
});
