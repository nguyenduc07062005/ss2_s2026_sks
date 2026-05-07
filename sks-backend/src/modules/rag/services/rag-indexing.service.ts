import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { GeminiService } from 'src/common/llm/gemini.service';
import { Chunk } from 'src/database/entities/chunks.entity';
import { Document } from 'src/database/entities/document.entity';
import { ChunkRepository } from 'src/database/repositories/chunks.repository';
import { DocumentRepository } from 'src/database/repositories/document.repository';
import { IndexingResult } from '../types/rag.types';
import {
  EMBEDDING_BATCH_SIZE,
  EMBEDDING_DIMENSION,
  EMBEDDING_MODEL,
} from '../constants';
import { toVectorSql } from '../shared-rag.util';

const INDEXING_WAIT_TIMEOUT_MS = 20_000;
const INDEXING_WAIT_INTERVAL_MS = 1_000;

export type EnsureDocumentIndexedOptions = {
  force?: boolean;
  waitIfIndexing?: boolean;
  waitTimeoutMs?: number;
  waitIntervalMs?: number;
};

@Injectable()
export class RagIndexingService {
  private readonly logger = new Logger(RagIndexingService.name);

  constructor(
    private readonly geminiService: GeminiService,
    private readonly documentRepository: DocumentRepository,
    private readonly chunkRepository: ChunkRepository,
  ) {}

  /**
   * Called lazily when a RAG feature is requested by the user.
   *
   * - If status = 'indexed' → return immediately (no-op).
   * - If status = 'indexing' → throw 409 unless waitIfIndexing is enabled.
   * - If status = 'processed' → do inline sequential indexing and wait.
   * - force = true → always re-index regardless of status.
   */
  async ensureDocumentIndexed(
    documentId: string,
    options: EnsureDocumentIndexedOptions = {},
  ): Promise<IndexingResult> {
    let document = await this.loadDocument(documentId);
    const force = options.force ?? false;

    if (document.status === 'indexing' && !force && options.waitIfIndexing) {
      document = await this.waitForBackgroundIndexing(documentId, options);
    }

    if (document.status === 'indexed' && !force) {
      return this.buildIndexingResult(document);
    }

    if (document.status === 'indexing' && !force) {
      throw new ConflictException(
        'Document is currently being indexed. Please wait a moment and try again.',
      );
    }

    return this.runSequential(document, force);
  }

  /**
   * Called by RagIndexingQueueService after upload.
   * Uses parallel batch embedding — much faster than sequential.
   * Does NOT throw 409; designed to be called exactly once per upload.
   */
  async indexDocumentBackground(
    documentId: string,
    options: { force?: boolean } = {},
  ): Promise<IndexingResult> {
    const document = await this.loadDocument(documentId);
    const force = options.force ?? false;

    if (document.status === 'indexed' && !force) {
      const indexedCount =
        document.chunks?.filter((c) => c.embedding).length ?? 0;
      return {
        documentId,
        indexedChunks: indexedCount,
        totalChunks: document.chunks?.length ?? 0,
      };
    }

    return this.runParallelBatched(document, force);
  }

  getEmbeddingDimension(): number {
    return EMBEDDING_DIMENSION;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async loadDocument(
    documentId: string,
  ): Promise<Document & { chunks: Chunk[] }> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
      relations: ['chunks'],
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document as Document & { chunks: Chunk[] };
  }

  private buildIndexingResult(
    document: Document & { chunks: Chunk[] },
  ): IndexingResult {
    const indexedCount =
      document.chunks?.filter((chunk) => Boolean(chunk.embedding)).length ?? 0;

    return {
      documentId: document.id,
      indexedChunks: indexedCount,
      totalChunks: document.chunks?.length ?? 0,
    };
  }

  private async waitForBackgroundIndexing(
    documentId: string,
    options: EnsureDocumentIndexedOptions,
  ): Promise<Document & { chunks: Chunk[] }> {
    const timeoutMs = Math.max(
      options.waitTimeoutMs ?? INDEXING_WAIT_TIMEOUT_MS,
      0,
    );
    const intervalMs = Math.max(
      options.waitIntervalMs ?? INDEXING_WAIT_INTERVAL_MS,
      100,
    );
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      await this.sleep(intervalMs);

      const document = await this.loadDocument(documentId);

      if (document.status !== 'indexing') {
        return document;
      }
    }

