export type GenerateTextOptions = {
  model?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  responseSchema?: object;
};

export type LlmGenerationService = {
  generateText(prompt: string, options?: GenerateTextOptions): Promise<string>;
  supportsStructuredOutput?(): boolean;
};

export const LLM_GENERATION_SERVICE = Symbol('LLM_GENERATION_SERVICE');
