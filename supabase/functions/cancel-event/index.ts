import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
    try {
        const { entry_id, occurrence_date, reason } = await req.json();

        const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

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

        // 3. Verify Policy
        // Occurrence time is occurrence_date + entry start time
        const entryStartTime = new Date(entry.start_time);
        const occurrence = new Date(occurrence_date);
        occurrence.setHours(entryStartTime.getHours(), entryStartTime.getMinutes(), 0, 0);

        const now = new Date();
        const hoursUntil = (occurrence.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursUntil < policyHours) {
            throw new Error(`Cancellation period closed. Policy requires ${policyHours}h notice.`);
        }

        // 4. Perform Cancellation
        // If it's a one-off (no recurrence_rule), we delete the entry.
        // If it's recurring, we would normally add an exception, but for Phase 2 simplicty, 
        // we'll just delete the whole entry or mark it. 
        // In a real app we'd have a 'schedule_exceptions' table.

        const { error: deleteError } = await supabase
            .from("schedule_entries")
            .delete()
            .eq("id", entry_id);

        if (deleteError) throw new Error("Failed to delete entry");

        // 5. Notify Instructor
        const { data: userData } = await supabase.auth.admin.getUserById(schedule.user_id);
        const instructorEmail = userData?.user?.email;

        if (instructorEmail) {
            const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
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
                        <p><strong>${entry.student_name}</strong> has canceled their session on <strong>${new Date(occurrence_date).toLocaleDateString()}</strong>.</p>
                        <p><strong>Reason:</strong> ${reason}</p>
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
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }
});
