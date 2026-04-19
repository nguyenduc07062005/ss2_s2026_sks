import { ConfigService } from '@nestjs/config';
import { ChatGoogle } from '@langchain/google';
import { GeminiService } from './gemini.service';

const mockGenerateContent = jest.fn();
const mockEmbedContent = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent,
      embedContent: mockEmbedContent,
    },
  })),
}));

jest.mock('@langchain/google', () => ({
  ChatGoogle: jest.fn().mockImplementation((params) => ({
    params,
  })),
}));

describe('GeminiService', () => {
  let configService: Pick<ConfigService, 'get'>;
  let service: GeminiService;
  const mockChatGoogle = ChatGoogle as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          GEMINI_API_KEY: 'test-key',
          GEMINI_TEXT_MODEL: 'gemini-2.5-flash',
          GEMINI_TEXT_MODEL_FALLBACKS:
            'gemini-3-flash,gemini-3.1-flash-lite',
          GEMINI_EMBEDDING_MODEL: 'gemini-embedding-001',
        };

        return values[key];
      }),
    };
    service = new GeminiService(configService as ConfigService);
  });

  it('fails over to the next text model when the primary model is quota-limited', async () => {
    mockGenerateContent
      .mockRejectedValueOnce(
        new Error(
          'got status: 429 Too Many Requests. RESOURCE_EXHAUSTED. Please retry in 45s.',
        ),
      )
      .mockResolvedValueOnce({ text: 'Recovered response' });

    await expect(service.generateText('Explain this document')).resolves.toBe(
      'Recovered response',
    );
    expect(mockGenerateContent).toHaveBeenNthCalledWith(1, {
      model: 'gemini-2.5-flash',
      contents: 'Explain this document',
    });
    expect(mockGenerateContent).toHaveBeenNthCalledWith(2, {
      model: 'gemini-3-flash',
      contents: 'Explain this document',
    });
  });

  it('prefers an available fallback model for new chat models after a retryable failure', async () => {
    mockGenerateContent
      .mockRejectedValueOnce(
        new Error('got status: 429 Too Many Requests. quota exceeded.'),
      )
      .mockResolvedValueOnce({ text: 'Recovered response' });

    await service.generateText('Retry with fallback');
    service.createChatModel({ temperature: 0.2 });

    expect(mockChatGoogle).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-3-flash',
        apiKey: 'test-key',
        temperature: 0.2,
      }),
    );
  });

  it('does not hide non-retryable errors behind fallback logic', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('400 Bad Request'));

    await expect(service.generateText('bad prompt')).rejects.toThrow(
      '400 Bad Request',
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });
});
