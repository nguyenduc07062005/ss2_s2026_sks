import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';
import {
  LLM_GENERATION_SERVICE,
  type GenerateTextOptions,
  type LlmGenerationService,
} from 'src/common/llm/llm-generation.types';

type StructuredModelOptions = GenerateTextOptions;

type StructuredGenerationPolicy =
  | 'schema_first'
  | 'function_first'
  | 'raw_json_only';

type StructuredGenerationOptions<TResult> = {
  input: Record<string, string>;
  prompt: PromptTemplate;
  fallbackPrompt: PromptTemplate;
  outputSchema: object;
  schemaName: string;
  operationLabel: string;
  policy?: StructuredGenerationPolicy;
  modelOptions?: StructuredModelOptions;
  coerce: (value: unknown) => TResult | null;
  parseRawResponse: (rawResponse: string) => TResult;
  logger?: LoggerService;
};

type StructuredGenerationAttempt =
  | 'json_schema'
  | 'function_calling'
  | 'raw_json';

@Injectable()
export class RagStructuredGenerationService {
  constructor(
    @Inject(LLM_GENERATION_SERVICE)
    private readonly generationService: LlmGenerationService,
  ) {}

  async generate<TResult>(
    options: StructuredGenerationOptions<TResult>,
  ): Promise<TResult> {
    const attempts = this.resolveAttempts(options.policy ?? 'schema_first');

    for (const attempt of attempts) {
      if (attempt === 'json_schema') {
        options.logger?.warn(
          `${options.operationLabel} skipped JSON schema because the configured LLM generation provider does not expose structured output. Falling back to raw JSON.`,
        );

        continue;
      }

      if (attempt === 'function_calling') {
        options.logger?.warn(
          `${options.operationLabel} skipped function calling for schema "${options.schemaName}" because the configured LLM generation provider does not expose structured output. Falling back to raw JSON.`,
        );

        continue;
      }

      const rawPrompt = await options.fallbackPrompt.format(options.input);
      const rawResponse = await this.generationService.generateText(rawPrompt, {
        ...options.modelOptions,
        responseMimeType: 'application/json',
      });
      return options.parseRawResponse(rawResponse);
    }

    throw new Error(
      `${options.operationLabel} has no structured generation attempts.`,
    );
  }

  private resolveAttempts(
    policy: StructuredGenerationPolicy,
  ): StructuredGenerationAttempt[] {
    if (!this.generationService.supportsStructuredOutput?.()) {
      return ['raw_json'];
    }

    if (policy === 'raw_json_only') {
      return ['raw_json'];
    }

    if (policy === 'function_first') {
      return ['function_calling', 'json_schema', 'raw_json'];
    }

    return ['json_schema', 'function_calling', 'raw_json'];
  }
}
