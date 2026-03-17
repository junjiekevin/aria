import type { AssistantCommandEnvelope } from '@aria/domain';

export interface AssistantCommandDispatcher {
  dispatch(envelope: AssistantCommandEnvelope): Promise<{ success: boolean; data?: unknown; error?: string }>;
}
