import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { RagSummaryService } from './rag-summary.service';

describe('RagSummaryService', () => {
  const richOverview =
    'The document explains a debugging workflow that starts from observing a failure, narrows the suspected cause through evidence, and verifies the fix with repeatable checks.';
  const richKeyPoints = [
    'Start by reproducing the failure consistently so later changes can be compared against the same observable behavior.',
    'Use logs, traces, and small experiments to separate likely causes from assumptions before changing production code.',
    'After the cause is isolated, apply the smallest focused fix and rerun the same checks to confirm the behavior changed.',
  ];
  const richConclusion =
    'The central takeaway is that effective debugging depends on disciplined evidence gathering, focused changes, and explicit verification after the fix.';

  type OwnedDocument = {
    id: string;
    title: string;
    contentHash?: string | null;
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
    readArtifact: jest.fn<unknown, [OwnedUserDocument, string]>(),
    writeArtifact: jest.fn<
      Promise<void>,
      [
        OwnedUserDocument,
        {
          activeSelector: string;
          artifact: unknown;
        },
      ]
    >(),
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
    jest.resetAllMocks();
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
    ragArtifactCacheService.readArtifact.mockReturnValue(null);
    ragArtifactCacheService.writeArtifact.mockResolvedValue(undefined);
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
      title: 'Sample Document',
    };
    const cachedSummaryState = {
      activeSlot: 'default' as const,
      versions: {
        default: {
          title: 'Existing summary',
          overview: richOverview,
          key_points: richKeyPoints,
          conclusion: richConclusion,
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

  it('reuses a keyed cached summary before checking legacy summary state', async () => {
    const document = {
      id: 'doc-1',
      title: 'Sample Document',
      contentHash: 'content-hash-1',
    };
    const keyedSummary = {
      title: 'Keyed summary',
      overview: richOverview,
      key_points: richKeyPoints,
      conclusion: richConclusion,
      language: 'en' as const,
      generatedAt: '2026-05-06T00:00:00.000Z',
      sources: [],
      slot: 'default' as const,
      instruction: null,
    };

    ragDocumentContextService.ensureOwnedDocument.mockResolvedValue(document);
    ragArtifactCacheService.readArtifact.mockReturnValue({
      key: 'cache-key-1',
      artifactType: 'summary',
      language: 'en',
      mode: 'default',
      documentId: 'doc-1',
      contentHash: 'content-hash-1',
      instructionHash: 'instruction-hash-1',
      artifactVersion: 3,
      generatedAt: '2026-05-06T00:00:00.000Z',
      payload: keyedSummary,
    });

    const result = await service.generateSummary('doc-1', 'user-1', 'en');

    expect(result).toEqual(
      expect.objectContaining({
        title: 'Keyed summary',
        cached: true,
        slot: 'default',
      }),
    );
    expect(ragArtifactCacheService.getSummaryState).not.toHaveBeenCalled();
    expect(ragIndexingService.ensureDocumentIndexed).not.toHaveBeenCalled();
    expect(ragArtifactCacheService.saveSummary).not.toHaveBeenCalled();
  });

  it('does not reuse a custom summary when the instruction changes', async () => {
    const document = {
      id: 'doc-1',
      title: 'Sample Document',
      contentHash: 'content-hash-1',
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
      activeSlot: 'custom' as const,
      versions: {
        custom: {
          title: 'Old custom summary',
          overview: richOverview,
          key_points: richKeyPoints,
          conclusion: richConclusion,
          language: 'en' as const,
          generatedAt: '2026-05-06T00:00:00.000Z',
          sources: [],
          slot: 'custom' as const,
          instruction: 'Focus on chapter one.',
        },
      },
    };
    const nextSummaryState = {
      activeSlot: 'custom' as const,
      versions: {
        custom: {
          title: 'New custom summary',
          overview: richOverview,
          key_points: richKeyPoints,
          conclusion: richConclusion,
          language: 'en' as const,
          generatedAt: '2026-05-06T01:00:00.000Z',
          sources: [],
          slot: 'custom' as const,
          instruction: 'Focus on chapter two.',
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
    jest
      .spyOn(
        service as unknown as StructuredSummaryInternals,
        'generateStructuredSummary',
      )
      .mockResolvedValue({
        title: 'New custom summary',
        overview: richOverview,
        key_points: richKeyPoints,
        conclusion: richConclusion,
      });

    const result = await service.generateSummary(
      'doc-1',
      'user-1',
      'en',
      false,
      'Focus on chapter two.',
    );

    expect(result.cached).toBe(false);
    expect(result.title).toBe('New custom summary');
    expect(ragIndexingService.ensureDocumentIndexed).toHaveBeenCalledWith(
      'doc-1',
    );
    expect(ragArtifactCacheService.writeArtifact).toHaveBeenCalled();
    expect(ragArtifactCacheService.saveSummary).toHaveBeenCalled();
  });

  it('ignores truncated cached summaries and regenerates them', async () => {
    const document = {
      id: 'doc-1',
      title: 'Study Notes',
    };
    const representativeChunks = [
      {
        chunkIndex: 0,
        chunkText:
          'Relevant context about core concepts, mechanisms, and their academic implications.',
        pageNumber: 1,
        sectionTitle: 'Introduction',
      },
    ];
    const brokenSummaryState = {
      activeSlot: 'custom' as const,
      versions: {
        custom: {
          title: 'Broken custom summary',
          overview: 'Nội dung bị cắt ngắng (chưa',
          key_points: [],
          conclusion: '',
          format: 'narrative' as const,
          body: 'Nội dung bị cắt ngắng (chưa',
          language: 'vi' as const,
          generatedAt: '2026-04-11T00:00:00.000Z',
          sources: [],
          slot: 'custom' as const,
          instruction: 'hãy tóm tắt thành một đoạn',
        },
      },
    };
    const nextSummaryState = {
      activeSlot: 'default' as const,
      versions: {
        default: {
          title: 'Regenerated summary',
          overview: richOverview,
          key_points: richKeyPoints,
          conclusion: richConclusion,
          language: 'vi' as const,
          generatedAt: '2026-04-12T00:00:00.000Z',
          sources: [],
          slot: 'default' as const,
          instruction: null,
        },
      },
    };

    ragDocumentContextService.ensureOwnedDocument.mockResolvedValue(document);
    ragArtifactCacheService.getSummaryState
      .mockReturnValueOnce(brokenSummaryState)
      .mockReturnValueOnce(nextSummaryState);
    ragDocumentContextService.getRepresentativeChunks.mockResolvedValue(
      representativeChunks,
    );
    ragDocumentContextService.buildSummaryContext.mockReturnValue(
      'Relevant context',
    );
    jest
      .spyOn(
        service as unknown as StructuredSummaryInternals,
        'generateStructuredSummary',
      )
      .mockResolvedValue({
        title: 'Regenerated summary',
        overview: richOverview,
        key_points: richKeyPoints,
        conclusion: richConclusion,
      });

    const result = await service.generateSummary('doc-1', 'user-1', 'vi');

    expect(result.cached).toBe(false);
    expect(result.title).toBe('Regenerated summary');
    expect(
      ragDocumentContextService.getRepresentativeChunks,
    ).toHaveBeenCalled();
    expect(ragArtifactCacheService.saveSummary).toHaveBeenCalled();
  });

  it('stores a custom summary without deleting the default one', async () => {
    const document = {
      id: 'doc-1',
      title: 'Sample Document',
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
          overview: richOverview,
          key_points: richKeyPoints,
          conclusion: richConclusion,
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
          overview: richOverview,
          key_points: richKeyPoints,
          conclusion: richConclusion,
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
        overview: richOverview,
        key_points: richKeyPoints,
        conclusion: richConclusion,
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
      title: 'Sample Document',
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

  it('rejects unusable generated summaries instead of saving broken cache', async () => {
    const document = {
      id: 'doc-1',
      title: 'Sample Document',
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
    ragArtifactCacheService.getSummaryState.mockReturnValue(null);
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

    await expect(
      service.generateSummary('doc-1', 'user-1', 'en'),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(ragArtifactCacheService.saveSummary).not.toHaveBeenCalled();
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
      'Sample Document',
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
  "title": "Sample Document",
  "body": "",
  "overview": "Overview text",
  "key_points": ["Point one", "Point two" "Point three"],
  "conclusion": "Conclusion text"
}
\`\`\``);

    expect(parsed).toEqual(
      expect.objectContaining({
        title: 'Sample Document',
        overview: 'Overview text',
        key_points: ['Point one', 'Point two', 'Point three'],
        conclusion: 'Conclusion text',
      }),
    );
  });

  it('generates summaries in raw-only mode for better stability with Gemini', async () => {
    ragStructuredGenerationService.generate.mockResolvedValue({
      title: 'Sample Document',
      overview: 'Overview text',
      key_points: ['Point one'],
      conclusion: 'Conclusion text',
    });

    const result = await (
      service as unknown as StructuredSummaryInternals
    ).generateStructuredSummary({
      documentTitle: 'Sample Document',
      context: 'Relevant context',
      languageName: 'English',
      instructionBlock: '',
    });

    expect(result).toEqual(
      expect.objectContaining({
        title: 'Sample Document',
        overview: 'Overview text',
        key_points: ['Point one'],
        conclusion: 'Conclusion text',
      }),
    );
    expect(ragStructuredGenerationService.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        policy: 'raw_json_only',
      }),
    );
  });
});
