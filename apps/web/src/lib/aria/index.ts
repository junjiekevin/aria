// src/lib/aria/index.ts
// Aria AI Module - Function Registry, Prompt Builder, and Intent Router
export {
  FUNCTION_REGISTRY,
  getFunctionsByCategory,
  getFunctionByName,
  getAllFunctionNames,
  getFunctionsProvidingId,
  type FunctionMeta,
  type FunctionCategory,
  type RequiredId,
} from './functionRegistry';
export {
  buildActionPrompt,
  buildAdvisoryPrompt,
  buildAdvisoryToolBlock,
  buildSystemPrompt,
  buildToolBlock,
  getSystemPrompt,
  getMinimalPrompt,
  isSimpleQuery,
  ADVISORY_TOOL_NAMES,
  type PromptContext,
} from './promptBuilder';
export {
  classifyMode,
  type AriaMode,
  type ModeClassification,
} from './intentRouter';
export {
  suggestSlots,
  formatSuggestionsForLlm,
  type SlotSuggestion,
  type SlotSuggestionResult,
  type ScheduledEvent,
  type UnassignedParticipant,
} from './slotSuggester';
