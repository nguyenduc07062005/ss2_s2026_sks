import { RagSearchExplanationService } from './rag-search-explanation.service';
import type { SearchResultDocument } from './rag-search.service';

describe('RagSearchExplanationService', () => {
  type SearchMatchType = 'title' | 'section' | 'content' | 'meaning';

  const generationService = {
    generateText: jest.fn(),
  };
  let service: RagSearchExplanationService;

  beforeEach(() => {
    jest.clearAllMocks();
    generationService.generateText.mockResolvedValue(
      'This document matches because its title directly matches the search request.',
    );
    service = new RagSearchExplanationService(generationService as never);
  });

  const createSearchDocument = (
    overrides: Partial<SearchResultDocument> = {},
  ): SearchResultDocument => ({
    id: 'doc-1',
    title: 'Reference Report',
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
    matchType: 'title',
    score: 1,
    relevanceLabel: 'Title match',
    matchedConcepts: [],
    matchSnippet: null,
    matchSectionTitle: null,
    matchPageNumber: null,
    matchLabel: 'Title match',
    matchReason:
      'The document title or file name is the closest match for this search.',
    evidenceSnippet: null,
    topics: [],
    ...overrides,
  });

  it('uses an AI-written reason when generation succeeds', async () => {
    const result = await service.enrichSearchReasons(
      [createSearchDocument()],
      'report.pdf',
    );

    expect(generationService.generateText).toHaveBeenCalledTimes(1);
    expect(generationService.generateText).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        maxOutputTokens: 256,
      }),
    );
    expect(result[0].matchReason).toBe(
      'This document matches because its title directly matches the search request.',
    );
  });

  it('generates AI reasons for multiple documents with one batched model call', async () => {
    generationService.generateText.mockResolvedValue(
      JSON.stringify({
        reasons: [
          {
            index: 0,
            reason:
              'This document matches because its title directly matches the search request.',
          },
          {
            index: 1,
            reason:
              'This document matches because its section addresses the searched concept.',
          },
        ],
      }),
    );

    const result = await service.enrichSearchReasons(
      [
        createSearchDocument({ id: 'doc-title' }),
        createSearchDocument({
          id: 'doc-section',
          matchType: 'section',
          matchLabel: 'Section match',
          matchReason: 'A section in this document matches the search request.',
        }),
      ],
      'report.pdf',
    );

    expect(generationService.generateText).toHaveBeenCalledTimes(1);
    expect(generationService.generateText).toHaveBeenCalledWith(
      expect.stringContaining('Results JSON:'),
      expect.objectContaining({
        responseMimeType: 'application/json',
      }),
    );
    expect(result.map((document) => document.matchReason)).toEqual([
      'This document matches because its title directly matches the search request.',
      'This document matches because its section addresses the searched concept.',
    ]);
  });

  it('falls back to the deterministic reason when AI generation fails', async () => {
    generationService.generateText.mockRejectedValue(
      new Error('provider unavailable'),
    );
    const fallbackReason =
      'The document title or file name is the closest match for this search.';

    const result = await service.enrichSearchReasons(
      [createSearchDocument({ matchReason: fallbackReason })],
      'report.pdf',
    );

    expect(result[0].matchReason).toBe(fallbackReason);
  });

  it('falls back to the deterministic reason when AI generation times out', async () => {
    jest.useFakeTimers();

    try {
      generationService.generateText.mockImplementation(
        () => new Promise<string>(() => undefined),
      );
      const fallbackReason =
        'The document title or file name is the closest match for this search.';
      const searchPromise = service.enrichSearchReasons(
        [createSearchDocument({ matchReason: fallbackReason })],
        'report.pdf',
      );

      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(7000);
      const result = await searchPromise;

      expect(result[0].matchReason).toBe(fallbackReason);
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects AI reasons that mention technical internals', async () => {
    generationService.generateText.mockResolvedValue(
      'This result matched because of embedding score and vector retrieval.',
    );
    const fallbackReason =
      'The document discusses ideas that are meaningfully related to the search request.';

    const result = await service.enrichSearchReasons(
      [
        createSearchDocument({
          matchType: 'meaning',
          matchLabel: 'Meaning match',
          matchReason: fallbackReason,
        }),
      ],
      'generic concept query',
    );

    expect(result[0].matchReason).toBe(fallbackReason);
  });

  it.each<SearchMatchType>(['title', 'section', 'content', 'meaning'])(
    'builds a generic fallback reason for %s matches',
    (matchType) => {
      const reason = service.buildFallbackReason({
        matchType,
      });

      expect(reason).not.toContain('"');
      expect(reason).not.toMatch(/\b(?:embedding|vector|score|chunk)\b/i);
    },
  );
});
