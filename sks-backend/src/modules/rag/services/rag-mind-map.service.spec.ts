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

  const representativeChunks: RepresentativeChunk[] = [
    {
      chunkIndex: 0,
      chunkText:
        'Ban chat va dac diem cua chu nghia xa hoi nhan manh giai phong giai cap, dan toc va con nguoi.',
      pageNumber: 1,
      sectionTitle: 'Ban chat va dac diem',
    },
    {
      chunkIndex: 1,
      chunkText:
        'Trong giai doan nay, xa hoi chuyen bien cach mang sau sac de xay dung co so vat chat ky thuat cho chu nghia xa hoi.',
      pageNumber: 2,
      sectionTitle: 'Thoi ky qua do',
    },
    {
      chunkIndex: 2,
      chunkText:
        'Giai cap cong nhan giu vai tro lanh dao thong qua dang cach mang va dinh huong phat trien xa hoi moi.',
      pageNumber: 3,
      sectionTitle: 'Vai tro lanh dao',
    },
    {
      chunkIndex: 3,
      chunkText:
        'Nha nuoc kieu moi dai dien quyen luc cua nhan dan lao dong va to chuc quan ly qua trinh phat trien.',
      pageNumber: 4,
      sectionTitle: 'Nha nuoc moi',
    },
  ];

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

  let service: RagMindMapService;

  beforeEach(() => {
    jest.clearAllMocks();
    ragIndexingService.ensureDocumentIndexed.mockResolvedValue(undefined);
    ragDocumentContextService.ensureOwnedDocument.mockResolvedValue({
      id: 'doc-1',
      title: 'Debugging Notes',
    });
    ragDocumentContextService.getRepresentativeChunks.mockResolvedValue(
      representativeChunks,
    );
    ragDocumentContextService.buildSummaryContext.mockReturnValue(
      'Representative context',
    );
    ragArtifactCacheService.getMindMap.mockReturnValue(null);
    ragArtifactCacheService.saveMindMap.mockResolvedValue(undefined);
    ragStructuredGenerationService.generate.mockResolvedValue({
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
              children: [
                {
                  label: 'Supporting detail',
                  summary: 'Extra supporting note.',
                  children: [],
                },
              ],
            },
          ],
        },
        {
          label: 'Secondary branch',
          summary: 'Another important concept.',
          children: [
            {
              label: 'Evidence',
              summary: 'Evidence and implications.',
              children: [],
            },
          ],
        },
        {
          label: 'Third branch',
          summary: 'A third grounded concept.',
          children: [
            {
              label: 'Example',
              summary: 'A concrete example from the text.',
              children: [],
            },
          ],
        },
      ],
    });

    service = new RagMindMapService(
      ragIndexingService as never,
      ragDocumentContextService as never,
      ragArtifactCacheService as never,
      ragStructuredGenerationService as never,
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
      version: 8,
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
    const result = await service.getDocumentMindMap('doc-1', 'user-1', 'en');

    expect(result.cached).toBe(false);
    expect(result.language).toBe('en');
    expect(result.mindMap.id).toBe('root');
    expect(result.mindMap.label).toBe('Mind map title');
    expect(result.mindMap.children).toHaveLength(3);
    expect(result.mindMap.children[0]).toEqual(
      expect.objectContaining({
        kind: 'cluster',
        label: 'Core branch',
      }),
    );
    expect(result.mindMap.children[0]?.children[0]).toEqual(
      expect.objectContaining({
        kind: 'insight',
        label: 'Key point',
      }),
    );
    expect(result.mindMap.children[0]?.children[0]?.children[0]).toEqual(
      expect.objectContaining({
        kind: 'detail',
        label: 'Supporting detail',
      }),
    );
    expect(result.summary).toContain('Map branches:');
    expect(result.summary).toContain('- Core branch: This is the main idea.');
    expect(ragArtifactCacheService.saveMindMap).toHaveBeenCalledWith(
      { id: 'doc-1', title: 'Debugging Notes' },
      expect.any(Object),
    );
    expect(ragStructuredGenerationService.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        skipJsonSchema: true,
        skipFunctionCalling: true,
      }),
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
    expect(savedMindMap?.version).toBe(8);
  });

  it('regenerates a richer mind map when the cached artifact version is outdated', async () => {
    ragArtifactCacheService.getMindMap.mockReturnValue({
      root: {
        id: 'root',
        label: 'Old cached map',
        summary: 'Old cached summary',
        kind: 'root',
        children: [],
      },
      summaryText: 'Old cached summary',
      summaryLanguage: 'en',
      generatedAt: '2026-04-11T00:00:00.000Z',
      version: 4,
    });
    ragStructuredGenerationService.generate.mockResolvedValue({
      title: 'Refreshed map',
      summary: 'Broader generated overview.',
      branches: [
        {
          label: 'Branch one',
          summary: 'Idea one.',
          children: [
            {
              label: 'Detail one',
              summary: 'Supporting detail.',
              children: [],
            },
          ],
        },
        {
          label: 'Branch two',
          summary: 'Idea two.',
          children: [
            {
              label: 'Detail two',
              summary: 'Another supporting detail.',
              children: [],
            },
          ],
        },
        {
          label: 'Branch three',
          summary: 'Idea three.',
          children: [
            {
              label: 'Detail three',
              summary: 'Third supporting detail.',
              children: [],
            },
          ],
        },
      ],
    });

    const result = await service.getDocumentMindMap('doc-1', 'user-1', 'en');

    expect(result.cached).toBe(false);
    expect(result.mindMap.label).toBe('Refreshed map');
    expect(ragIndexingService.ensureDocumentIndexed).toHaveBeenCalledWith(
      'doc-1',
    );
    expect(ragStructuredGenerationService.generate).toHaveBeenCalled();
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

  it('falls back to source-driven reconstruction when direct generation fails', async () => {
    ragStructuredGenerationService.generate.mockRejectedValue(
      new Error('got status: 429 Too Many Requests'),
    );

    const result = await service.getDocumentMindMap('doc-1', 'user-1', 'vi');

    expect(result.cached).toBe(false);
    expect(result.summary).toContain('Cac nhanh chinh:');
    expect(result.mindMap.id).toBe('root');
    expect(result.mindMap.label).toBe('Debugging Notes');
    expect(result.mindMap.children.length).toBeGreaterThanOrEqual(2);
    expect(ragArtifactCacheService.saveMindMap).toHaveBeenCalledWith(
      { id: 'doc-1', title: 'Debugging Notes' },
      expect.objectContaining({
        summaryLanguage: 'vi',
      }),
    );
  });

  it('rejects weak AI trees and keeps clearer source-driven labels', async () => {
    ragStructuredGenerationService.generate.mockResolvedValue({
      title: 'Generated map',
      summary: 'Overview.',
      branches: [
        {
          label: 'Trong giai doan nay',
          summary:
            'Trong giai doan nay, xa hoi chuyen bien cach mang sau sac de xay dung co so vat chat ky thuat.',
          children: [],
        },
      ],
    });

    const result = await service.getDocumentMindMap('doc-1', 'user-1', 'vi');
    const visibleLabels = result.mindMap.children.flatMap((branch) => [
      branch.label,
      ...branch.children.map((child) => child.label),
    ]);

    expect(result.mindMap.label).toBe('Debugging Notes');
    expect(result.mindMap.children.length).toBeGreaterThanOrEqual(2);
    expect(result.mindMap.children[0]?.label).toBe('Ban chat va dac diem');
    expect(visibleLabels.some((label) => label.includes('xa hoi chuyen bien'))).toBe(
      true,
    );
    expect(visibleLabels).not.toContain('Trong giai doan nay');
  });
});
