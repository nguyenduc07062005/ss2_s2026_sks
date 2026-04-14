import { BadRequestException, Injectable } from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';
import pgvector from 'pgvector';
import { DataSource } from 'typeorm';
import { GeminiService } from 'src/common/llm/gemini.service';
import { DocumentAskHistory } from 'src/database/entities/document-ask-history.entity';
import { DocumentAskHistoryRepository } from 'src/database/repositories/document-ask-history.repository';
import { RagDocumentContextService } from './rag-document-context.service';
import { RagIndexingService } from './rag-indexing.service';
import {
  AskHistoryItem,
  RagAnswerResponse,
  RagSource,
} from '../types/rag.types';

const DEFAULT_RETRIEVAL_LIMIT = 8;
const SOURCE_SNIPPET_LENGTH = 280;

const ANSWER_PROMPT = [
  'You are a helpful AI assistant inside a document workspace.',
  'Respond naturally, like a real chat assistant, not like a rigid template.',
  'You may use your general knowledge to answer the user.',
  'If the optional document context is relevant, use it as additional knowledge and blend it naturally into the answer.',
  'If the optional document context is not relevant, ignore it.',
  'If the user is clearly asking about the current document but the provided context is too weak, say that naturally without using formulaic refusal wording.',
  'Do not mention internal prompting, retrieval, or hidden context unless the user asks.',
  'Reply in the same language as the user question.',
  'Current date in Asia/Saigon: {currentDate}.',
  'Current time in Asia/Saigon: {currentTime}.',
  'Workspace scope: {scopeLabel}.',
  '',
  'Question:',
  '{question}',
  '',
  'Optional document context:',
  '{context}',
].join('\n');

type RetrievalScope = {
  scopedFolderId: string | null;
};

type RetrievedChunkRow = {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  pageNumber: number | null;
  snippet: string;
  chunkText: string;
  score: number;
};

type RawRow = Record<string, unknown>;

@Injectable()
export class RagQuestionAnsweringService {
  private readonly answerPrompt = PromptTemplate.fromTemplate(ANSWER_PROMPT);

  constructor(
    private readonly dataSource: DataSource,
    private readonly geminiService: GeminiService,
    private readonly documentAskHistoryRepository: DocumentAskHistoryRepository,
    private readonly ragDocumentContextService: RagDocumentContextService,
    private readonly ragIndexingService: RagIndexingService,
  ) {}

  async askDocument(
    documentId: string,
    ownerId: string,
    question: string,
  ): Promise<RagAnswerResponse & { historyItem: AskHistoryItem }> {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      throw new BadRequestException('Question is required');
    }

    await this.ragDocumentContextService.ensureOwnedDocument(
      documentId,
      ownerId,
    );
    await this.ragIndexingService.ensureDocumentIndexed(documentId);

    const result = await this.answerFromRelevantChunks(
      trimmedQuestion,
      ownerId,
      { scopedFolderId: null },
      {
        documentId,
        scopeLabel: `Document ${documentId}`,
      },
    );

    const historyEntry = await this.documentAskHistoryRepository.create({
      user: { id: ownerId },
      document: { id: documentId },
      question: trimmedQuestion,
      answer: result.answer,
      sources: result.sources,
    });

