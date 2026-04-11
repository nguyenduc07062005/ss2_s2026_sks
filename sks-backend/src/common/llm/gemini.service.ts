import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { ChatGoogle, ChatGoogleParams } from '@langchain/google';

@Injectable()
export class GeminiService {
  private readonly generationModel: string;
  private readonly embeddingModel: string;
  private readonly ai: GoogleGenAI;
  private readonly apiKey?: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.generationModel =
      this.configService.get<string>('GEMINI_TEXT_MODEL') ?? 'gemini-2.5-flash';
    this.embeddingModel =
      this.configService.get<string>('GEMINI_EMBEDDING_MODEL') ??
      'gemini-embedding-001';
    this.apiKey = apiKey;
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateText(prompt: string): Promise<string> {
    const normalizedPrompt = prompt?.trim();

    if (!normalizedPrompt) {
      throw new BadRequestException('Prompt must not be empty');
    }

    const result = await this.ai.models.generateContent({
      model: this.generationModel,
      contents: normalizedPrompt,
    });

    if (!result.text) {
      throw new Error('Failed to generate text');
    }

    return result.text;
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
    return new ChatGoogle({
      model: params.model ?? this.generationModel,
      apiKey: this.apiKey,
      ...params,
    });
  }
}
