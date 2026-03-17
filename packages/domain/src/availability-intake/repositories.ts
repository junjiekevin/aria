import type { AvailabilitySubmission } from './types.js';

export interface AvailabilitySubmissionRepository {
  create(input: Omit<AvailabilitySubmission, 'id' | 'createdAt'>): Promise<AvailabilitySubmission>;
  listByPublicLink(publicLinkId: string): Promise<AvailabilitySubmission[]>;
}
