import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-001';

@Injectable()
export class GeminiService {
  private readonly embeddingModel: string;
  private readonly ai: GoogleGenAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.embeddingModel =
      this.configService.get<string>('GEMINI_EMBEDDING_MODEL') ??
      DEFAULT_EMBEDDING_MODEL;
    this.ai = new GoogleGenAI({ apiKey });
  }

  async createEmbedding(text: string): Promise<number[]> {
    const normalizedText = text?.trim();

    if (!normalizedText) {
      throw new BadRequestException('Text must not be empty');
    }

    let response: Awaited<ReturnType<typeof this.ai.models.embedContent>>;

    try {
      response = await this.ai.models.embedContent({
        model: this.embeddingModel,
        contents: normalizedText,
      });
    } catch (error) {
      if (this.isRetryableEmbeddingError(error)) {
        throw new ServiceUnavailableException(
          'AI embedding service is temporarily unavailable or quota limit has been reached. Please wait a bit and try again.',
        );
      }

      throw error;
    }

    const values = response.embeddings?.[0]?.values;

    if (!values) {
      throw new Error('Embedding vector missing');
    }

    return values;
  }

  private isRetryableEmbeddingError(error: unknown): boolean {
    const errorMessage = this.toErrorMessage(error).toLowerCase();

    return [
      '429',
      'too many requests',
      'resource_exhausted',
      'quota exceeded',
      'rate limit',
      '503',
      'unavailable',
      'fetch failed',
      'failed sending request',
      'network',
      'timeout',
      'econnreset',
      'etimedout',
    ].some((token) => errorMessage.includes(token));
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
