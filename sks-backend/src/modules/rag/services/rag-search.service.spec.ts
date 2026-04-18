import { RagSearchService } from './rag-search.service';

describe('RagSearchService', () => {
  type SearchResultCandidate = {
    matchType: 'semantic' | 'keyword_fallback';
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
    matchType: 'semantic' | 'keyword_fallback';
    score: number | null;
    relevanceLabel: string;
    matchedConcepts: string[];
    matchSnippet: string | null;
    matchSectionTitle: string | null;
    matchPageNumber: number | null;
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
      },
    ) => string[];
    getKeywordFallbackDocuments: (
      ownerId: string,
      scope: unknown,
      query: string,
      excludedIds: string[],
    ) => Promise<SearchResultDocument[]>;
    getRankedDocumentSummaries: (
      ownerId: string,
      rankedDocuments: Array<{ documentId: string; score: number }>,
      matchType: 'semantic' | 'keyword_fallback',
      query: string,
      insightMap: Map<string, unknown>,
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
    );
  });

  it('filters low-confidence semantic matches with no lexical evidence for a specific Vietnamese query', async () => {
    geminiService.createEmbedding.mockResolvedValue([0.1, 0.2]);

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
      .mockResolvedValue([
        {
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
          matchType: 'semantic',
          score: 0.63,
          relevanceLabel: 'Related',
          matchedConcepts: ['object oriented programming'],
          matchSnippet:
            'This lecture covers classes, inheritance, polymorphism, and object oriented design.',
          matchSectionTitle: 'OOP Fundamentals',
          matchPageNumber: 12,
        },
      ]);
    const keywordFallbackSpy = jest
      .spyOn(
        service as unknown as RagSearchServiceInternals,
        'getKeywordFallbackDocuments',
      )
      .mockResolvedValue([]);

    const result = await service.searchDocuments(
      'qu\u00e1 \u0111\u1ed9',
      'user-1',
    );

    expect(result.documents).toEqual([]);
    expect(keywordFallbackSpy).toHaveBeenCalledWith(
      'user-1',
      expect.any(Object),
      'qu\u00e1 \u0111\u1ed9',
      [],
    );
  });

  it('keeps low-confidence semantic matches when lexical evidence exists after accent normalization', () => {
    const result = callShouldKeepSemanticResult(
      {
        matchType: 'semantic',
        score: 0.64,
        title: 'Chuong qua do',
        matchSectionTitle: 'Noi dung qua do',
        matchSnippet: 'Phan nay trinh bay cac dac diem cua qua do len CNXH.',
        matchedConcepts: ['qua do len cnxh'],
      },
      'qu\u00e1 \u0111\u1ed9',
    );

    expect(result).toBe(true);
  });

  it('rejects low-confidence semantic matches when the only overlap comes from matchedConcepts', () => {
    const result = callShouldKeepSemanticResult(
      {
        matchType: 'semantic',
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
        matchType: 'semantic',
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
      },
    );

    expect(result).toEqual([]);
  });
});
