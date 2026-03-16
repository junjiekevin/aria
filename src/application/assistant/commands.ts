import type { AssistantCommandEnvelope } from '../../domain/assistant';

export interface AssistantCommandDispatcher {
  dispatch(envelope: AssistantCommandEnvelope): Promise<{ success: boolean; data?: unknown; error?: string }>;
}
