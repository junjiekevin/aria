export const retainedSupabaseEdgeFunctions = [
  'cancel-event',
  'get-ics',
  'openrouter-chat',
  'publish-schedule',
] as const;

export type RetainedSupabaseEdgeFunction = (typeof retainedSupabaseEdgeFunctions)[number];
