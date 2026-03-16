import type { AvailabilitySubmission, AvailabilitySubmissionRepository } from '../../domain/availability-intake';

export interface SubmitAvailabilityCommand {
  publicLinkId: string;
  participantName: string;
  participantEmail: string;
  choices: Array<{ startAt: string; endAt: string }>;
  notes?: string;
}

export async function submitAvailability(
  repository: AvailabilitySubmissionRepository,
  command: SubmitAvailabilityCommand,
): Promise<AvailabilitySubmission> {
  return repository.create({
    publicLinkId: command.publicLinkId,
    participantName: command.participantName,
    participantEmail: command.participantEmail,
    choices: command.choices,
    notes: command.notes ?? null,
  });
}
