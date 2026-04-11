import { RagSummaryService } from './rag-summary.service';

describe('RagSummaryService', () => {
  type OwnedDocument = {
    id: string;
    title: string;
  };
  type RepresentativeChunk = {
    chunkIndex: number;
    chunkText: string;
    pageNumber: number;
    sectionTitle: string;
  };
  type StructuredSummaryInternals = {
    generateStructuredSummary: (...args: unknown[]) => Promise<unknown>;
    normalizeSummary: (
      summary: unknown,
      documentTitle: string,
      language: 'en' | 'vi',
    ) => {
      title: string;
      overview: string;
      key_points: string[];
      conclusion: string;
    };
  };

  const geminiService = {};
  const ragIndexingService = {
    ensureDocumentIndexed: jest.fn<Promise<void>, [string]>(),
  };
  const ragDocumentContextService = {
    ensureOwnedDocument: jest.fn<Promise<OwnedDocument>, [string, string]>(),
    getRepresentativeChunks: jest.fn<
      Promise<RepresentativeChunk[]>,
      [string, number]
    >(),
    buildSummaryContext: jest.fn<string, [RepresentativeChunk[]]>(),
    buildSources: jest.fn<unknown[], [string, string, RepresentativeChunk[]]>(),
  };
  const ragArtifactCacheService = {
    getSummary: jest.fn<unknown, [OwnedDocument, 'en' | 'vi']>(),
    saveSummary: jest.fn<Promise<void>, [OwnedDocument, unknown]>(),
  };

  let service: RagSummaryService;

  beforeEach(() => {
    jest.clearAllMocks();
    ragIndexingService.ensureDocumentIndexed.mockResolvedValue(undefined);
    ragDocumentContextService.ensureOwnedDocument.mockResolvedValue({
      id: 'doc-0',
      title: 'Untitled',
    });
    ragDocumentContextService.getRepresentativeChunks.mockResolvedValue([]);
    ragDocumentContextService.buildSummaryContext.mockReturnValue('');
    ragDocumentContextService.buildSources.mockReturnValue([]);
    ragArtifactCacheService.getSummary.mockReturnValue(null);
    ragArtifactCacheService.saveSummary.mockResolvedValue(undefined);
    service = new RagSummaryService(
      geminiService as never,
      ragIndexingService as never,
      ragDocumentContextService as never,
      ragArtifactCacheService as never,
    );
  });

  it('reuses an existing cached summary even when it has no version', async () => {
    const document = {
      id: 'doc-1',
      title: 'Debugging Notes',
    };
    const cachedSummary = {
      title: 'Existing summary',
      overview: 'Stored overview.',
      key_points: ['Stored point'],
      conclusion: 'Stored conclusion.',
      language: 'en' as const,
      generatedAt: '2026-04-11T00:00:00.000Z',
      sources: [],
    };

    ragDocumentContextService.ensureOwnedDocument.mockResolvedValue(document);
    ragArtifactCacheService.getSummary.mockReturnValue(cachedSummary);

    const result = await service.generateSummary('doc-1', 'user-1', 'en');

    expect(result).toEqual({
      ...cachedSummary,
      cached: true,
    });
    expect(
      ragDocumentContextService.getRepresentativeChunks,
    ).not.toHaveBeenCalled();
    expect(ragArtifactCacheService.saveSummary).not.toHaveBeenCalled();
  });

  it('regenerates the summary when forceRefresh is true even if cache exists', async () => {
    const document = {
      id: 'doc-1',
      title: 'Debugging Notes',
    };
    const representativeChunks = [
      {
        chunkIndex: 0,
        chunkText: 'Relevant context',
        pageNumber: 1,
        sectionTitle: 'Introduction',
      },
    ];
    const cachedSummary = {
      title: 'Existing summary',
      overview: 'Stored overview.',
      key_points: ['Stored point'],
      conclusion: 'Stored conclusion.',
      language: 'en' as const,
      generatedAt: '2026-04-11T00:00:00.000Z',
      sources: [],
    };

    ragDocumentContextService.ensureOwnedDocument.mockResolvedValue(document);
    ragArtifactCacheService.getSummary.mockReturnValue(cachedSummary);
    ragDocumentContextService.getRepresentativeChunks.mockResolvedValue(
      representativeChunks,
    );
    ragDocumentContextService.buildSummaryContext.mockReturnValue(
      'Relevant context',
    );
    ragDocumentContextService.buildSources.mockReturnValue([]);

    jest
      .spyOn(
        service as unknown as StructuredSummaryInternals,
        'generateStructuredSummary',
      )
      .mockResolvedValue({
        title: 'Fresh summary',
        overview: 'Fresh overview.',
        key_points: ['Fresh point'],
        conclusion: 'Fresh conclusion.',
      });

    const result = await service.generateSummary(
      'doc-1',
      'user-1',
      'en',
      true,
    );

    expect(result.cached).toBe(false);
    expect(result.title).toBe('Fresh summary');
    expect(
      ragDocumentContextService.getRepresentativeChunks,
    ).toHaveBeenCalled();
    expect(ragArtifactCacheService.saveSummary).toHaveBeenCalled();
  });

  it('falls back to safe copy when structured summary generation returns no payload', async () => {
    const document = {
      id: 'doc-1',
      title: 'Debugging Notes',
    };
    const representativeChunks = [
      {
        chunkIndex: 0,
        chunkText: 'Relevant context',
        pageNumber: 1,
        sectionTitle: 'Introduction',
      },
    ];

    ragDocumentContextService.ensureOwnedDocument.mockResolvedValue(document);
    ragArtifactCacheService.getSummary.mockReturnValue(null);
    ragIndexingService.ensureDocumentIndexed.mockResolvedValue(undefined);
    ragDocumentContextService.getRepresentativeChunks.mockResolvedValue(
      representativeChunks,
    );
    ragDocumentContextService.buildSummaryContext.mockReturnValue(
      'Relevant context',
    );
    ragDocumentContextService.buildSources.mockReturnValue([]);
    ragArtifactCacheService.saveSummary.mockResolvedValue(undefined);

    jest
      .spyOn(
        service as unknown as StructuredSummaryInternals,
        'generateStructuredSummary',
      )
      .mockResolvedValue(undefined);

    const result = await service.generateSummary('doc-1', 'user-1', 'en');

    expect(result.cached).toBe(false);
    expect(result.title).toBe('Summary of Debugging Notes');
    expect(result.overview).toBe(
      'The available context was not sufficient to extract a complete overview of the document.',
    );
    expect(result.key_points).toEqual([
      'The extracted context was not sufficient to recover all important points reliably.',
    ]);
    expect(result.conclusion).toBe(
      'This summary reflects only the content that was successfully extracted.',
    );
    expect(ragArtifactCacheService.saveSummary).toHaveBeenCalledWith(
      document,
      expect.objectContaining({
        title: 'Summary of Debugging Notes',
      }),
    );
  });

  it('normalizes partial structured summaries without requiring key_points', () => {
    const normalized = (
      service as unknown as StructuredSummaryInternals
    ).normalizeSummary(
      {
        title: '  Existing title  ',
        overview: '',
        conclusion: '  Kept conclusion.  ',
      },
      'Debugging Notes',
      'en',
    );

    expect(normalized.title).toBe('Existing title');
    expect(normalized.overview).toBe(
      'The available context was not sufficient to extract a complete overview of the document.',
    );
    expect(normalized.key_points).toEqual([
      'The extracted context was not sufficient to recover all important points reliably.',
    ]);
    expect(normalized.conclusion).toBe('Kept conclusion.');
  });
});
