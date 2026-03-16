import type { AvailabilitySubmission } from './types';

export interface AvailabilitySubmissionRepository {
  create(input: Omit<AvailabilitySubmission, 'id' | 'createdAt'>): Promise<AvailabilitySubmission>;
  listByPublicLink(publicLinkId: string): Promise<AvailabilitySubmission[]>;
}
