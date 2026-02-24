import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { verifySignedLinkToken } from "../_shared/linkTokens.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const EDGE_LINK_SIGNING_SECRET = Deno.env.get("EDGE_LINK_SIGNING_SECRET");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

type CancelRequestBody = {
    entry_id?: string;
    occurrence_date?: string;
    reason?: string;
    token?: string;
};

serve(async (req) => {
    try {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY || !EDGE_LINK_SIGNING_SECRET) {
            return new Response(JSON.stringify({ error: "Missing required environment variables." }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }

        const { entry_id, occurrence_date, reason, token } = (await req.json()) as CancelRequestBody;
        if (!entry_id) {
            return new Response(JSON.stringify({ error: "Missing entry_id" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 2. Fetch Entry and Schedule (for policy)
        const { data: entry, error: entryError } = await supabase
            .from("schedule_entries")
            .select(`
        *,
        schedules(cancellation_policy_hours, label, user_id)
      `)
            .eq("id", entry_id)
            .single();

        if (entryError || !entry) throw new Error("Session not found");

        const schedule = entry.schedules;
        const policyHours = schedule.cancellation_policy_hours;

        // 3. Authorization:
        // - Public link flow: valid signed token
        // - Internal/admin flow: authenticated schedule owner
        let isAuthorized = false;
        let effectiveOccurrenceDate = occurrence_date;

        if (token) {
            const payload = await verifySignedLinkToken(token, EDGE_LINK_SIGNING_SECRET);
            if (
                payload &&
                payload.kind === "cancel" &&
                payload.entryId === entry_id &&
                payload.occurrenceDate
            ) {
                if (!effectiveOccurrenceDate) {
                    effectiveOccurrenceDate = payload.occurrenceDate;
                }
                isAuthorized = effectiveOccurrenceDate === payload.occurrenceDate;
            }
        }

        if (!isAuthorized) {
            const userId = await getAuthenticatedUserId(req, SUPABASE_URL, SUPABASE_ANON_KEY);
            isAuthorized = !!userId && userId === schedule.user_id;
        }

        if (!isAuthorized) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        if (!effectiveOccurrenceDate) {
            throw new Error("Missing occurrence_date");
        }

        // 4. Verify Policy
        // Occurrence time is occurrence_date + entry start time
        const entryStartTime = new Date(entry.start_time);
        const occurrence = new Date(effectiveOccurrenceDate);
        occurrence.setHours(entryStartTime.getHours(), entryStartTime.getMinutes(), 0, 0);

        const now = new Date();
        const hoursUntil = (occurrence.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursUntil < policyHours) {
            throw new Error(`Cancellation period closed. Policy requires ${policyHours}h notice.`);
        }

        // 5. Perform Cancellation
        // If it's a one-off (no recurrence_rule), we delete the entry.
        // If it's recurring, we would normally add an exception, but for Phase 2 simplicty, 
        // we'll just delete the whole entry or mark it. 
        // In a real app we'd have a 'schedule_exceptions' table.

        const { error: deleteError } = await supabase
            .from("schedule_entries")
            .delete()
            .eq("id", entry_id);

        if (deleteError) throw new Error("Failed to delete entry");

        // 6. Notify Instructor
        const { data: userData } = await supabase.auth.admin.getUserById(schedule.user_id);
        const instructorEmail = userData?.user?.email;

        if (instructorEmail && RESEND_API_KEY) {
            await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${RESEND_API_KEY}`,
                },
                body: JSON.stringify({
                    from: "Aria <onboarding@resend.dev>",
                    to: instructorEmail,
                    subject: `Canceled: ${entry.student_name} - ${schedule.label}`,
                    html: `
                        <p>Hi,</p>
                        <p><strong>${entry.student_name}</strong> has canceled their session on <strong>${new Date(effectiveOccurrenceDate).toLocaleDateString()}</strong>.</p>
                        <p><strong>Reason:</strong> ${reason || "No reason provided."}</p>
                        <p>The slot has been removed from the schedule.</p>
                    `,
                }),
            });
        }

        return new Response(JSON.stringify({
            success: true,
            message: "Session canceled. Instructor notified."
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
