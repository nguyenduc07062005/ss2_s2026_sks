import { RagSearchService } from './rag-search.service';
import { normalizeComparisonText } from 'src/common/utils/text-normalization.util';

describe('RagSearchService', () => {
  type SearchMatchType = 'title' | 'section' | 'content' | 'meaning';
  type SearchResultCandidate = {
    matchType: SearchMatchType;
    score: number | null;
    title: string;
    matchSectionTitle: string | null;
    matchSnippet: string | null;
    matchedConcepts: string[];
  };
  type SearchResultDocument = {
    id: string;
    title: string;
    metadata: null;
    docDate: null;
    extraAttributes: null;
    fileRef: null;
    fileSize: null;
    contentHash: null;
    status: string;
    isFavorite: boolean;
    formattedFileSize: string;
    folderId: string | null;
    folderName: string;
    createdAt: Date;
    updatedAt: Date;
    matchType: SearchMatchType;
    score: number | null;
    relevanceLabel: string;
    matchedConcepts: string[];
    matchSnippet: string | null;
    matchSectionTitle: string | null;
    matchPageNumber: number | null;
    matchLabel: string;
    matchReason: string;
    evidenceSnippet: string | null;
    topics: string[];
  };
  type RagSearchServiceInternals = {
    ensureScopeIndexed: (ownerId: string, scope: unknown) => Promise<void>;
    extractMatchedConcepts: (
      summary: {
        metadata: {
          keywords?: string[];
          topic?: string | null;
          field?: string | null;
          methodology?: string | null;
        } | null;
      },
      query: string,
      insight?: {
        snippet: string;
        chunkText: string;
        sectionTitle: string | null;
        matchType?: SearchMatchType;
      },
    ) => string[];
    getLexicalDocumentMatches: (
      ownerId: string,
      scope: unknown,
      query: string,
      intent?: unknown,
    ) => Promise<SearchResultDocument[]>;
    getRankedDocumentSummaries: (
      ownerId: string,
      rankedDocuments: Array<{
        documentId: string;
        score: number;
        matchType: SearchMatchType;
      }>,
      query: string,
      insightMap: Map<string, unknown>,
    ) => Promise<SearchResultDocument[]>;
    getSemanticSearchDocuments: (
      ownerId: string,
      scope: unknown,
      query: string,
    ) => Promise<SearchResultDocument[]>;
    getSemanticDocumentInsights: (
      ownerId: string,
      scope: unknown,
      embedding: number[],
      documentIds: string[],
    ) => Promise<Map<string, unknown>>;
    getSemanticDocumentScores: (
      ownerId: string,
      scope: unknown,
      embedding: number[],
    ) => Promise<Array<{ documentId: string; semanticScore: number }>>;
    resolveScope: (ownerId: string, folderId?: string) => Promise<unknown>;
    shouldKeepSemanticResult: (
      document: SearchResultCandidate,
      query: string,
    ) => boolean;
  };

  const dataSource = {
    query: jest.fn(),
  };
  const geminiService = {
    createEmbedding: jest.fn(),
  };
  const chunkRepository = {
    findByDocument: jest.fn(),
  };
  const folderRepository = {
    findOne: jest.fn(),
  };
  const userDocumentRepository = {
    getRepository: jest.fn(),
  };
  const ragDocumentContextService = {
    ensureOwnedDocument: jest.fn(),
  };
  const ragIndexingService = {
    ensureDocumentIndexed: jest.fn(),
  };
  const ragSearchExplanationService = {
    enrichSearchReasons: jest.fn((documents: SearchResultDocument[]) =>
      Promise.resolve(documents),
    ),
    buildFallbackReason: jest.fn(
      ({ matchType }: { matchType: SearchMatchType }) =>
        `${matchType} fallback reason.`,
    ),
  };

  let service: RagSearchService;

  const callShouldKeepSemanticResult = (
    document: SearchResultCandidate,
    query: string,
  ): boolean =>
    (service as unknown as RagSearchServiceInternals).shouldKeepSemanticResult(
      document,
      query,
    );
  const callExtractMatchedConcepts = (
    summary: {
      metadata: {
        keywords?: string[];
        topic?: string | null;
        field?: string | null;
        methodology?: string | null;
      } | null;
    },
    query: string,
    insight?: {
      snippet: string;
      chunkText: string;
      sectionTitle: string | null;
      matchType?: SearchMatchType;
    },
  ): string[] =>
    (service as unknown as RagSearchServiceInternals).extractMatchedConcepts(
      summary,
      query,
      insight,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RagSearchService(
      dataSource as never,
      geminiService as never,
      chunkRepository as never,
      folderRepository as never,
      userDocumentRepository as never,
      ragDocumentContextService as never,
      ragIndexingService as never,
      ragSearchExplanationService as never,
    );
  });

  const mockScopeResolution = () => {
    jest
      .spyOn(service as unknown as RagSearchServiceInternals, 'resolveScope')
      .mockResolvedValue({
        folder: null,
        scopedFolderId: null,
        isWorkspaceScope: true,
      });
    jest
      .spyOn(
        service as unknown as RagSearchServiceInternals,
        'ensureScopeIndexed',
      )
      .mockResolvedValue(undefined);
  };

  const createSearchDocument = (
    overrides: Partial<SearchResultDocument> = {},
  ): SearchResultDocument => ({
    id: 'doc-1',
    title: 'Lecture 3',
    metadata: null,
    docDate: null,
    extraAttributes: null,
    fileRef: null,
    fileSize: null,
    contentHash: null,
    status: 'processed',
    isFavorite: false,
    formattedFileSize: '0 Bytes',
    folderId: null,
    folderName: 'Workspace',
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    matchType: 'meaning',
    score: 0.63,
    relevanceLabel: 'Meaning match',
    matchedConcepts: ['object oriented programming'],
    matchSnippet:
      'This lecture covers classes, inheritance, polymorphism, and object oriented design.',
    matchSectionTitle: 'OOP Fundamentals',
    matchPageNumber: 12,
    matchLabel: 'Meaning match',
    matchReason: 'The document discusses concepts related to "query".',
    evidenceSnippet:
      'This lecture covers classes, inheritance, polymorphism, and object oriented design.',
    topics: ['object oriented programming'],
    ...overrides,
  });

  it('does not call embeddings for exact file-name style queries', async () => {
    mockScopeResolution();
    const lexicalSpy = jest
      .spyOn(
        service as unknown as RagSearchServiceInternals,
        'getLexicalDocumentMatches',
      )
      .mockResolvedValue([
        createSearchDocument({
          matchType: 'title',
          matchLabel: 'Title match',
          relevanceLabel: 'Title match',
          score: 0.94,
        }),
      ]);
    const semanticSpy = jest.spyOn(
      service as unknown as RagSearchServiceInternals,
      'getSemanticSearchDocuments',
    );

    const result = await service.searchDocuments('report-2026.pdf', 'user-1');

    expect(result.mode).toBe('lexical');
    expect(lexicalSpy).toHaveBeenCalledWith(
      'user-1',
      expect.any(Object),
      'report-2026.pdf',
      expect.any(Object),
    );
    expect(semanticSpy).not.toHaveBeenCalled();
    expect(geminiService.createEmbedding).not.toHaveBeenCalled();
    expect(result.documents[0]).toEqual(
      expect.objectContaining({
        matchLabel: 'Title match',
        relevanceLabel: 'Title match',
      }),
    );
  });

  it('filters lexical candidates in SQL before document ranking', async () => {
    dataSource.query.mockResolvedValue([]);

    const result = await (
      service as unknown as RagSearchServiceInternals
    ).getLexicalDocumentMatches(
      'user-1',
      { folder: null, scopedFolderId: null, isWorkspaceScope: true },
      'missing report',
    );

    expect(result).toEqual([]);
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('ILIKE'),
      expect.arrayContaining([
        'user-1',
        '%missing report%',
        '%missing%',
        '%report%',
      ]),
    );
    expect(userDocumentRepository.getRepository).not.toHaveBeenCalled();
  });

  it('enriches returned page documents with user-facing search reasons', async () => {
    mockScopeResolution();
    ragSearchExplanationService.enrichSearchReasons.mockImplementationOnce(
      (documents: SearchResultDocument[]) =>
        Promise.resolve(
          documents.map((document) => ({
            ...document,
            matchReason:
              'This document matches because its title directly matches the search request.',
          })),
        ),
    );
    jest
      .spyOn(
        service as unknown as RagSearchServiceInternals,
        'getLexicalDocumentMatches',
      )
      .mockResolvedValue([
        createSearchDocument({
          matchType: 'title',
          matchLabel: 'Title match',
          matchReason: 'title fallback reason.',
        }),
      ]);
    jest.spyOn(
      service as unknown as RagSearchServiceInternals,
      'getSemanticSearchDocuments',
    );

    const result = await service.searchDocuments('report.pdf', 'user-1');

    expect(
      ragSearchExplanationService.enrichSearchReasons,
    ).toHaveBeenCalledWith(expect.any(Array), 'report.pdf');
    expect(result.documents[0]).toEqual(
      expect.objectContaining({
        matchLabel: 'Title match',
        matchReason:
          'This document matches because its title directly matches the search request.',
      }),
    );
  });

  it('generates AI reasons only for documents on the requested page', async () => {
    mockScopeResolution();
    jest
      .spyOn(
        service as unknown as RagSearchServiceInternals,
        'getLexicalDocumentMatches',
      )
      .mockResolvedValue(
        Array.from({ length: 5 }, (_, index) =>
          createSearchDocument({
            id: `doc-${index + 1}`,
            matchType: 'title',
            matchLabel: 'Title match',
            score: 1 - index * 0.01,
          }),
        ),
      );

    const result = await service.searchDocuments('report-2026.pdf', 'user-1', {
      page: 2,
      limit: 2,
    });

    expect(result.total).toBe(5);
    expect(result.documents.map((document) => document.id)).toEqual([
      'doc-3',
      'doc-4',
    ]);
    expect(
      ragSearchExplanationService.enrichSearchReasons,
    ).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'doc-3' }),
        expect.objectContaining({ id: 'doc-4' }),
      ]),
      'report-2026.pdf',
    );
  });

  it('uses semantic search for long conceptual queries', async () => {
    mockScopeResolution();
    const lexicalSpy = jest.spyOn(
      service as unknown as RagSearchServiceInternals,
      'getLexicalDocumentMatches',
    );
    const semanticSpy = jest
      .spyOn(
        service as unknown as RagSearchServiceInternals,
        'getSemanticSearchDocuments',
      )
      .mockResolvedValue([createSearchDocument()]);

    const result = await service.searchDocuments(
      'Explain object oriented programming abstraction and polymorphism',
      'user-1',
    );

    expect(result.mode).toBe('semantic');
    expect(lexicalSpy).not.toHaveBeenCalled();
    expect(semanticSpy).toHaveBeenCalled();
  });

  it('uses hybrid search for mixed natural language queries and ranks title matches above stronger meaning scores', async () => {
    mockScopeResolution();
    jest
      .spyOn(
        service as unknown as RagSearchServiceInternals,
        'getLexicalDocumentMatches',
      )
      .mockResolvedValue([
        createSearchDocument({
          id: 'title-hit',
          title: 'Reference Report',
          matchType: 'title',
          matchLabel: 'Title match',
          relevanceLabel: 'Title match',
          score: 0.8,
        }),
      ]);
    jest
      .spyOn(
        service as unknown as RagSearchServiceInternals,
        'getSemanticSearchDocuments',
      )
      .mockResolvedValue([
        createSearchDocument({
          id: 'meaning-hit',
          title: 'Different Report',
          matchType: 'meaning',
          matchLabel: 'Meaning match',
          relevanceLabel: 'Meaning match',
          score: 0.95,
        }),
      ]);

    const result = await service.searchDocuments(
      'generic mixed query',
      'user-1',
    );

    expect(result.mode).toBe('hybrid');
    expect(result.documents.map((document) => document.id)).toEqual([
      'title-hit',
      'meaning-hit',
    ]);
  });

  it('ranks section matches above content matches', async () => {
    mockScopeResolution();
    jest
      .spyOn(
        service as unknown as RagSearchServiceInternals,
        'getLexicalDocumentMatches',
      )
      .mockResolvedValue([
        createSearchDocument({
          id: 'content-hit',
          matchType: 'content',
          matchLabel: 'Content match',
          relevanceLabel: 'Content match',
          score: 1,
        }),
        createSearchDocument({
          id: 'section-hit',
          matchType: 'section',
          matchLabel: 'Section match',
          relevanceLabel: 'Section match',
          score: 0.6,
        }),
      ]);
    jest
      .spyOn(
        service as unknown as RagSearchServiceInternals,
        'getSemanticSearchDocuments',
      )
      .mockResolvedValue([]);

    const result = await service.searchDocuments(
      'generic mixed query',
      'user-1',
    );

    expect(result.documents.map((document) => document.id)).toEqual([
      'section-hit',
      'content-hit',
    ]);
  });

  it('uses updated time as the final ranking tie-breaker', async () => {
    mockScopeResolution();
    jest
      .spyOn(
        service as unknown as RagSearchServiceInternals,
        'getSemanticSearchDocuments',
      )
      .mockResolvedValue([
        createSearchDocument({
          id: 'older-hit',
          score: 0.83,
          updatedAt: new Date('2026-04-01T00:00:00.000Z'),
        }),
        createSearchDocument({
          id: 'newer-hit',
          score: 0.83,
          updatedAt: new Date('2026-04-02T00:00:00.000Z'),
        }),
      ]);

    const result = await service.searchDocuments(
      'Explain object oriented programming abstraction and polymorphism',
      'user-1',
    );

    expect(result.documents.map((document) => document.id)).toEqual([
      'newer-hit',
      'older-hit',
    ]);
  });

  it('filters low-confidence semantic matches with no lexical evidence', async () => {
    geminiService.createEmbedding.mockResolvedValue([0.1, 0.2]);
    mockScopeResolution();
    jest
      .spyOn(
        service as unknown as RagSearchServiceInternals,
        'getSemanticDocumentScores',
      )
      .mockResolvedValue([{ documentId: 'doc-1', semanticScore: 0.63 }]);
    jest
      .spyOn(
        service as unknown as RagSearchServiceInternals,
        'getSemanticDocumentInsights',
      )
      .mockResolvedValue(new Map());
    jest
      .spyOn(
        service as unknown as RagSearchServiceInternals,
        'getRankedDocumentSummaries',
      )
      .mockResolvedValue([createSearchDocument()]);
    const lexicalSpy = jest
      .spyOn(
        service as unknown as RagSearchServiceInternals,
        'getLexicalDocumentMatches',
      )
      .mockResolvedValue([]);

    const result = await service.searchDocuments(
      'rare transition marker',
      'user-1',
    );

    expect(result.documents).toEqual([]);
    expect(lexicalSpy).toHaveBeenCalledWith(
      'user-1',
      expect.any(Object),
      'rare transition marker',
      expect.any(Object),
    );
  });

  it('keeps low-confidence semantic matches when lexical evidence exists after accent normalization', () => {
    const result = callShouldKeepSemanticResult(
      {
        matchType: 'meaning',
        score: 0.64,
        title: 'Chuong co ban',
        matchSectionTitle: 'Noi dung chinh',
        matchSnippet:
          'Phan nay trinh bay cac dac diem va co che cua chu de nghien cuu.',
        matchedConcepts: ['co che va dac diem'],
      },
      'nghi\u00ean c\u1ee9u',
    );

    expect(result).toBe(true);
  });

  it('normalizes Vietnamese d-stroke consistently for lexical comparison', () => {
    expect(normalizeComparisonText('\u0111 \u0110 d\u1eef li\u1ec7u')).toBe(
      'd d du lieu',
    );
  });

  it('rejects low-confidence semantic matches when the only overlap comes from matchedConcepts', () => {
    const result = callShouldKeepSemanticResult(
      {
        matchType: 'meaning',
        score: 0.64,
        title: 'Lecture 4',
        matchSectionTitle: 'Design principles',
        matchSnippet:
          'This lecture explains object composition and abstraction.',
        matchedConcepts: ['qu\u00e1 \u0111\u1ed9'],
      },
      'qu\u00e1 \u0111\u1ed9',
    );

    expect(result).toBe(false);
  });

  it('keeps strong semantic matches even without lexical overlap', () => {
    const result = callShouldKeepSemanticResult(
      {
        matchType: 'meaning',
        score: 0.84,
        title: 'Lecture 4',
        matchSectionTitle: 'Design principles',
        matchSnippet:
          'This lecture explains object composition and abstraction.',
        matchedConcepts: ['composition', 'abstraction'],
      },
      'l\u1eadp tr\u00ecnh h\u01b0\u1edbng \u0111\u1ed1i t\u01b0\u1ee3ng',
    );

    expect(result).toBe(true);
  });

  it('does not fall back to the raw query when no document concepts are available', () => {
    const result = callExtractMatchedConcepts(
      {
        metadata: null,
      },
      'qu\u00e1 \u0111\u1ed9',
      {
        snippet: '',
        chunkText: '',
        sectionTitle: null,
        matchType: 'meaning',
      },
    );

    expect(result).toEqual([]);
  });
});
