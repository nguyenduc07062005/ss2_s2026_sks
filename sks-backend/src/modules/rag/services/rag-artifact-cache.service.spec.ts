import { RagArtifactCacheService } from './rag-artifact-cache.service';

describe('RagArtifactCacheService', () => {
  type UpdatePayload = Record<string, unknown>;
  type UpdateMock = jest.Mock<Promise<void>, [string, UpdatePayload]>;

  const documentRepository = {
    getRepository: jest.fn(() => ({
      update: jest.fn<Promise<void>, [string, Record<string, unknown>]>(),
    })),
  };
  const userDocumentRepository = {
    getRepository: jest.fn(() => ({
      update: jest.fn<Promise<void>, [string, Record<string, unknown>]>(),
    })),
  };

  let service: RagArtifactCacheService;
  let updateUserDocument: UpdateMock;

  beforeEach(() => {
    jest.clearAllMocks();
    updateUserDocument = jest.fn((id: string, payload: UpdatePayload) => {
      void id;
      void payload;
      return Promise.resolve(undefined);
    });
    userDocumentRepository.getRepository.mockReturnValue({
      update: updateUserDocument,
    });
    documentRepository.getRepository.mockReturnValue({
      update: jest.fn((id: string, payload: UpdatePayload) => {
        void id;
        void payload;
        return Promise.resolve(undefined);
      }),
    });
    service = new RagArtifactCacheService(
      documentRepository as never,
      userDocumentRepository as never,
    );
  });

  it('merges user-level and fallback document-level summary versions', () => {
    const fallbackDocument = {
      extraAttributes: {
        aiArtifacts: {
          summaryByLanguage: {
            vi: {
              title: 'Default summary',
              overview: 'Default overview.',
              key_points: ['Default point'],
              conclusion: 'Default conclusion.',
              language: 'vi',
              generatedAt: '2026-04-18T00:00:00.000Z',
              sources: [],
              slot: 'default',
            },
          },
        },
      },
    };
    const userDocument = {
      id: 'user-doc-1',
      extraAttributes: {
        aiArtifacts: {
          summaryByLanguage: {
            vi: {
              activeSlot: 'custom',
              versions: {
                custom: {
                  title: 'Custom summary',
                  overview: 'Custom overview.',
                  key_points: ['Custom point'],
                  conclusion: 'Custom conclusion.',
                  language: 'vi',
                  generatedAt: '2026-04-18T01:00:00.000Z',
                  sources: [],
                  slot: 'custom',
                  instruction: 'Use one paragraph.',
                  format: 'narrative',
                  body: 'Custom summary body.',
                },
              },
            },
          },
        },
      },
    };

    const summaryState = service.getSummaryState(
      userDocument as never,
      'vi',
      fallbackDocument as never,
    );

    expect(summaryState?.activeSlot).toBe('custom');
    expect(summaryState?.versions?.default).toEqual(
      expect.objectContaining({
        slot: 'default',
        title: 'Default summary',
        format: 'structured',
        body: null,
      }),
    );
    expect(summaryState?.versions?.custom).toEqual(
      expect.objectContaining({
        slot: 'custom',
        title: 'Custom summary',
        format: 'narrative',
        body: 'Custom summary body.',
      }),
    );
  });

  it('persists a custom summary without dropping the fallback default version', async () => {
    const fallbackDocument = {
      extraAttributes: {
        aiArtifacts: {
          summaryByLanguage: {
            vi: {
              title: 'Default summary',
              overview: 'Default overview.',
              key_points: ['Default point'],
              conclusion: 'Default conclusion.',
              language: 'vi',
              generatedAt: '2026-04-18T00:00:00.000Z',
              sources: [],
              slot: 'default',
            },
          },
        },
      },
    };
    const userDocument = {
      id: 'user-doc-1',
      extraAttributes: {},
    };

    await service.saveSummary(
      userDocument as never,
      {
        title: 'Custom summary',
        overview: 'Custom overview.',
        key_points: ['Custom point'],
        conclusion: 'Custom conclusion.',
        language: 'vi',
        generatedAt: '2026-04-18T01:00:00.000Z',
        sources: [],
        slot: 'custom',
        instruction: 'Use one paragraph.',
        format: 'narrative',
        body: 'Custom summary body.',
      },
      fallbackDocument as never,
    );

    expect(updateUserDocument).toHaveBeenCalledTimes(1);
    expect(updateUserDocument.mock.calls[0]?.[0]).toBe('user-doc-1');

    const persistedPatch = updateUserDocument.mock.calls[0]?.[1];
    const extraAttributes = persistedPatch?.extraAttributes as
      | Record<string, unknown>
      | undefined;
    const aiArtifacts = extraAttributes?.aiArtifacts as
      | Record<string, unknown>
      | undefined;
    const summaryByLanguage = aiArtifacts?.summaryByLanguage as
      | Record<string, unknown>
      | undefined;
    const vietnameseSummary = summaryByLanguage?.vi as
      | Record<string, unknown>
      | undefined;
    const versions = vietnameseSummary?.versions as
      | Record<string, unknown>
      | undefined;
    const defaultVersion = versions?.default as
      | Record<string, unknown>
      | undefined;
    const customVersion = versions?.custom as
      | Record<string, unknown>
      | undefined;

    expect(vietnameseSummary?.activeSlot).toBe('custom');
    expect(defaultVersion?.slot).toBe('default');
    expect(defaultVersion?.title).toBe('Default summary');
    expect(customVersion?.slot).toBe('custom');
    expect(customVersion?.title).toBe('Custom summary');
    expect(customVersion?.body).toBe('Custom summary body.');
  });
});
