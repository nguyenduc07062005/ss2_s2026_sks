import { RagContextBuilderService } from './rag-context-builder.service';

type RepresentativeChunk = {
  chunkIndex: number;
  chunkText: string;
  pageNumber: number | null;
  sectionTitle: string | null;
};

describe('RagContextBuilderService', () => {
  const chunks: RepresentativeChunk[] = [
    {
      chunkIndex: 0,
      chunkText:
        'Foundational concept explains the problem, important causes, and expected effects.',
      pageNumber: 1,
      sectionTitle: 'Foundations',
    },
    {
      chunkIndex: 1,
      chunkText:
        'Applied workflow connects the concept with examples, practice steps, and review tasks.',
      pageNumber: 2,
      sectionTitle: 'Application',
    },
    {
      chunkIndex: 2,
      chunkText:
        'Evaluation criteria describe how learners compare outcomes and refine their understanding.',
      pageNumber: 3,
      sectionTitle: 'Evaluation',
    },
  ];

  const ragDocumentContextService = {
    ensureOwnedDocument: jest.fn<Promise<unknown>, [string, string]>(),
    getRepresentativeChunks: jest.fn<
      Promise<RepresentativeChunk[]>,
      [string, number]
    >(),
    getRelevantChunks: jest.fn<
      Promise<RepresentativeChunk[]>,
      [string, string, number]
    >(),
    buildSummaryContext: jest.fn<string, [RepresentativeChunk[]]>(),
  };

  let service: RagContextBuilderService;

  beforeEach(() => {
    jest.clearAllMocks();
    ragDocumentContextService.ensureOwnedDocument.mockResolvedValue({});
    ragDocumentContextService.getRepresentativeChunks.mockResolvedValue(chunks);
    ragDocumentContextService.getRelevantChunks.mockResolvedValue(chunks);
    ragDocumentContextService.buildSummaryContext.mockImplementation(
      (inputChunks) =>
        inputChunks
          .map((chunk) => `[${chunk.sectionTitle}] ${chunk.chunkText}`)
          .join('\n\n'),
    );

    service = new RagContextBuilderService(ragDocumentContextService as never);
  });

  it('builds summary context from representative chunks', async () => {
    const result = await service.buildSummaryContext('doc-1');

    expect(
      ragDocumentContextService.getRepresentativeChunks,
    ).toHaveBeenCalledWith('doc-1', 18);
    expect(result.chunks).toEqual(chunks);
    expect(result.text).toContain('Foundational concept');
  });

  it('builds study gps context with a learning structure', async () => {
    const result = await service.buildStudyGpsContext([
      { id: 'doc-1', title: 'Learning Document' },
    ]);

    expect(
      ragDocumentContextService.getRepresentativeChunks,
    ).toHaveBeenCalledWith('doc-1', 10);
    expect(result.meta.learningStructure.documents[0]).toEqual(
      expect.objectContaining({
        id: 'doc-1',
        title: 'Learning Document',
        sections: ['Foundations', 'Application', 'Evaluation'],
      }),
    );
    expect(result.text).toContain('Learning structure');
    expect(result.text).toContain('Important excerpts');
  });

  it('builds qa context with evidence quality metadata', async () => {
    const result = await service.buildQaContext({
      ownerId: 'user-1',
      question: 'How should I apply the concept?',
      documentIds: ['doc-1'],
      limit: 2,
    });

    expect(ragDocumentContextService.getRelevantChunks).toHaveBeenCalledWith(
      'doc-1',
      'How should I apply the concept?',
      2,
    );
    expect(ragDocumentContextService.ensureOwnedDocument).toHaveBeenCalledWith(
      'doc-1',
      'user-1',
    );
    expect(result.chunks).toHaveLength(3);
    expect(result.meta.evidenceQuality).toBe('usable');
  });

  it('returns empty qa context when no document scope is provided', async () => {
    const result = await service.buildQaContext({
      ownerId: 'user-1',
      question: 'General question',
    });

    expect(ragDocumentContextService.getRelevantChunks).not.toHaveBeenCalled();
    expect(result).toEqual({
      text: '',
      chunks: [],
      meta: { evidenceQuality: 'none' },
    });
  });
});
