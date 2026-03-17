export interface AvailabilitySubmission {
  id: string;
  publicLinkId: string;
  participantName: string;
  participantEmail: string;
  choices: Array<{ startAt: string; endAt: string }>;
  notes: string | null;
  createdAt: string;
}
