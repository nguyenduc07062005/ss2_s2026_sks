import { Injectable } from '@nestjs/common';
import {
  EnsureDocumentIndexedOptions,
  RagIndexingService,
} from './services/rag-indexing.service';
import { RagQuestionAnsweringService } from './services/rag-question-answering.service';
import {
  RagSearchService,
  RelatedDocumentsResponse,
  SearchDocumentsResponse,
} from './services/rag-search.service';
import {
  AskHistoryItem,
  IndexingResult,
  RagAnswerResponse,
} from './types/rag.types';
import type { RagAskMode } from './dtos/ask-rag.dto';

@Injectable()
export class RagService {
  constructor(
    private readonly ragIndexingService: RagIndexingService,
    private readonly ragQuestionAnsweringService: RagQuestionAnsweringService,
    private readonly ragSearchService: RagSearchService,
  ) {}

  async ensureDocumentIndexed(
    documentId: string,
    options: EnsureDocumentIndexedOptions = {},
  ): Promise<IndexingResult> {
    return this.ragIndexingService.ensureDocumentIndexed(documentId, options);
  }

  async askDocument(
    documentId: string,
    ownerId: string,
    question: string,
    mode: RagAskMode = 'document_strict',
  ): Promise<RagAnswerResponse & { historyItem: AskHistoryItem }> {
    return this.ragQuestionAnsweringService.askDocument(
      documentId,
      ownerId,
      question,
      mode,
    );
  }

  async getDocumentAskHistory(
    documentId: string,
    ownerId: string,
  ): Promise<AskHistoryItem[]> {
    return this.ragQuestionAnsweringService.getDocumentAskHistory(
      documentId,
      ownerId,
    );
  }

  async clearDocumentAskHistory(
    documentId: string,
    ownerId: string,
  ): Promise<number> {
    return this.ragQuestionAnsweringService.clearDocumentAskHistory(
      documentId,
      ownerId,
    );
  }

  async searchDocuments(
    query: string,
    ownerId: string,
    options: {
      folderId?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<SearchDocumentsResponse> {
    return this.ragSearchService.searchDocuments(query, ownerId, options);
  }

  async getRelatedDocuments(
    documentId: string,
    ownerId: string,
    limit?: number,
  ): Promise<RelatedDocumentsResponse> {
    return this.ragSearchService.getRelatedDocuments(
      documentId,
      ownerId,
      limit,
    );
  }

  getEmbeddingDimension(): number {
    return this.ragIndexingService.getEmbeddingDimension();
  }
}
