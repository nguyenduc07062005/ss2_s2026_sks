import { BadRequestException } from '@nestjs/common';
import { RagMindMapService } from './rag-mind-map.service';

describe('RagMindMapService', () => {
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

  const document = {
    id: 'doc-1',
    title: 'Debugging Notes',
  };
  const userDocument = {
    id: 'user-doc-1',
    extraAttributes: {},
  };
  const representativeChunks: RepresentativeChunk[] = [
    {
      chunkIndex: 0,
      chunkText:
        'Core foundations explain concepts, mechanisms, and study relationships.',
      pageNumber: 1,
      sectionTitle: 'Foundations',
    },
    {
      chunkIndex: 1,
      chunkText:
        'The transition period links causes, institutions, and learning outcomes.',
      pageNumber: 2,
      sectionTitle: 'Transition',
    },
  ];

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
    getRelevantChunks: jest.fn<
      Promise<RepresentativeChunk[]>,
      [string, string, number]
    >(),
    buildSummaryContext: jest.fn<string, [RepresentativeChunk[]]>(),
    buildSources: jest.fn<unknown[], [string, string, RepresentativeChunk[]]>(),
  };
  const ragArtifactCacheService = {
    getMindMapState: jest.fn<unknown, [OwnedUserDocument, 'en' | 'vi', OwnedDocument?]>(),
    saveMindMap: jest.fn<
      Promise<void>,
      [OwnedUserDocument, unknown, OwnedDocument?]
    >(),
  };
  const ragSummaryService = {
    generateSummary: jest.fn<Promise<unknown>, unknown[]>(),
  };
  const ragStructuredGenerationService = {
    generate: jest.fn<Promise<unknown>, [unknown]>(),
  };

  let service: RagMindMapService;
  let persistedMindMapState: unknown = null;

  const generatedDraft = {
    title: 'Mind map title',
    summary: 'Overview of the document.',
    branches: [
      {
        label: 'Core branch',
        summary: 'This is the main idea.',
        children: [
          {
            label: 'Key point',
            summary: 'A useful explanation.',
            children: [],
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    persistedMindMapState = null;
    userDocumentRepository.findByUserAndDocument.mockResolvedValue(
      userDocument,
    );
    ragIndexingService.ensureDocumentIndexed.mockResolvedValue(undefined);
    ragDocumentContextService.ensureOwnedDocument.mockResolvedValue(document);
    ragDocumentContextService.getRepresentativeChunks.mockResolvedValue(
      representativeChunks,
    );
    ragDocumentContextService.getRelevantChunks.mockResolvedValue(
      representativeChunks,
    );
    ragDocumentContextService.buildSummaryContext.mockReturnValue(
      'Representative context',
    );
    ragDocumentContextService.buildSources.mockReturnValue([]);
    ragArtifactCacheService.getMindMapState.mockImplementation(
      () => persistedMindMapState,
    );
    ragArtifactCacheService.saveMindMap.mockImplementation(
      async (_userDoc, artifact) => {
        const savedArtifact = artifact as {
          slot: 'default' | 'custom';
          summaryLanguage: 'en' | 'vi';
        };

        persistedMindMapState = {
          activeSlot: savedArtifact.slot,
          versions: {
            [savedArtifact.slot]: savedArtifact,
          },
        };
      },
    );
    ragStructuredGenerationService.generate.mockResolvedValue(generatedDraft);

    service = new RagMindMapService(
      ragIndexingService as never,
      ragDocumentContextService as never,
      ragArtifactCacheService as never,
      ragSummaryService as never,
      ragStructuredGenerationService as never,
      userDocumentRepository as never,
    );
  });

  it('returns a cached mind map version without regenerating it', async () => {
    const cachedStudyNote = {
      overview: 'Cached overview note',
      explanation: 'Cached explanation note',
      keyPoints: ['Cached key point'],
      studyFocus: 'Cached study focus',
    };
    const cachedMindMap = {
      root: {
        id: 'root',
        label: 'Cached map',
        summary: 'Cached overview',
        kind: 'root',
        studyNote: cachedStudyNote,
        children: [
          {
            id: 'branch-1',
            label: 'Cached branch',
            summary: 'Cached branch summary',
            kind: 'cluster',
            studyNote: cachedStudyNote,
            children: [
              {
                id: 'branch-1-1',
                label: 'Cached detail',
                summary: 'Cached detail summary',
                kind: 'insight',
                studyNote: cachedStudyNote,
                children: [],
              },
              {
                id: 'branch-1-2',
                label: 'Cached evidence',
                summary: 'Cached evidence summary',
                kind: 'insight',
                studyNote: cachedStudyNote,
                children: [],
              },
            ],
          },
        ],
      },
      summaryText: 'Cached summary',
      summaryLanguage: 'vi' as const,
      generatedAt: '2026-04-11T00:00:00.000Z',
      version: 18,
      slot: 'default' as const,
      instruction: null,
      sources: [],
    };

    persistedMindMapState = {
      activeSlot: 'default' as const,
      versions: {
        default: cachedMindMap,
      },
    };

    const result = await service.getDocumentMindMap('doc-1', 'user-1', 'vi');

    expect(result).toEqual(
      expect.objectContaining({
        mindMap: cachedMindMap.root,
        summary: cachedMindMap.summaryText,
        language: 'vi',
        generatedAt: cachedMindMap.generatedAt,
        cached: true,
        slot: 'default',
        activeSlot: 'default',
      }),
    );
    expect(result.versions).toHaveLength(1);
    expect(ragIndexingService.ensureDocumentIndexed).not.toHaveBeenCalled();
    expect(ragStructuredGenerationService.generate).not.toHaveBeenCalled();
    expect(ragArtifactCacheService.saveMindMap).not.toHaveBeenCalled();
  });

  it('generates and stores a custom mind map without deleting default history', async () => {
    const defaultMindMap = {
      root: {
        id: 'root',
        label: 'Default map',
        summary: 'Default overview',
        kind: 'root',
        children: [],
      },
      summaryText: 'Default summary',
      summaryLanguage: 'en' as const,
      generatedAt: '2026-04-10T00:00:00.000Z',
      version: 12,
      slot: 'default' as const,
      instruction: null,
      sources: [],
    };

    persistedMindMapState = {
      activeSlot: 'default' as const,
      versions: {
        default: defaultMindMap,
      },
    };
    ragArtifactCacheService.saveMindMap.mockImplementation(
      async (_userDoc, artifact) => {
        const savedArtifact = artifact as {
          slot: 'default' | 'custom';
          summaryLanguage: 'en' | 'vi';
        };

        persistedMindMapState = {
          activeSlot: savedArtifact.slot,
          versions: {
            default: defaultMindMap,
            [savedArtifact.slot]: savedArtifact,
          },
        };
      },
    );

    const result = await service.getDocumentMindMap(
      'doc-1',
      'user-1',
      'en',
      true,
      'Focus on cause and effect.',
    );

    expect(result.cached).toBe(false);
    expect(result.slot).toBe('custom');
    expect(result.activeSlot).toBe('custom');
    expect(result.versions.map((item) => item.slot)).toEqual([
      'default',
      'custom',
    ]);
    expect(ragArtifactCacheService.saveMindMap).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-doc-1' }),
      expect.objectContaining({
        slot: 'custom',
        instruction: 'Focus on cause and effect.',
      }),
      expect.objectContaining({ id: 'doc-1' }),
    );
  });

  it('passes a source outline scaffold to AI for rewriting before rendering', async () => {
    await service.getDocumentMindMap('doc-1', 'user-1', 'en', true);

    const generationOptions = ragStructuredGenerationService.generate.mock
      .calls[0]?.[0] as
      | {
          input?: {
            context?: string;
          };
        }
      | undefined;
    const context = generationOptions?.input?.context ?? '';

    expect(context).toContain('Source outline scaffold for AI rewriting');
    expect(context).toContain('Evidence to rewrite 1');
    expect(context).toContain('Supporting evidence excerpts');
    expect(context).toContain('Do not copy raw excerpts verbatim');
    expect(context).toContain('Foundations');
    expect(context).toContain('Transition');
    expect(ragDocumentContextService.buildSummaryContext).not.toHaveBeenCalled();
  });

  it('rejects mind map generation when the document has no indexed chunks', async () => {
    ragDocumentContextService.getRepresentativeChunks.mockResolvedValue([]);

    await expect(
      service.getDocumentMindMap('doc-1', 'user-1', 'en'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(ragStructuredGenerationService.generate).not.toHaveBeenCalled();
    expect(ragArtifactCacheService.saveMindMap).not.toHaveBeenCalled();
  });

  it('repairs weak AI trees with a second AI pass', async () => {
    ragStructuredGenerationService.generate
      .mockResolvedValueOnce({
        title: 'Weak map',
        summary: 'Weak overview.',
        branches: [
          {
            label: 'and',
            summary: 'This label is too short and weak.',
            children: [],
          },
        ],
      })
      .mockResolvedValueOnce({
        title: 'Repaired map',
        summary: 'Clear overview of the document.',
        branches: [
          {
            label: 'Socialist foundations',
            summary: 'The document explains core foundations.',
            children: [
              {
                label: 'Human liberation',
                summary: 'A clear supporting idea.',
                children: [],
              },
            ],
          },
        ],
      });

    const result = await service.getDocumentMindMap('doc-1', 'user-1', 'vi');

    expect(result.mindMap.label).toBe('Repaired map');
    expect(result.mindMap.children[0]?.label).toBe('Socialist foundations');
    expect(ragStructuredGenerationService.generate).toHaveBeenCalledTimes(2);
    expect(ragSummaryService.generateSummary).not.toHaveBeenCalled();
  });

  it('keeps complete Vietnamese concepts when labels are near the word limit', async () => {
    ragStructuredGenerationService.generate.mockResolvedValue({
      title: 'Chủ nghĩa xã hội và thời kỳ quá độ',
      summary: 'Tài liệu giải thích các ý chính về thời kỳ quá độ.',
      branches: [
        {
          label: 'Tính tất yếu của thời kỳ quá độ',
          summary: 'Ý này giải thích vì sao thời kỳ quá độ là cần thiết.',
          children: [
            {
              label: 'Cơ sở lý luận',
              summary: 'Luận điểm được đặt trong mạch lý luận của tài liệu.',
              children: [],
            },
          ],
        },
      ],
    });

    const result = await service.getDocumentMindMap('doc-1', 'user-1', 'vi');

    expect(result.mindMap.label).toBe('Chủ nghĩa xã hội và thời kỳ quá độ');
    expect(result.mindMap.children[0]?.label).toBe(
      'Tính tất yếu của thời kỳ quá độ',
    );
  });

  it('repairs shallow AI trees when the source context is broad', async () => {
    ragDocumentContextService.getRepresentativeChunks.mockResolvedValue([
      {
        chunkIndex: 0,
        chunkText:
          'The document explains historical conditions, conceptual foundations, institutional roles, social relationships, and learning implications for a broad academic topic.',
        pageNumber: 1,
        sectionTitle: 'Context',
      },
      {
        chunkIndex: 1,
        chunkText:
          'It connects causes and effects across economic development, political organization, human liberation, and collective social goals in several sections.',
        pageNumber: 2,
        sectionTitle: 'Relationships',
      },
      {
        chunkIndex: 2,
        chunkText:
          'The source also includes definitions, comparisons, practical examples, and conclusions that should appear as nested study concepts.',
        pageNumber: 3,
        sectionTitle: 'Details',
      },
    ]);
    ragStructuredGenerationService.generate
      .mockResolvedValueOnce({
        title: 'Shallow map',
        summary: 'The document has several important ideas.',
        branches: [
          {
            label: 'Socialist concept',
            summary: 'A single branch collapses the document.',
            children: [],
          },
        ],
      })
      .mockResolvedValueOnce({
        title: 'Repaired map',
        summary: 'The repaired map keeps the source ideas grouped.',
        branches: [
          {
            label: 'Conceptual foundations',
            summary: 'The document defines the core concepts.',
            children: [
              {
                label: 'Historical conditions',
                summary: 'The topic is tied to historical context.',
                children: [],
              },
            ],
          },
          {
            label: 'Social relationships',
            summary: 'The document connects institutions and social goals.',
            children: [
              {
                label: 'Human liberation',
                summary: 'The topic includes a human-centered purpose.',
                children: [],
              },
            ],
          },
        ],
      });

    const result = await service.getDocumentMindMap('doc-1', 'user-1', 'vi');

    expect(result.mindMap.label).toBe('Repaired map');
    expect(result.mindMap.children).toHaveLength(2);
    expect(ragStructuredGenerationService.generate).toHaveBeenCalledTimes(2);
    expect(ragSummaryService.generateSummary).not.toHaveBeenCalled();
  });

  it('builds a deeper source-driven fallback when AI generation fails', async () => {
    ragDocumentContextService.getRepresentativeChunks.mockResolvedValue([
      {
        chunkIndex: 0,
        chunkText:
          'The document explains conceptual foundations: social development includes historical conditions, productive forces, and institutional change.',
        pageNumber: 1,
        sectionTitle: 'Conceptual foundations',
      },
      {
        chunkIndex: 1,
        chunkText:
          'The transition period includes economic restructuring, political leadership, social relationships, and educational goals for learners.',
        pageNumber: 2,
        sectionTitle: 'Transition period',
      },
      {
        chunkIndex: 2,
        chunkText:
          'The document connects human liberation with collective ownership, practical organization, and long-term social development.',
        pageNumber: 3,
        sectionTitle: 'Human liberation',
      },
    ]);
    ragStructuredGenerationService.generate.mockRejectedValue(
      new Error('got status: 429 Too Many Requests'),
    );

    const result = await service.getDocumentMindMap('doc-1', 'user-1', 'vi');
    type TreeNode = { children?: TreeNode[] };
    const countNodes = (node: TreeNode): number =>
      1 +
      (node.children ?? []).reduce(
        (total, childNode) => total + countNodes(childNode),
        0,
      );

    expect(result.cached).toBe(false);
    expect(result.mindMap.children.length).toBeGreaterThanOrEqual(2);
    expect(countNodes(result.mindMap)).toBeGreaterThanOrEqual(5);
    expect(ragSummaryService.generateSummary).not.toHaveBeenCalled();
    expect(ragArtifactCacheService.saveMindMap).toHaveBeenCalled();
  });

  it('generates a focused study note for a selected mind map node', async () => {
    ragDocumentContextService.getRelevantChunks.mockResolvedValue([
      {
        chunkIndex: 4,
        chunkText:
          'Vietnam faces challenges from international integration, economic competition, institutional reform, and the task of building socialism in changing global conditions.',
        pageNumber: 5,
        sectionTitle: 'Challenges for Vietnam',
      },
    ]);
    ragDocumentContextService.buildSummaryContext.mockReturnValue(
      '[Chunk 4 | Page 5 | Section Challenges for Vietnam]\nVietnam faces challenges from international integration, economic competition, institutional reform, and the task of building socialism in changing global conditions.',
    );
    ragStructuredGenerationService.generate.mockResolvedValueOnce({
      overview:
        'Thách thức đối với Việt Nam là các áp lực phát triển trong bối cảnh hội nhập và xây dựng chủ nghĩa xã hội.',
      explanation:
        'Node này cần được hiểu như các khó khăn cụ thể mà Việt Nam gặp khi vừa hội nhập quốc tế vừa giữ định hướng phát triển xã hội chủ nghĩa.',
      keyPoints: [
        'Cạnh tranh kinh tế và hội nhập quốc tế tạo sức ép đổi mới.',
        'Cải cách thể chế là điều kiện để thích ứng với bối cảnh mới.',
      ],
      studyFocus:
        'Khi ôn, hãy nối thách thức với bối cảnh thời đại và nhiệm vụ xây dựng chủ nghĩa xã hội.',
    });

    const result = await service.generateMindMapNodeStudyNote(
      'doc-1',
      'user-1',
      {
        language: 'vi',
        label: 'Thách thức đối với Việt Nam',
        summary:
          'Thời đại ngày nay đặt ra nhiều thách thức cho Việt Nam trong quá trình xây dựng chủ nghĩa xã hội.',
        pathLabels: [
          'Đặc điểm và thách thức của thời đại ngày nay',
          'Thách thức đối với Việt Nam',
        ],
        siblingLabels: ['Sự tồn tại đan xen và đấu tranh giai cấp'],
      },
    );

    expect(result.overview).toContain('Thách thức đối với Việt Nam');
    expect(result.keyPoints).toContain(
      'Cạnh tranh kinh tế và hội nhập quốc tế tạo sức ép đổi mới.',
    );
    expect(ragDocumentContextService.getRelevantChunks).toHaveBeenCalledWith(
      'doc-1',
      expect.stringContaining('Thách thức đối với Việt Nam'),
      8,
    );
    expect(ragStructuredGenerationService.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        operationLabel: 'Mind map node study note generation',
      }),
    );
  });
});