    return this.loadDocument(documentId);
  }

  private async sleep(durationMs: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, durationMs));
  }

  /**
   * Sequential indexing — preserves original behavior for lazy (inline) mode.
   */
  private async runSequential(
    document: Document & { chunks: Chunk[] },
    force: boolean,
  ): Promise<IndexingResult> {
    const { id: documentId } = document;
    const chunks = this.sortedChunks(document.chunks);

    if (chunks.length === 0) {
      await this.updateDocumentStatus(documentId, 'processed');
      return { documentId, indexedChunks: 0, totalChunks: 0 };
    }

    await this.updateDocumentStatus(documentId, 'indexing');
    let indexedChunks = 0;

    try {
      for (const chunk of chunks) {
        if (!force && chunk.embedding) {
          indexedChunks += 1;
          continue;
        }

        const embeddingValues = await this.geminiService.createEmbedding(
          chunk.chunkText,
        );
        chunk.embedding = toVectorSql(embeddingValues);
        chunk.embeddingModel = EMBEDDING_MODEL;
        await this.chunkRepository.getRepository().save(chunk);
        indexedChunks += 1;
      }

      await this.updateDocumentStatus(documentId, 'indexed');
      return { documentId, indexedChunks, totalChunks: chunks.length };
    } catch (error) {
      this.logger.error(
        `Inline indexing failed for document ${documentId}`,
        error instanceof Error ? error.stack : undefined,
      );
      await this.updateDocumentStatus(documentId, 'processed');
      throw error;
    }
  }

  /**
   * Parallel batch indexing — used by background queue for speed.
   * Embeds EMBEDDING_BATCH_SIZE chunks concurrently, then bulk-saves each batch.
   */
  private async runParallelBatched(
    document: Document & { chunks: Chunk[] },
    force: boolean,
  ): Promise<IndexingResult> {
    const { id: documentId } = document;
    const chunks = this.sortedChunks(document.chunks);

    if (chunks.length === 0) {
      await this.updateDocumentStatus(documentId, 'processed');
      return { documentId, indexedChunks: 0, totalChunks: 0 };
    }

    const toIndex = force ? chunks : chunks.filter((c) => !c.embedding);
    const alreadyIndexed = chunks.length - toIndex.length;

    if (toIndex.length === 0) {
      await this.updateDocumentStatus(documentId, 'indexed');
      return {
        documentId,
        indexedChunks: alreadyIndexed,
        totalChunks: chunks.length,
      };
    }

    await this.updateDocumentStatus(documentId, 'indexing');

    try {
      const batchSize = EMBEDDING_BATCH_SIZE;
      const totalBatches = Math.ceil(toIndex.length / batchSize);

      for (let i = 0; i < toIndex.length; i += batchSize) {
        const batch = toIndex.slice(i, i + batchSize);

        // Embed all chunks in the batch in parallel
        await Promise.all(
          batch.map(async (chunk) => {
            const embeddingValues = await this.geminiService.createEmbedding(
              chunk.chunkText,
            );
            chunk.embedding = toVectorSql(embeddingValues);
            chunk.embeddingModel = EMBEDDING_MODEL;
          }),
        );

        // Bulk-save the entire batch in one DB round-trip
        await this.chunkRepository.getRepository().save(batch);

        this.logger.debug(
          `Document ${documentId}: batch ${Math.floor(i / batchSize) + 1}/${totalBatches} indexed`,
        );
      }

      await this.updateDocumentStatus(documentId, 'indexed');
      return {
        documentId,
        indexedChunks: chunks.length,
        totalChunks: chunks.length,
      };
    } catch (error) {
      this.logger.error(
        `Background indexing failed for document ${documentId}`,
        error instanceof Error ? error.stack : undefined,
      );
      await this.updateDocumentStatus(documentId, 'processed');
      throw error;
    }
  }

  private sortedChunks(chunks: Chunk[] | undefined): Chunk[] {
    return [...(chunks ?? [])].sort((a, b) => a.chunkIndex - b.chunkIndex);
  }

  private async updateDocumentStatus(
    documentId: string,
    status: Document['status'],
  ): Promise<void> {
    await this.documentRepository.getRepository().update(documentId, {
      status,
    });
  }
}
