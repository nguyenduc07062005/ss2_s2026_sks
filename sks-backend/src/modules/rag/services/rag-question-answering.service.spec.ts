import { BadRequestException } from '@nestjs/common';
import { RagQuestionAnsweringService } from './rag-question-answering.service';

describe('RagQuestionAnsweringService', () => {
  const dataSource = {
    query: jest.fn<Promise<unknown[]>, [string, unknown[]]>(),
  };
  const geminiService = {
    createEmbedding: jest.fn<Promise<number[]>, [string]>(),
    generateText: jest.fn<Promise<string>, [string]>(),
  };
  const documentAskHistoryRepository = {
    create: jest.fn<Promise<unknown>, [unknown]>(),
    findByUserAndDocument: jest.fn<Promise<unknown[]>, [string, string]>(),
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
    geminiService.generateText.mockResolvedValue('Answer from model   ');
    dataSource.query.mockResolvedValue([
      {
        documentId: 'doc-1',
        documentName: 'Debugging Notes',
        chunkIndex: 0,
        pageNumber: 1,
        snippet: 'Relevant snippet',
        chunkText: 'Relevant chunk text',
        score: 0.91234,
      },
    ]);
    ragDocumentContextService.ensureOwnedDocument.mockResolvedValue({
      id: 'doc-1',
      title: 'Debugging Notes',
    });
    ragIndexingService.ensureDocumentIndexed.mockResolvedValue(undefined);
    documentAskHistoryRepository.create.mockResolvedValue({
      id: 'history-1',
      question: 'What is this?',
      answer: 'Answer from model',
      sources: [
        {
          documentId: 'doc-1',
          documentName: 'Debugging Notes',
          chunkIndex: 0,
          pageNumber: 1,
          snippet: 'Relevant snippet',
          score: 0.9123,
        },
      ],
      createdAt: new Date('2026-04-13T00:00:00.000Z'),
    });
    documentAskHistoryRepository.findByUserAndDocument.mockResolvedValue([]);
    documentAskHistoryRepository.clearByUserAndDocument.mockResolvedValue(0);

    service = new RagQuestionAnsweringService(
      dataSource as never,
      geminiService as never,
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
    expect(geminiService.generateText).toHaveBeenCalled();
    expect(documentAskHistoryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        question: 'What is this?',
        answer: 'Answer from model',
        sources: [
          {
            documentId: 'doc-1',
            documentName: 'Debugging Notes',
            chunkIndex: 0,
            pageNumber: 1,
            snippet: 'Relevant snippet',
            score: 0.9123,
          },
        ],
      }),
    );
    expect(result).toEqual({
      answer: 'Answer from model',
      sources: [
        {
          documentId: 'doc-1',
          documentName: 'Debugging Notes',
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
            documentName: 'Debugging Notes',
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

  it('maps ask history items from the repository', async () => {
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
        sources: [
          {
            documentId: 'doc-1',
            documentName: 'Debugging Notes',
            chunkIndex: 2,
            pageNumber: 3,
            snippet: 'Another snippet',
            score: 0.5,
          },
        ],
        createdAt: new Date('2026-04-13T00:00:00.000Z'),
      },
    ]);

    const items = await service.getDocumentAskHistory('doc-1', 'user-1');

    expect(ragDocumentContextService.ensureOwnedDocument).toHaveBeenCalledWith(
      'doc-1',
      'user-1',
    );
    expect(
      documentAskHistoryRepository.findByUserAndDocument,
    ).toHaveBeenCalledWith('user-1', 'doc-1');
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
            documentName: 'Debugging Notes',
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
