// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
    try {
        const { schedule_id } = await req.json();

        const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

        // 1. Fetch Schedule
        const { data: schedule, error: schedError } = await supabase
            .from("schedules")
            .select("*")
            .eq("id", schedule_id)
            .single();

        if (schedError || !schedule) throw new Error("Schedule not found");

        // 2. Fetch Entries join with Participants
        const { data: entries, error: entriesError } = await supabase
            .from("schedule_entries")
            .select(`
        *,
        form_responses(email, student_name)
      `)
            .eq("schedule_id", schedule_id);

        if (entriesError) throw new Error("Failed to fetch entries: " + entriesError.message);

        // 3. Update status to 'published'
        const { error: updateError } = await supabase
            .from("schedules")
            .update({ status: "published" })
            .eq("id", schedule_id);

        if (updateError) throw new Error("Failed to update status: " + updateError.message);

        // 4. BLAST EMAILS via Resend
        // We group by participant email to avoid sending multiple emails to the same person if they have multiple slots
        const participantMap = new Map();
        entries.forEach(entry => {
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
            const studentName = pEntries[0].form_responses.student_name;

            // Generate list of slots with actual action links
            const entryItemsHtml = pEntries.map(e => {
                const icsUrl = `${SUPABASE_URL}/functions/v1/get-ics?id=${e.id}`;
                const cancelUrl = `${ORIGIN}/cancel/${e.id}?date=${e.start_time.split('T')[0]}`;

                return `
                    <div style="margin-bottom: 12px; padding: 10px; border: 1px solid #eee; border-radius: 6px;">
                        <strong>${e.student_name}</strong><br/>
                        ${new Date(e.start_time).toLocaleDateString()} @ ${new Date(e.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}<br/>
                        <a href="${icsUrl}" style="color: #2563eb; text-decoration: none; font-size: 13px;">Add to Calendar</a> | 
                        <a href="${cancelUrl}" style="color: #dc2626; text-decoration: none; font-size: 13px;">Cancel session</a>
                    </div>
                `;
            }).join('');

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
                            <p>Hi ${studentName},</p>
                            <p>Your host has finalized the schedule for <strong>${schedule.label}</strong>. Below are your assigned slots:</p>
                            ${entryItemsHtml}
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
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }
});
