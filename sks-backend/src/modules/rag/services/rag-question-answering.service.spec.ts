import { BadRequestException } from '@nestjs/common';
import { RagQuestionAnsweringService } from './rag-question-answering.service';

describe('RagQuestionAnsweringService', () => {
  const dataSource = {
    query: jest.fn<Promise<unknown[]>, [string, unknown[]]>(),
  };
  const geminiService = {
    createEmbedding: jest.fn<Promise<number[]>, [string]>(),
  };
  const generationService = {
    generateText: jest.fn<Promise<string>, [string]>(),
  };
  const documentAskHistoryRepository = {
    create: jest.fn<Promise<unknown>, [unknown]>(),
    findByUserAndDocument: jest.fn<Promise<unknown[]>, [string, string]>(),
    findRecentByUserAndDocument: jest.fn<
      Promise<unknown[]>,
      [string, string, number]
    >(),
    trimToLatestByUserAndDocument: jest.fn<
      Promise<number>,
      [string, string, number]
    >(),
    clearByUserAndDocument: jest.fn<Promise<number>, [string, string]>(),
  };
  const ragDocumentContextService = {
    ensureOwnedDocument: jest.fn<Promise<unknown>, [string, string]>(),
  };
  const ragIndexingService = {
    ensureDocumentIndexed: jest.fn<Promise<void>, [string]>(),
  };

  let service: RagQuestionAnsweringService;

  beforeEach(() => {
    jest.clearAllMocks();
    geminiService.createEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    generationService.generateText.mockResolvedValue('Answer from model   ');
    dataSource.query.mockResolvedValue([
      {
        documentId: 'doc-1',
        documentName: 'Sample Document',
        chunkIndex: 0,
        pageNumber: 1,
        snippet: 'Relevant snippet',
        chunkText:
          'Relevant chunk text with enough document evidence to support a grounded answer from the current document.',
        score: 0.91234,
      },
    ]);
    ragDocumentContextService.ensureOwnedDocument.mockResolvedValue({
      id: 'doc-1',
      title: 'Sample Document',
    });
    ragIndexingService.ensureDocumentIndexed.mockResolvedValue(undefined);
    documentAskHistoryRepository.create.mockImplementation((entry) =>
      Promise.resolve({
        id: 'history-1',
        question:
          typeof entry === 'object' &&
          entry !== null &&
          'question' in entry &&
          typeof entry.question === 'string'
            ? entry.question
            : 'What is this?',
        answer:
          typeof entry === 'object' &&
          entry !== null &&
          'answer' in entry &&
          typeof entry.answer === 'string'
            ? entry.answer
            : 'Answer from model',
        sources:
          typeof entry === 'object' && entry !== null && 'sources' in entry
            ? entry.sources
            : [],
        createdAt: new Date('2026-04-13T00:00:00.000Z'),
      }),
    );
    documentAskHistoryRepository.findByUserAndDocument.mockResolvedValue([]);
    documentAskHistoryRepository.findRecentByUserAndDocument.mockResolvedValue(
      [],
    );
    documentAskHistoryRepository.trimToLatestByUserAndDocument.mockResolvedValue(
      0,
    );
    documentAskHistoryRepository.clearByUserAndDocument.mockResolvedValue(0);

    service = new RagQuestionAnsweringService(
      dataSource as never,
      geminiService as never,
      generationService as never,
      documentAskHistoryRepository as never,
      ragDocumentContextService as never,
      ragIndexingService as never,
    );
  });

  it('rejects a blank question before touching document state', async () => {
    await expect(
      service.askDocument('doc-1', 'user-1', '   '),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(
      ragDocumentContextService.ensureOwnedDocument,
    ).not.toHaveBeenCalled();
    expect(ragIndexingService.ensureDocumentIndexed).not.toHaveBeenCalled();
    expect(documentAskHistoryRepository.create).not.toHaveBeenCalled();
  });

  it('answers a question and stores the normalized history entry', async () => {
    documentAskHistoryRepository.findRecentByUserAndDocument.mockResolvedValue([
      {
        id: 'history-0',
        question: 'Previous question',
        answer: 'Previous answer with **keyword** emphasis.',
        sources: [],
        createdAt: new Date('2026-04-12T00:00:00.000Z'),
      },
    ]);

    const result = await service.askDocument(
      'doc-1',
      'user-1',
      '  What is this?  ',
    );

    expect(ragDocumentContextService.ensureOwnedDocument).toHaveBeenCalledWith(
      'doc-1',
      'user-1',
    );
    expect(ragIndexingService.ensureDocumentIndexed).toHaveBeenCalledWith(
      'doc-1',
    );
    expect(geminiService.createEmbedding).toHaveBeenCalledWith('What is this?');
    expect(generationService.generateText).toHaveBeenCalled();
    expect(
      documentAskHistoryRepository.findRecentByUserAndDocument,
    ).toHaveBeenCalledWith('user-1', 'doc-1', 4);
    expect(documentAskHistoryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        question: 'What is this?',
        answer: 'Answer from model',
        sources: [
          {
            documentId: 'doc-1',
            documentName: 'Sample Document',
            chunkIndex: 0,
            pageNumber: 1,
            snippet: 'Relevant snippet',
            score: 0.9123,
          },
        ],
      }),
    );
    expect(
      documentAskHistoryRepository.trimToLatestByUserAndDocument,
    ).toHaveBeenCalledWith('user-1', 'doc-1', 6);
    expect(generationService.generateText).toHaveBeenCalledWith(
      expect.stringContaining('Recent conversation'),
    );
    expect(generationService.generateText).toHaveBeenCalledWith(
      expect.stringContaining('User: Previous question'),
    );
    expect(generationService.generateText).toHaveBeenCalledWith(
      expect.stringContaining(
        'Assistant: Previous answer with **keyword** emphasis.',
      ),
    );
    expect(generationService.generateText).toHaveBeenCalledWith(
      expect.stringContaining('Format the answer in clean Markdown.'),
    );
    expect(generationService.generateText).toHaveBeenCalledWith(
      expect.stringContaining(
        'Answer using ONLY the provided document context.',
      ),
    );
    expect(generationService.generateText).toHaveBeenCalledWith(
      expect.not.stringContaining(
        'You may use your general knowledge to answer the user.',
      ),
    );
    expect(result).toEqual({
      answer: 'Answer from model',
      sources: [
        {
          documentId: 'doc-1',
          documentName: 'Sample Document',
          chunkIndex: 0,
          pageNumber: 1,
          snippet: 'Relevant snippet',
          score: 0.9123,
        },
      ],
      historyItem: {
        id: 'history-1',
        question: 'What is this?',
        answer: 'Answer from model',
        sources: [
          {
            documentId: 'doc-1',
            documentName: 'Sample Document',
            chunkIndex: 0,
            pageNumber: 1,
            snippet: 'Relevant snippet',
            score: 0.9123,
          },
        ],
        createdAt: '2026-04-13T00:00:00.000Z',
      },
    });
  });

  it('does not call the text model in strict mode when retrieved evidence is weak', async () => {
    dataSource.query.mockResolvedValue([
      {
        documentId: 'doc-1',
        documentName: 'Sample Document',
        chunkIndex: 0,
        pageNumber: 1,
        snippet: 'Weak snippet',
        chunkText: 'Weak chunk text',
        score: 0.2,
      },
    ]);

    const result = await service.askDocument(
      'doc-1',
      'user-1',
      'What does the document say about this?',
    );

    expect(geminiService.createEmbedding).toHaveBeenCalledWith(
      'What does the document say about this?',
    );
    expect(generationService.generateText).not.toHaveBeenCalled();
    expect(documentAskHistoryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        question: 'What does the document say about this?',
        answer:
          'The document context is not sufficient to answer this question with reliable evidence.',
        sources: [],
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        answer:
          'The document context is not sufficient to answer this question with reliable evidence.',
        sources: [],
      }),
    );
  });

  it('answers in document assisted mode with separated document and general knowledge instructions', async () => {
    await service.askDocument(
      'doc-1',
      'user-1',
      'Can you expand this with background?',
      'document_assisted',
    );

    expect(generationService.generateText).toHaveBeenCalledWith(
      expect.stringContaining('Use the document context first.'),
    );
    expect(generationService.generateText).toHaveBeenCalledWith(
      expect.stringContaining(
        'You may add general knowledge only after clearly separating it from document-grounded facts.',
      ),
    );
    expect(generationService.generateText).toHaveBeenCalledWith(
      expect.stringContaining(
        'Relevant chunk text with enough document evidence',
      ),
    );
  });

  it('answers in general chat mode without indexing or retrieving document chunks', async () => {
    const result = await service.askDocument(
      'doc-1',
      'user-1',
      'Explain spaced repetition in general.',
      'general_chat',
    );

    expect(ragDocumentContextService.ensureOwnedDocument).toHaveBeenCalledWith(
      'doc-1',
      'user-1',
    );
    expect(ragIndexingService.ensureDocumentIndexed).not.toHaveBeenCalled();
    expect(geminiService.createEmbedding).not.toHaveBeenCalled();
    expect(dataSource.query).not.toHaveBeenCalled();
    expect(generationService.generateText).toHaveBeenCalledWith(
      expect.stringContaining(
        'Answer as a general assistant. Document context is not required.',
      ),
    );
    expect(result.sources).toEqual([]);
  });

  it('maps ask history items from the repository', async () => {
    documentAskHistoryRepository.findRecentByUserAndDocument.mockResolvedValue([
      {
        id: 'history-2',
        question: 'Second question',
        answer: 'Second answer',
        sources: [
          {
            documentId: 'doc-1',
            documentName: 'Sample Document',
            chunkIndex: 2,
            pageNumber: 3,
            snippet: 'Another snippet',
            score: 0.5,
          },
        ],
        createdAt: new Date('2026-04-13T00:00:00.000Z'),
      },
      {
        id: 'history-1',
        question: 'First question',
        answer: 'First answer',
        sources: null,
        createdAt: new Date('2026-04-12T00:00:00.000Z'),
      },
    ]);

    const items = await service.getDocumentAskHistory('doc-1', 'user-1');

    expect(ragDocumentContextService.ensureOwnedDocument).toHaveBeenCalledWith(
      'doc-1',
      'user-1',
    );
    expect(
      documentAskHistoryRepository.findRecentByUserAndDocument,
    ).toHaveBeenCalledWith('user-1', 'doc-1', 6);
    expect(items).toEqual([
      {
        id: 'history-1',
        question: 'First question',
        answer: 'First answer',
        sources: [],
        createdAt: '2026-04-12T00:00:00.000Z',
      },
      {
        id: 'history-2',
        question: 'Second question',
        answer: 'Second answer',
        sources: [
          {
            documentId: 'doc-1',
            documentName: 'Sample Document',
            chunkIndex: 2,
            pageNumber: 3,
            snippet: 'Another snippet',
            score: 0.5,
          },
        ],
        createdAt: '2026-04-13T00:00:00.000Z',
      },
    ]);
  });

  it('falls back to the legacy history query when the recent-history query fails', async () => {
    documentAskHistoryRepository.findRecentByUserAndDocument.mockRejectedValue(
      new Error('recent query failed'),
    );
    documentAskHistoryRepository.findByUserAndDocument.mockResolvedValue([
      {
        id: 'history-1',
        question: 'First question',
        answer: 'First answer',
        sources: null,
        createdAt: new Date('2026-04-12T00:00:00.000Z'),
      },
      {
        id: 'history-2',
        question: 'Second question',
        answer: 'Second answer',
        sources: null,
        createdAt: new Date('2026-04-13T00:00:00.000Z'),
      },
    ]);

    const result = await service.askDocument(
      'doc-1',
      'user-1',
      'Explain the notes',
    );

    expect(
      documentAskHistoryRepository.findByUserAndDocument,
    ).toHaveBeenCalledWith('user-1', 'doc-1');
    expect(generationService.generateText).toHaveBeenCalledWith(
      expect.stringContaining('User: First question'),
    );
    expect(generationService.generateText).toHaveBeenCalledWith(
      expect.stringContaining('Assistant: Second answer'),
    );
    expect(result.answer).toBe('Answer from model');
  });

  it('clears ask history after validating document ownership', async () => {
    documentAskHistoryRepository.clearByUserAndDocument.mockResolvedValue(3);

    const cleared = await service.clearDocumentAskHistory('doc-1', 'user-1');

    expect(ragDocumentContextService.ensureOwnedDocument).toHaveBeenCalledWith(
      'doc-1',
      'user-1',
    );
    expect(
      documentAskHistoryRepository.clearByUserAndDocument,
    ).toHaveBeenCalledWith('user-1', 'doc-1');
    expect(cleared).toBe(3);
  });
});
