import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiService } from './gemini.service';

const mockEmbedContent = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      embedContent: mockEmbedContent,
    },
  })),
}));

describe('GeminiService', () => {
  let configService: Pick<ConfigService, 'get'>;
  let service: GeminiService;

  beforeEach(() => {
    jest.clearAllMocks();
    configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          GEMINI_API_KEY: 'test-key',
          GEMINI_EMBEDDING_MODEL: 'gemini-embedding-001',
        };

        return values[key];
      }),
    };
    service = new GeminiService(configService as ConfigService);
  });

  it('creates embeddings with the configured Gemini embedding model', async () => {
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: [0.1, 0.2, 0.3] }],
    });

    await expect(service.createEmbedding('Document text')).resolves.toEqual([
      0.1, 0.2, 0.3,
    ]);
    expect(mockEmbedContent).toHaveBeenCalledWith({
      model: 'gemini-embedding-001',
      contents: 'Document text',
    });
  });

  it('rejects blank embedding input', async () => {
    await expect(service.createEmbedding('   ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(mockEmbedContent).not.toHaveBeenCalled();
  });

  it('maps retryable embedding failures to service unavailable', async () => {
    mockEmbedContent.mockRejectedValueOnce(
      new Error('429 Too Many Requests. RESOURCE_EXHAUSTED'),
    );

    await expect(
      service.createEmbedding('Document text'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
