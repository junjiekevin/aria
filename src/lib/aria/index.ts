// src/lib/aria/index.ts
// Aria AI Module - Function Registry and Prompt Builder
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
  buildSystemPrompt,
  buildToolBlock,
  getSystemPrompt,
  getMinimalPrompt,
  isSimpleQuery,
  type PromptContext,
} from './promptBuilder';
