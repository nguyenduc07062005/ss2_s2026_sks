import { BadRequestException } from '@nestjs/common';
import { RagSummaryService } from './rag-summary.service';

describe('RagSummaryService', () => {
  type OwnedDocument = {
    id: string;
    title: string;
  };

  type OwnedUserDocument = {
    id: string;
    extraAttributes?: Record<string, unknown> | null;
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
    parseRawSummaryResponse: (rawResponse: string) => {
      title: string;
      overview: string;
      key_points: string[];
      conclusion: string;
      format?: string;
      body?: string | null;
    };
  };

  const userDocumentRepository = {
    findByUserAndDocument: jest.fn<
      Promise<OwnedUserDocument | null>,
      [string, string]
    >(),
  };
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
    getSummaryState: jest.fn<
      unknown,
      [OwnedUserDocument, 'en' | 'vi', OwnedDocument?]
    >(),
    saveSummary: jest.fn<
      Promise<void>,
      [OwnedUserDocument, unknown, OwnedDocument?]
    >(),
  };
  const ragStructuredGenerationService = {
    generate: jest.fn<Promise<unknown>, [unknown]>(),
  };

  let service: RagSummaryService;

  beforeEach(() => {
    jest.clearAllMocks();
    userDocumentRepository.findByUserAndDocument.mockResolvedValue({
      id: 'user-doc-1',
      extraAttributes: {},
    });
    ragIndexingService.ensureDocumentIndexed.mockResolvedValue(undefined);
    ragDocumentContextService.ensureOwnedDocument.mockResolvedValue({
      id: 'doc-0',
      title: 'Untitled',
    });
    ragDocumentContextService.getRepresentativeChunks.mockResolvedValue([]);
    ragDocumentContextService.buildSummaryContext.mockReturnValue('');
    ragDocumentContextService.buildSources.mockReturnValue([]);
    ragArtifactCacheService.getSummaryState.mockReturnValue(null);
    ragArtifactCacheService.saveSummary.mockResolvedValue(undefined);
    service = new RagSummaryService(
      ragIndexingService as never,
      ragDocumentContextService as never,
      ragArtifactCacheService as never,
      ragStructuredGenerationService as never,
      userDocumentRepository as never,
    );
  });

  it('reuses the active cached summary version without regenerating', async () => {
    const document = {
      id: 'doc-1',
      title: 'Debugging Notes',
    };
    const cachedSummaryState = {
      activeSlot: 'default' as const,
      versions: {
        default: {
          title: 'Existing summary',
          overview: 'Stored overview.',
          key_points: ['Stored point'],
          conclusion: 'Stored conclusion.',
          language: 'en' as const,
          generatedAt: '2026-04-11T00:00:00.000Z',
          sources: [],
          slot: 'default' as const,
          instruction: null,
        },
      },
    };

    ragDocumentContextService.ensureOwnedDocument.mockResolvedValue(document);
    ragArtifactCacheService.getSummaryState.mockReturnValue(cachedSummaryState);

    const result = await service.generateSummary('doc-1', 'user-1', 'en');

    expect(result).toEqual(
      expect.objectContaining({
        title: 'Existing summary',
        slot: 'default',
        activeSlot: 'default',
        cached: true,
      }),
    );
    expect(result.versions).toHaveLength(1);
    expect(
      ragDocumentContextService.getRepresentativeChunks,
    ).not.toHaveBeenCalled();
    expect(ragArtifactCacheService.saveSummary).not.toHaveBeenCalled();
  });

  it('stores a custom summary without deleting the default one', async () => {
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
    const cachedSummaryState = {
      activeSlot: 'default' as const,
      versions: {
        default: {
          title: 'Default summary',
          overview: 'Stored overview.',
          key_points: ['Stored point'],
          conclusion: 'Stored conclusion.',
          language: 'en' as const,
          generatedAt: '2026-04-11T00:00:00.000Z',
          sources: [],
          slot: 'default' as const,
          instruction: null,
        },
      },
    };
    const nextSummaryState = {
      activeSlot: 'custom' as const,
      versions: {
        ...cachedSummaryState.versions,
        custom: {
          title: 'Custom summary',
          overview: 'Custom overview.',
          key_points: ['Custom point'],
          conclusion: 'Custom conclusion.',
          language: 'en' as const,
          generatedAt: '2026-04-12T00:00:00.000Z',
          sources: [],
          slot: 'custom' as const,
          instruction: 'Focus on debugging workflow.',
        },
      },
    };

    ragDocumentContextService.ensureOwnedDocument.mockResolvedValue(document);
    ragArtifactCacheService.getSummaryState
      .mockReturnValueOnce(cachedSummaryState)
      .mockReturnValueOnce(nextSummaryState);
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
        title: 'Custom summary',
        overview: 'Custom overview.',
        key_points: ['Custom point'],
        conclusion: 'Custom conclusion.',
      });

    const result = await service.generateSummary(
      'doc-1',
      'user-1',
      'en',
      true,
      'Focus on debugging workflow.',
    );

    expect(result.cached).toBe(false);
    expect(result.slot).toBe('custom');
    expect(result.activeSlot).toBe('custom');
    expect(result.versions).toHaveLength(2);
    expect(result.versions.map((item) => item.slot)).toEqual([
      'default',
      'custom',
    ]);
    expect(ragArtifactCacheService.saveSummary).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-doc-1' }),
      expect.objectContaining({
        slot: 'custom',
        instruction: 'Focus on debugging workflow.',
      }),
      expect.objectContaining({ id: 'doc-1' }),
    );
  });

  it('rejects summary generation when the document has no indexed chunks', async () => {
    ragDocumentContextService.ensureOwnedDocument.mockResolvedValue({
      id: 'doc-1',
      title: 'Debugging Notes',
    });
    ragArtifactCacheService.getSummaryState.mockReturnValue(null);
    ragIndexingService.ensureDocumentIndexed.mockResolvedValue(undefined);
    ragDocumentContextService.getRepresentativeChunks.mockResolvedValue([]);

    await expect(
      service.generateSummary('doc-1', 'user-1', 'en'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(ragArtifactCacheService.saveSummary).not.toHaveBeenCalled();
    expect(ragStructuredGenerationService.generate).not.toHaveBeenCalled();
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
    const nextSummaryState = {
      activeSlot: 'default' as const,
      versions: {
        default: {
          title: 'Summary of Debugging Notes',
          overview:
            'The available context was not sufficient to extract a complete overview of the document.',
          key_points: [
            'The extracted context was not sufficient to recover all important points reliably.',
          ],
          conclusion:
            'This summary reflects only the content that was successfully extracted.',
          language: 'en' as const,
          generatedAt: '2026-04-12T00:00:00.000Z',
          sources: [],
          slot: 'default' as const,
          instruction: null,
        },
      },
    };

    ragDocumentContextService.ensureOwnedDocument.mockResolvedValue(document);
    ragArtifactCacheService.getSummaryState
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(nextSummaryState);
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

  it('repairs malformed raw Gemini JSON before parsing the summary payload', () => {
    const parsed = (service as unknown as StructuredSummaryInternals)
      .parseRawSummaryResponse(`\`\`\`json
{
  "format": "structured",
  "title": "Debugging Notes",
  "body": "",
  "overview": "Overview text",
  "key_points": ["Point one", "Point two" "Point three"],
  "conclusion": "Conclusion text"
}
\`\`\``);

    expect(parsed).toEqual(
      expect.objectContaining({
        title: 'Debugging Notes',
        overview: 'Overview text',
        key_points: ['Point one', 'Point two', 'Point three'],
        conclusion: 'Conclusion text',
      }),
    );
  });

  it('generates summaries in raw-only mode for better stability with Gemini', async () => {
    ragStructuredGenerationService.generate.mockResolvedValue({
      title: 'Debugging Notes',
      overview: 'Overview text',
      key_points: ['Point one'],
      conclusion: 'Conclusion text',
    });

    const result = await (
      service as unknown as StructuredSummaryInternals
    ).generateStructuredSummary({
      documentTitle: 'Debugging Notes',
      context: 'Relevant context',
      languageName: 'English',
      instructionBlock: '',
    });

    expect(result).toEqual(
      expect.objectContaining({
        title: 'Debugging Notes',
        overview: 'Overview text',
        key_points: ['Point one'],
        conclusion: 'Conclusion text',
      }),
    );
    expect(ragStructuredGenerationService.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        skipJsonSchema: true,
        skipFunctionCalling: true,
      }),
    );
  });
});
