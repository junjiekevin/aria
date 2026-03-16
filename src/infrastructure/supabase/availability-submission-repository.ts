import type { AvailabilitySubmission, AvailabilitySubmissionRepository } from '../../domain/availability-intake';
import { supabase } from '../../lib/supabase';

type AvailabilitySubmissionRow = {
  id: string;
  public_link_id: string;
  participant_name: string;
  participant_email: string;
  choices: Array<{ startAt: string; endAt: string }>;
  notes: string | null;
  created_at: string;
};

function toDomain(row: AvailabilitySubmissionRow): AvailabilitySubmission {
  return {
    id: row.id,
    publicLinkId: row.public_link_id,
    participantName: row.participant_name,
    participantEmail: row.participant_email,
    choices: row.choices,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export class SupabaseAvailabilitySubmissionRepository implements AvailabilitySubmissionRepository {
  async create(input: Omit<AvailabilitySubmission, 'id' | 'createdAt'>): Promise<AvailabilitySubmission> {
    const { data, error } = await supabase
      .from('availability_submissions')
      .insert({
        public_link_id: input.publicLinkId,
        participant_name: input.participantName,
        participant_email: input.participantEmail,
        choices: input.choices,
        notes: input.notes,
      })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to create availability submission: ${error.message}`);
    return toDomain(data as AvailabilitySubmissionRow);
  }

  async listByPublicLink(publicLinkId: string): Promise<AvailabilitySubmission[]> {
    const { data, error } = await supabase
      .from('availability_submissions')
      .select('*')
      .eq('public_link_id', publicLinkId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to list availability submissions: ${error.message}`);
    return (data ?? []).map((row) => toDomain(row as AvailabilitySubmissionRow));
  }
}