    return {
      ...result,
      historyItem: this.toAskHistoryItem(historyEntry),
    };
  }

  async getDocumentAskHistory(
    documentId: string,
    ownerId: string,
  ): Promise<AskHistoryItem[]> {
    await this.ragDocumentContextService.ensureOwnedDocument(
      documentId,
      ownerId,
    );
    const entries =
      await this.documentAskHistoryRepository.findByUserAndDocument(
        ownerId,
        documentId,
      );

    return entries.map((entry) => this.toAskHistoryItem(entry));
  }

  async clearDocumentAskHistory(
    documentId: string,
    ownerId: string,
  ): Promise<number> {
    await this.ragDocumentContextService.ensureOwnedDocument(
      documentId,
      ownerId,
    );

    return this.documentAskHistoryRepository.clearByUserAndDocument(
      ownerId,
      documentId,
    );
  }

  private async answerQuestion(
    question: string,
    chunks: RetrievedChunkRow[],
    scopeLabel: string,
  ): Promise<string> {
    const context =
      chunks.length > 0
        ? chunks
            .map((chunk, index) =>
              [
                `[${index + 1}] Document: ${chunk.documentName}`,
                `Chunk: ${chunk.chunkIndex}`,
                `Similarity: ${chunk.score.toFixed(3)}`,
                `Snippet: ${chunk.chunkText}`,
              ].join('\n'),
            )
            .join('\n\n')
        : 'No relevant document context was retrieved for this question.';
    const now = new Date();
    const currentDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Saigon',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    const currentTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Saigon',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(now);

    const prompt = await this.answerPrompt.format({
      question,
      context,
      scopeLabel,
      currentDate,
      currentTime,
    });
    const answer = await this.geminiService.generateText(prompt);

    return answer.trim();
  }

  private async answerFromRelevantChunks(
    question: string,
    ownerId: string,
    scope: RetrievalScope,
    options: {
      documentId?: string;
      limit?: number;
      scopeLabel: string;
    },
  ): Promise<RagAnswerResponse> {
    const retrievedChunks = await this.retrieveRelevantChunks(
      question,
      ownerId,
      scope,
      {
        documentId: options.documentId,
        limit: options.limit ?? DEFAULT_RETRIEVAL_LIMIT,
      },
    );

    const answer = await this.answerQuestion(
      question,
      retrievedChunks,
      options.scopeLabel,
    );

    return {
      answer,
      sources: this.toSources(retrievedChunks),
    };
  }

  private async retrieveRelevantChunks(
    question: string,
    ownerId: string,
    scope: RetrievalScope,
    options: {
      documentId?: string;
      limit?: number;
    } = {},
  ): Promise<RetrievedChunkRow[]> {
    const queryEmbedding = await this.geminiService.createEmbedding(question);
    const queryEmbeddingSql = this.toVectorSql(queryEmbedding);
    const params: Array<string | number> = [queryEmbeddingSql, ownerId];
    const whereClauses = ['ud.user_id = $2', 'c.embedding IS NOT NULL'];

    if (scope.scopedFolderId) {
      params.push(scope.scopedFolderId);
      whereClauses.push(`ud.folder_id = $${params.length}`);
    }

    if (options.documentId) {
      params.push(options.documentId);
      whereClauses.push(`d.id = $${params.length}`);
    }

    params.push(options.limit ?? DEFAULT_RETRIEVAL_LIMIT);
    const limitPlaceholder = `$${params.length}`;

    const rows = await this.runRawQuery(
      `
        SELECT
          d.id AS "documentId",
          COALESCE(ud.document_name, d.title, 'Untitled document') AS "documentName",
          c.chunk_index AS "chunkIndex",
          c.page_number AS "pageNumber",
          LEFT(c.chunk_text, ${SOURCE_SNIPPET_LENGTH}) AS "snippet",
          c.chunk_text AS "chunkText",
          1 - (c.embedding <=> $1::vector) AS "score"
        FROM user_documents ud
        INNER JOIN document d ON d.id = ud.document_id
        INNER JOIN document_chunks dc ON dc.document_id = d.id
        INNER JOIN chunks c ON c.id = dc.chunk_id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY c.embedding <=> $1::vector ASC
        LIMIT ${limitPlaceholder}
      `,
      params,
    );

    return rows.map((row) => this.mapRetrievedChunkRow(row));
  }

  private toSources(chunks: RetrievedChunkRow[]): RagSource[] {
    return chunks.map((chunk) => ({
      documentId: chunk.documentId,
      documentName: chunk.documentName,
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber,
      snippet: chunk.snippet,
      score: Number(chunk.score.toFixed(4)),
    }));
  }

  private toAskHistoryItem(entry: DocumentAskHistory): AskHistoryItem {
    return {
      id: entry.id,
      question: entry.question,
      answer: entry.answer,
      sources: entry.sources ?? [],
      createdAt: entry.createdAt.toISOString(),
    };
  }

  private toVectorSql(embedding: number[]): string {
    return pgvector.toSql(embedding) as string;
  }

  private async runRawQuery(sql: string, params: unknown[]): Promise<RawRow[]> {
    const result = (await this.dataSource.query(sql, params)) as unknown;

    if (!Array.isArray(result)) {
      return [];
    }

    return result.filter((row) => this.isRawRow(row));
  }

  private isRawRow(value: unknown): value is RawRow {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private mapRetrievedChunkRow(row: RawRow): RetrievedChunkRow {
    return {
      documentId: this.readRequiredString(row, 'documentId'),
      documentName: this.readString(row, 'documentName', 'Untitled document'),
      chunkIndex: this.readNumber(row, 'chunkIndex'),
      pageNumber: this.readNullableNumber(row, 'pageNumber'),
      snippet: this.readString(row, 'snippet'),
      chunkText: this.readString(row, 'chunkText'),
      score: this.readNumber(row, 'score'),
    };
  }

  private readRequiredString(row: RawRow, key: string): string {
    const value = row[key];

    if (typeof value === 'string' && value.trim()) {
      return value;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    throw new Error(`Expected string value for ${key}`);
  }

  private readString(row: RawRow, key: string, fallback = ''): string {
    const value = row[key];

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    return fallback;
  }

  private readNumber(row: RawRow, key: string, fallback = 0): number {
    const value = row[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return fallback;
  }

  private readNullableNumber(row: RawRow, key: string): number | null {
    const value = row[key];

    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return null;
  }
}
