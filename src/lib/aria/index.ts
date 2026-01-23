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
  getSystemPrompt,
  getMinimalPrompt,
  detectRelevantFunctions,
  isSimpleQuery,
  type PromptContext,
} from './promptBuilder';
