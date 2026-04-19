import { Injectable, LoggerService } from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';
import { ChatGoogleParams } from '@langchain/google';
import { GeminiService } from 'src/common/llm/gemini.service';

type StructuredGenerationOptions<TResult> = {
  input: Record<string, string>;
  prompt: PromptTemplate;
  fallbackPrompt: PromptTemplate;
  outputSchema: object;
  schemaName: string;
  operationLabel: string;
  skipJsonSchema?: boolean;
  skipFunctionCalling?: boolean;
  modelOptions?: Omit<Partial<ChatGoogleParams>, 'apiKey'> & { model?: string };
  coerce: (value: unknown) => TResult | null;
  parseRawResponse: (rawResponse: string) => TResult;
  logger?: LoggerService;
};

@Injectable()
export class RagStructuredGenerationService {
  constructor(private readonly geminiService: GeminiService) {}

  async generate<TResult>({
    input,
    prompt,
    fallbackPrompt,
    outputSchema,
    schemaName,
    operationLabel,
    skipJsonSchema,
    skipFunctionCalling,
    modelOptions,
    coerce,
    parseRawResponse,
    logger,
  }: StructuredGenerationOptions<TResult>): Promise<TResult> {
    const baseModel = this.geminiService.createChatModel(modelOptions);

    if (!skipJsonSchema) {
      try {
        const structuredPayload = coerce(
          await prompt
            .pipe(
              baseModel.withStructuredOutput(outputSchema, {
                method: 'jsonSchema',
              }),
            )
            .invoke(input),
        );

        if (structuredPayload) {
          return structuredPayload;
        }

        logger?.warn(
          `${operationLabel} with JSON schema returned an empty structured payload. Falling back to function calling.`,
        );
      } catch (jsonSchemaError) {
        logger?.warn(
          `${operationLabel} fell back to function calling: ${this.toErrorMessage(
            jsonSchemaError,
          )}`,
        );
      }
    }

    if (!skipFunctionCalling) {
      try {
        const structuredPayload = coerce(
          await prompt
            .pipe(
              baseModel.withStructuredOutput(outputSchema, {
                method: 'functionCalling',
                name: schemaName,
              }),
            )
            .invoke(input),
        );

        if (structuredPayload) {
          return structuredPayload;
        }

        logger?.warn(
          `${operationLabel} with function calling returned an empty structured payload. Falling back to raw Gemini JSON mode.`,
        );
      } catch (functionCallingError) {
        logger?.warn(
          `${operationLabel} fell back to raw Gemini JSON mode: ${this.toErrorMessage(
            functionCallingError,
          )}`,
        );
      }
    }

    const rawPrompt = await fallbackPrompt.format(input);
    const rawResponse = await this.geminiService.generateText(rawPrompt);
    return parseRawResponse(rawResponse);
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
