import { ConflictException } from '@nestjs/common';
import { RagIndexingService } from './rag-indexing.service';

describe('RagIndexingService', () => {
  const geminiService = {
    createEmbedding: jest.fn<Promise<number[]>, [string]>(),
  };
  const documentRepository = {
    findOne: jest.fn<Promise<unknown>, [unknown]>(),
    getRepository: jest.fn(),
  };
  const chunkRepository = {
    getRepository: jest.fn(),
  };
  const documentOrmRepository = {
    update: jest.fn<Promise<void>, [string, unknown]>(),
  };
  const chunkOrmRepository = {
    save: jest.fn<Promise<unknown>, [unknown]>(),
  };

  let service: RagIndexingService;

  beforeEach(() => {
    jest.resetAllMocks();

    documentRepository.getRepository.mockReturnValue(documentOrmRepository);
    chunkRepository.getRepository.mockReturnValue(chunkOrmRepository);

    service = new RagIndexingService(
      geminiService as never,
      documentRepository as never,
      chunkRepository as never,
    );
  });

  it('keeps existing 409 behavior for documents already being indexed', async () => {
    documentRepository.findOne.mockResolvedValue({
      id: 'doc-1',
      status: 'indexing',
      chunks: [],
    });

    await expect(service.ensureDocumentIndexed('doc-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(geminiService.createEmbedding).not.toHaveBeenCalled();
  });

  it('waits for background indexing when waitIfIndexing is enabled', async () => {
    documentRepository.findOne
      .mockResolvedValueOnce({
        id: 'doc-1',
        status: 'indexing',
        chunks: [],
      })
      .mockResolvedValueOnce({
        id: 'doc-1',
        status: 'indexed',
        chunks: [{ id: 'chunk-1', embedding: '[0.1,0.2]' }],
      });

    const result = await service.ensureDocumentIndexed('doc-1', {
      waitIfIndexing: true,
      waitTimeoutMs: 50,
      waitIntervalMs: 1,
    });

    expect(result).toEqual({
      documentId: 'doc-1',
      indexedChunks: 1,
      totalChunks: 1,
    });
    expect(documentRepository.findOne).toHaveBeenCalledTimes(2);
    expect(geminiService.createEmbedding).not.toHaveBeenCalled();
    expect(documentOrmRepository.update).not.toHaveBeenCalled();
  });
});
