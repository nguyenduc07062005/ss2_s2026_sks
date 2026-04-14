import { Injectable } from '@nestjs/common';
import { GeminiService } from 'src/common/llm/gemini.service';
import { RagArtifactCacheService } from './services/rag-artifact-cache.service';
import { RagDocumentContextService } from './services/rag-document-context.service';
import { RagIndexingService } from './services/rag-indexing.service';
import { RagQuestionAnsweringService } from './services/rag-question-answering.service';
import {
  RagSearchService,
  RelatedDocumentsResponse,
  SearchDocumentsResponse,
} from './services/rag-search.service';
import { RagSummaryService } from './services/rag-summary.service';
import {
  AskHistoryItem,
  IndexingResult,
  RagAnswerResponse,
  SummaryLanguage,
} from './types/rag.types';

type DocumentDiagramResponse = {
  diagram: string;
  summary: string;
  cached: boolean;
};

@Injectable()
export class RagService {
  private readonly diagramSummaryLanguage: SummaryLanguage = 'en';

  constructor(
    private readonly geminiService: GeminiService,
    private readonly ragArtifactCacheService: RagArtifactCacheService,
    private readonly ragDocumentContextService: RagDocumentContextService,
    private readonly ragIndexingService: RagIndexingService,
    private readonly ragSummaryService: RagSummaryService,
    private readonly ragQuestionAnsweringService: RagQuestionAnsweringService,
    private readonly ragSearchService: RagSearchService,
  ) {}

  async ensureDocumentIndexed(
    documentId: string,
    options: { force?: boolean } = {},
  ): Promise<IndexingResult> {
    return this.ragIndexingService.ensureDocumentIndexed(documentId, options);
  }

  async askDocument(
    documentId: string,
    ownerId: string,
    question: string,
  ): Promise<RagAnswerResponse & { historyItem: AskHistoryItem }> {
    return this.ragQuestionAnsweringService.askDocument(
      documentId,
      ownerId,
      question,
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

  async getDocumentDiagram(
    documentId: string,
    ownerId: string,
  ): Promise<DocumentDiagramResponse> {
    const document = await this.ragDocumentContextService.ensureOwnedDocument(
      documentId,
      ownerId,
    );
    const cachedDiagram = this.ragArtifactCacheService.getDiagram(document);

    if (cachedDiagram?.mermaid && cachedDiagram.summaryText) {
      return {
        diagram: cachedDiagram.mermaid,
        summary: cachedDiagram.summaryText,
        cached: true,
      };
    }

    const summaryResult = await this.ragSummaryService.generateSummary(
      documentId,
      ownerId,
      this.diagramSummaryLanguage,
    );
    const summaryText = this.ragSummaryService.toPlainText(summaryResult);
    const diagramPrompt = [
      'You convert a document summary into a Mermaid flowchart.',
      'Return Mermaid code only.',
      'Do not wrap the output in markdown fences.',
      'Prefer a top-down flowchart with 4 to 8 nodes.',
      'Keep labels short and academic.',
      '',
      `Document title: ${document.title ?? documentId}`,
      'Summary:',
      summaryText,
    ].join('\n');

    const rawDiagram = await this.geminiService.generateText(diagramPrompt);
    const diagram = this.normalizeMermaid(rawDiagram);

    await this.ragArtifactCacheService.saveDiagram(document, {
      mermaid: diagram,
      summaryText,
      generatedAt: new Date().toISOString(),
      summaryLanguage: summaryResult.language,
    });

    return {
      diagram,
      summary: summaryText,
      cached: false,
    };
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

  private normalizeMermaid(rawDiagram: string): string {
    const trimmed = rawDiagram.trim();
    const withoutFence = trimmed
      .replace(/^```mermaid\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    if (withoutFence.startsWith('flowchart')) {
      return withoutFence;
    }

    if (withoutFence.startsWith('graph')) {
      return withoutFence;
    }

    return ['flowchart TD', withoutFence].join('\n');
  }
}
