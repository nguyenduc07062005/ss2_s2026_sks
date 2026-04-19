import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { ChatGoogle, ChatGoogleParams } from '@langchain/google';

const DEFAULT_TEXT_MODEL = 'gemini-2.5-flash';
const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-001';
const DEFAULT_FALLBACK_MODELS = [
  'gemini-3-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
] as const;
const TEMPORARY_MODEL_COOLDOWN_MS = 60_000;

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly generationModel: string;
  private readonly textModelCandidates: string[];
  private readonly embeddingModel: string;
  private readonly ai: GoogleGenAI;
  private readonly apiKey?: string;
  private readonly unavailableTextModels = new Map<string, number>();

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.generationModel =
      this.configService.get<string>('GEMINI_TEXT_MODEL') ??
      DEFAULT_TEXT_MODEL;
    this.textModelCandidates = this.buildTextModelCandidates();
    this.embeddingModel =
      this.configService.get<string>('GEMINI_EMBEDDING_MODEL') ??
      DEFAULT_EMBEDDING_MODEL;
    this.apiKey = apiKey;
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateText(
    prompt: string,
    options: { model?: string } = {},
  ): Promise<string> {
    const normalizedPrompt = prompt?.trim();

    if (!normalizedPrompt) {
      throw new BadRequestException('Prompt must not be empty');
    }

    let lastError: unknown;
    const candidateModels = this.getPreferredTextModelCandidates(options.model);

    for (const model of candidateModels) {
      try {
        const result = await this.ai.models.generateContent({
          model,
          contents: normalizedPrompt,
        });

        if (!result.text) {
          throw new Error(`Gemini model "${model}" returned an empty response.`);
        }

        this.clearModelCooldown(model);
        return result.text;
      } catch (error) {
        lastError = error;

        if (!this.isRetryableTextError(error)) {
          throw error;
        }

        this.markModelUnavailable(model, error);

        if (model !== candidateModels[candidateModels.length - 1]) {
          this.logger.warn(
            `Gemini text generation failed on model "${model}". Retrying with the next available model. ${this.toErrorMessage(
              error,
            )}`,
          );
        }
      }
    }

    throw lastError ?? new Error('Failed to generate text');
  }

  async createEmbedding(text: string): Promise<number[]> {
    const normalizedText = text?.trim();

    if (!normalizedText) {
      throw new BadRequestException('Text must not be empty');
    }

    const response = await this.ai.models.embedContent({
      model: this.embeddingModel,
      contents: normalizedText,
    });

    const values = response.embeddings?.[0]?.values;

    if (!values) {
      throw new Error('Embedding vector missing');
    }

    return values;
  }

  createChatModel(
    params: Omit<Partial<ChatGoogleParams>, 'apiKey'> & { model?: string } = {},
  ): ChatGoogle {
    const { model, ...rest } = params;

    return new ChatGoogle({
      ...rest,
      model: this.pickAvailableTextModel(model),
      apiKey: this.apiKey,
    });
  }

  private buildTextModelCandidates(): string[] {
    const configuredFallbacks = [
      ...this.parseTextModelList(
        this.configService.get<string>('GEMINI_TEXT_MODEL_FALLBACK'),
      ),
      ...this.parseTextModelList(
        this.configService.get<string>('GEMINI_TEXT_MODEL_FALLBACKS'),
      ),
    ];

    return this.dedupeTextModels([
      this.generationModel,
      ...configuredFallbacks,
      ...DEFAULT_FALLBACK_MODELS,
    ]);
  }

  private parseTextModelList(value: string | undefined): string[] {
    return (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private dedupeTextModels(models: readonly string[]): string[] {
    const seen = new Set<string>();

    return models.filter((model) => {
      const normalizedModel = model.trim();

      if (!normalizedModel || seen.has(normalizedModel)) {
        return false;
      }

      seen.add(normalizedModel);
      return true;
    });
  }

  private getPreferredTextModelCandidates(preferredModel?: string): string[] {
    const now = Date.now();
    const preferredCandidates = this.dedupeTextModels([
      ...(preferredModel ? [preferredModel] : []),
      ...this.textModelCandidates,
    ]);
    const availableCandidates = preferredCandidates.filter((model) => {
      const unavailableUntil = this.unavailableTextModels.get(model);

      if (!unavailableUntil) {
        return true;
      }

      if (unavailableUntil <= now) {
        this.unavailableTextModels.delete(model);
        return true;
      }

      return false;
    });

    return availableCandidates.length > 0
      ? availableCandidates
      : preferredCandidates;
  }

  private pickAvailableTextModel(preferredModel?: string): string {
    return this.getPreferredTextModelCandidates(preferredModel)[0];
  }

  private markModelUnavailable(model: string, error: unknown): void {
    this.unavailableTextModels.set(
      model,
      Date.now() + this.getRetryDelayMs(error),
    );
  }

  private clearModelCooldown(model: string): void {
    this.unavailableTextModels.delete(model);
  }

  private getRetryDelayMs(error: unknown): number {
    const errorMessage = this.toErrorMessage(error);
    const explicitDelaySeconds =
      errorMessage.match(/retry in\s+(\d+(?:\.\d+)?)s/i)?.[1] ??
      errorMessage.match(/retryDelay\":\"(\d+)s/i)?.[1];
    const retryDelayMs = explicitDelaySeconds
      ? Math.ceil(Number.parseFloat(explicitDelaySeconds) * 1000)
      : Number.NaN;

    return Number.isFinite(retryDelayMs) && retryDelayMs > 0
      ? retryDelayMs
      : TEMPORARY_MODEL_COOLDOWN_MS;
  }

  private isRetryableTextError(error: unknown): boolean {
    const errorMessage = this.toErrorMessage(error).toLowerCase();

    return [
      '429',
      'too many requests',
      'resource_exhausted',
      'quota exceeded',
      'rate limit',
      '503',
      'unavailable',
    ].some((token) => errorMessage.includes(token));
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
