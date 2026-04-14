import { BadRequestException } from '@nestjs/common';
import { RagMindMapService } from './rag-mind-map.service';

describe('RagMindMapService', () => {
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
  };
  const ragArtifactCacheService = {
    getMindMap: jest.fn<unknown, [OwnedDocument, 'en' | 'vi']>(),
    saveMindMap: jest.fn<Promise<void>, [OwnedDocument, unknown]>(),
  };
  const ragStructuredGenerationService = {
    generate: jest.fn<Promise<unknown>, [unknown]>(),
  };
  const ragSummaryService = {
    generateSummary: jest.fn<
      Promise<unknown>,
      [string, string, 'en' | 'vi', boolean?]
    >(),
    toPlainText: jest.fn<string, [unknown]>(),
  };

  let service: RagMindMapService;

  beforeEach(() => {
    jest.clearAllMocks();
    ragIndexingService.ensureDocumentIndexed.mockResolvedValue(undefined);
    ragDocumentContextService.ensureOwnedDocument.mockResolvedValue({
      id: 'doc-1',
      title: 'Debugging Notes',
    });
    ragDocumentContextService.getRepresentativeChunks.mockResolvedValue([
      {
        chunkIndex: 0,
        chunkText: 'Relevant context',
        pageNumber: 1,
        sectionTitle: 'Introduction',
      },
    ]);
    ragDocumentContextService.buildSummaryContext.mockReturnValue(
      'Relevant context',
    );
    ragArtifactCacheService.getMindMap.mockReturnValue(null);
    ragArtifactCacheService.saveMindMap.mockResolvedValue(undefined);
    ragStructuredGenerationService.generate.mockResolvedValue(null);
    ragSummaryService.generateSummary.mockResolvedValue({
      title: 'Summary title',
      overview: 'Summary overview',
      key_points: ['Point one'],
      conclusion: 'Summary conclusion',
      language: 'en',
      generatedAt: '2026-04-12T00:00:00.000Z',
      cached: false,
      sources: [],
    });
    ragSummaryService.toPlainText.mockReturnValue('Summary fallback text');

    service = new RagMindMapService(
      ragIndexingService as never,
      ragDocumentContextService as never,
      ragArtifactCacheService as never,
      ragStructuredGenerationService as never,
      ragSummaryService as never,
    );
  });

  it('returns a cached mind map without regenerating it', async () => {
    const cachedMindMap = {
      root: {
        id: 'root',
        label: 'Cached map',
        summary: 'Cached overview',
        kind: 'root',
        children: [],
      },
      summaryText: 'Cached summary',
      summaryLanguage: 'vi' as const,
      generatedAt: '2026-04-11T00:00:00.000Z',
    };

    ragArtifactCacheService.getMindMap.mockReturnValue(cachedMindMap);

    const result = await service.getDocumentMindMap('doc-1', 'user-1', 'vi');

    expect(result).toEqual({
      mindMap: cachedMindMap.root,
      summary: cachedMindMap.summaryText,
      language: 'vi',
      generatedAt: cachedMindMap.generatedAt,
      cached: true,
    });
    expect(ragIndexingService.ensureDocumentIndexed).not.toHaveBeenCalled();
    expect(ragStructuredGenerationService.generate).not.toHaveBeenCalled();
    expect(ragArtifactCacheService.saveMindMap).not.toHaveBeenCalled();
  });

  it('generates and stores a fresh mind map when no cache is available', async () => {
    ragStructuredGenerationService.generate.mockResolvedValue({
      title: 'Mind map title',
      overview: 'Overview of the document.',
      overviewDetails: ['Important setup detail.'],
      clusters: [
        {
          label: 'Core branch',
          summary: 'This is the main idea.',
          points: [
            {
              label: 'Key point',
              summary: 'A useful explanation.',
              details: ['Extra supporting note.'],
            },
          ],
        },
      ],
      takeaway: 'Final takeaway.',
      takeawayDetails: ['Remember this.'],
    });

    const result = await service.getDocumentMindMap('doc-1', 'user-1', 'en');

    expect(result.cached).toBe(false);
    expect(result.language).toBe('en');
    expect(result.mindMap.id).toBe('root');
    expect(result.mindMap.label).toBe('Mind map title');
    expect(result.mindMap.children).toHaveLength(3);
    expect(result.summary).toContain('Key branches:');
    expect(ragArtifactCacheService.saveMindMap).toHaveBeenCalledWith(
      { id: 'doc-1', title: 'Debugging Notes' },
      expect.any(Object),
    );

    const savedMindMap = ragArtifactCacheService.saveMindMap.mock
      .calls[0]?.[1] as
      | {
          root: { id: string };
          summaryText: string;
          summaryLanguage: string;
          version: number;
        }
      | undefined;

    expect(savedMindMap).toBeDefined();
    expect(savedMindMap?.root.id).toBe('root');
    expect(savedMindMap?.summaryText).toBe(result.summary);
    expect(savedMindMap?.summaryLanguage).toBe('en');
    expect(savedMindMap?.version).toBe(3);
  });

  it('rejects mind map generation when the document has no indexed chunks', async () => {
    ragArtifactCacheService.getMindMap.mockReturnValue(null);
    ragDocumentContextService.getRepresentativeChunks.mockResolvedValue([]);

    await expect(
      service.getDocumentMindMap('doc-1', 'user-1', 'en'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(ragStructuredGenerationService.generate).not.toHaveBeenCalled();
    expect(ragArtifactCacheService.saveMindMap).not.toHaveBeenCalled();
  });

  it('falls back to the summary service when direct mind map generation fails', async () => {
    ragStructuredGenerationService.generate.mockRejectedValue(
      new Error('structured generation failed'),
    );
    ragSummaryService.generateSummary.mockResolvedValue({
      title: 'Summary title',
      overview: 'Summary overview',
      key_points: ['Point one'],
      conclusion: 'Summary conclusion',
      language: 'en',
      generatedAt: '2026-04-12T00:00:00.000Z',
      cached: false,
      sources: [],
    });
    ragSummaryService.toPlainText.mockReturnValue('Summary fallback text');

    const result = await service.getDocumentMindMap('doc-1', 'user-1', 'en');

    expect(result.cached).toBe(false);
    expect(result.summary).toBe('Summary fallback text');
    expect(result.mindMap.id).toBe('root');
    expect(result.mindMap.label).toBe('Summary title');
    expect(ragSummaryService.generateSummary).toHaveBeenCalledWith(
      'doc-1',
      'user-1',
      'en',
      false,
    );
    expect(ragArtifactCacheService.saveMindMap).toHaveBeenCalledWith(
      { id: 'doc-1', title: 'Debugging Notes' },
      expect.objectContaining({
        summaryText: 'Summary fallback text',
        summaryLanguage: 'en',
      }),
    );
  });
});
