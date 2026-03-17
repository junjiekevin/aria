export type AssistantIntentBucket = 'calendar_action' | 'config_action' | 'general_chat';

export interface AssistantCommandEnvelope {
  bucket: AssistantIntentBucket;
  action: string;
  args: Record<string, unknown>;
}
