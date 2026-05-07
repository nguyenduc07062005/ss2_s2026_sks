import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  GenerateTextOptions,
  LlmGenerationService,
} from './llm-generation.types';

const DEFAULT_MIMO_BASE_URL = 'https://api.xiaomimimo.com/v1';
const DEFAULT_MIMO_MODEL = 'mimo-v2.5-pro';
const DEFAULT_MIMO_SYSTEM_PROMPT =
  'You are an academic AI assistant inside SKS Smart Knowledge System.';

type MimoChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

@Injectable()
export class MimoGenerationService implements LlmGenerationService {
  private readonly logger = new Logger(MimoGenerationService.name);
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly systemPrompt: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.getConfigValue('MIMO_API_KEY');
    this.baseUrl = this.normalizeBaseUrl(
      this.getConfigValue('MIMO_BASE_URL') ?? DEFAULT_MIMO_BASE_URL,
    );
    this.model = this.getConfigValue('MIMO_MODEL') ?? DEFAULT_MIMO_MODEL;
    this.systemPrompt =
      this.getConfigValue('MIMO_SYSTEM_PROMPT') ?? DEFAULT_MIMO_SYSTEM_PROMPT;
  }

  supportsStructuredOutput(): boolean {
    return false;
  }

  async generateText(
    prompt: string,
    options: GenerateTextOptions = {},
  ): Promise<string> {
    const normalizedPrompt = prompt?.trim();

    if (!normalizedPrompt) {
      throw new BadRequestException('Prompt must not be empty');
    }

    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'MIMO_API_KEY is not configured. Add it to the backend environment before using LLM generation.',
      );
    }

    const response = await fetch(this.buildChatCompletionsUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.buildRequestBody(normalizedPrompt, options)),
    });

    const payload = (await response
      .json()
      .catch(() => null)) as MimoChatResponse | null;

    if (!response.ok) {
      const message =
        payload?.error?.message ||
        `${response.status} ${response.statusText}`.trim();
      this.logger.warn(`MiMo generation failed: ${message}`);

      if (this.isAuthenticationStatus(response.status, message)) {
        throw new ServiceUnavailableException(
          'MiMo LLM authentication failed. Please verify MIMO_API_KEY in the backend environment and restart the server.',
        );
      }

      if (this.isRetryableStatus(response.status)) {
        throw new ServiceUnavailableException(
          'MiMo LLM service is temporarily unavailable or quota limit has been reached. Please wait a bit and try again.',
        );
      }

      throw new Error(message);
    }

    const text = payload?.choices?.[0]?.message?.content?.trim();

    if (!text) {
      throw new Error('MiMo returned an empty response.');
    }

    return text;
  }

  private buildChatCompletionsUrl(): string {
    return `${this.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  }

  private getConfigValue(key: string): string | undefined {
    const value = this.configService.get<string>(key)?.trim();
    return value || undefined;
  }

  private normalizeBaseUrl(value: string): string {
    return value;
  }

  private buildRequestBody(prompt: string, options: GenerateTextOptions) {
    return {
      model: options.model ?? this.model,
      messages: [
        {
          role: 'system',
          content: this.systemPrompt,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      ...(typeof options.maxOutputTokens === 'number'
        ? { max_completion_tokens: options.maxOutputTokens }
        : {}),
      ...(typeof options.temperature === 'number'
        ? { temperature: options.temperature }
        : {}),
      ...(typeof options.topP === 'number' ? { top_p: options.topP } : {}),
      ...(options.responseMimeType === 'application/json'
        ? { response_format: { type: 'json_object' } }
        : {}),
      stream: false,
    };
  }

  private isRetryableStatus(status: number): boolean {
    return status === 408 || status === 409 || status === 429 || status >= 500;
  }

  private isAuthenticationStatus(status: number, message: string): boolean {
    const normalizedMessage = message.toLowerCase();

    return (
      status === 401 ||
      status === 403 ||
      normalizedMessage.includes('invalid api key') ||
      normalizedMessage.includes('unauthorized')
    );
  }
}
