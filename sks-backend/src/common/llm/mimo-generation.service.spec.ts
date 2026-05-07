import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MimoGenerationService } from './mimo-generation.service';

describe('MimoGenerationService', () => {
  const fetchMock = jest.fn();
  let configService: Pick<ConfigService, 'get'>;
  let service: MimoGenerationService;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as typeof fetch;
    configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          MIMO_API_KEY: 'mimo-test-key',
          MIMO_BASE_URL: 'https://api.xiaomimimo.com/v1',
          MIMO_MODEL: 'mimo-v2.5-pro',
        };

        return values[key];
      }),
    };
    service = new MimoGenerationService(configService as ConfigService);
  });

  it('calls the OpenAI-compatible MiMo chat completions API', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Generated answer' } }],
        }),
    });

    await expect(
      service.generateText('Explain the concept', {
        temperature: 0.4,
        topP: 0.9,
        maxOutputTokens: 512,
      }),
    ).resolves.toBe('Generated answer');

    const firstCall = fetchMock.mock.calls[0] as
      | [
          string,
          { method: string; headers: Record<string, string>; body: string },
        ]
      | undefined;

    expect(firstCall?.[0]).toBe(
      'https://api.xiaomimimo.com/v1/chat/completions',
    );
    expect(firstCall?.[1].method).toBe('POST');
    expect(firstCall?.[1].headers.Authorization).toBe('Bearer mimo-test-key');
    expect(firstCall?.[1].headers['api-key']).toBe('mimo-test-key');
    expect(firstCall?.[1].headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(firstCall?.[1].body ?? '{}') as Record<
      string,
      unknown
    >;

    expect(body).toEqual(
      expect.objectContaining({
        model: 'mimo-v2.5-pro',
        temperature: 0.4,
        top_p: 0.9,
        max_completion_tokens: 512,
        stream: false,
      }),
    );
  });

  it('requests JSON object mode when JSON output is needed', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: '{"ok":true}' } }],
        }),
    });

    await service.generateText('Return JSON', {
      responseMimeType: 'application/json',
    });

    const firstCall = fetchMock.mock.calls[0] as
      | [string, { body: string }]
      | undefined;
    const body = JSON.parse(firstCall?.[1].body ?? '{}') as Record<
      string,
      unknown
    >;

    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('fails clearly when the API key is missing', async () => {
    configService.get = jest.fn(() => undefined);
    service = new MimoGenerationService(configService as ConfigService);

    await expect(service.generateText('Hello')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps invalid API key responses to a sanitized service unavailable error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () =>
        Promise.resolve({
          error: { message: 'Invalid API Key' },
        }),
    });

    await expect(service.generateText('Hello')).rejects.toMatchObject({
      constructor: ServiceUnavailableException,
      message:
        'MiMo LLM authentication failed. Please verify MIMO_API_KEY in the backend environment and restart the server.',
    });
  });

  it('trims environment values before building the request', async () => {
    configService.get = jest.fn((key: string) => {
      const values: Record<string, string> = {
        MIMO_API_KEY: '  mimo-test-key  ',
        MIMO_BASE_URL: '  https://api.xiaomimimo.com/v1/  ',
        MIMO_MODEL: '  mimo-v2.5-pro  ',
      };

      return values[key];
    });
    service = new MimoGenerationService(configService as ConfigService);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Generated answer' } }],
        }),
    });

    await service.generateText('Explain the concept');

    const firstCall = fetchMock.mock.calls[0] as
      | [
          string,
          { method: string; headers: Record<string, string>; body: string },
        ]
      | undefined;
    const body = JSON.parse(firstCall?.[1].body ?? '{}') as Record<
      string,
      unknown
    >;

    expect(firstCall?.[0]).toBe(
      'https://api.xiaomimimo.com/v1/chat/completions',
    );
    expect(firstCall?.[1].headers.Authorization).toBe('Bearer mimo-test-key');
    expect(firstCall?.[1].headers['api-key']).toBe('mimo-test-key');
    expect(body.model).toBe('mimo-v2.5-pro');
  });

  it('preserves the configured token-plan base URL for token-plan API keys', async () => {
    configService.get = jest.fn((key: string) => {
      const values: Record<string, string> = {
        MIMO_API_KEY: 'mimo-test-key',
        MIMO_BASE_URL: 'https://token-plan-sgp.xiaomimimo.com/v1',
        MIMO_MODEL: 'mimo-v2.5-pro',
      };

      return values[key];
    });
    service = new MimoGenerationService(configService as ConfigService);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Generated answer' } }],
        }),
    });

    await service.generateText('Explain the concept');

    const firstCall = fetchMock.mock.calls[0] as
      | [string, { body: string }]
      | undefined;

    expect(firstCall?.[0]).toBe(
      'https://token-plan-sgp.xiaomimimo.com/v1/chat/completions',
    );
  });
});
