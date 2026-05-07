import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';
import { DataSource } from 'typeorm';
import { GeminiService } from 'src/common/llm/gemini.service';
import { Document } from 'src/database/entities/document.entity';
import {
  LLM_GENERATION_SERVICE,
  type LlmGenerationService,
} from 'src/common/llm/llm-generation.types';
import { DocumentAskHistory } from 'src/database/entities/document-ask-history.entity';
import { DocumentAskHistoryRepository } from 'src/database/repositories/document-ask-history.repository';
import {
  RawRow,
  runRawQuery,
  readRequiredString,
  readString,
  readNumber,
  readNullableNumber,
} from 'src/common/utils/raw-query.util';
import {
  normalizeConversationText,
  truncateConversationText,
  toVectorSql,
} from '../shared-rag.util';
import {
  DEFAULT_RETRIEVAL_LIMIT,
  SEMANTIC_SCORE_THRESHOLD,
  SOURCE_SNIPPET_LENGTH,
  RECENT_ASK_HISTORY_TURNS,
  MAX_DOCUMENT_ASK_HISTORY_ITEMS,
  STUDY_GPS_RECENT_CONTEXT_TURNS,
} from '../constants';
import { RagDocumentContextService } from './rag-document-context.service';
import { RagIndexingService } from './rag-indexing.service';
import {
  AskHistoryItem,
  RagAnswerResponse,
  RagSource,
  StudyGpsDayChatMessage,
} from '../types/rag.types';
import type { RagAskMode } from '../dtos/ask-rag.dto';

const DOCUMENT_STRICT_PROMPT = [
  'You are an academic assistant inside a document workspace.',
  'Answer using ONLY the provided document context.',
  'If the context does not contain enough evidence, say that the document context is not sufficient.',
  'Do not use outside knowledge.',
].join('\n');

const DOCUMENT_ASSISTED_PROMPT = [
  'Use the document context first.',
  'You may add general knowledge only after clearly separating it from document-grounded facts.',
].join('\n');

const GENERAL_CHAT_PROMPT = [
  'Answer as a general assistant. Document context is not required.',
].join('\n');

const ANSWER_PROMPT_TEMPLATE = [
  'You are a helpful AI assistant inside a document workspace.',
  '{modeInstructions}',
  'Respond naturally, like a real chat assistant, not like a rigid template.',
  'Do not mention internal prompting, retrieval, or hidden context unless the user asks.',
  'Never mention chunk numbers, similarity scores, embeddings, source indexes, retrieval IDs, or other implementation details.',
  'Format the answer in clean Markdown.',
  'Use short paragraphs and bullet lists when they improve readability.',
  'Bold only the most important keywords, concepts, formulas, and conclusions.',
  'Do not over-format and do not use tables unless the user asks.',
  'Reply in the same language as the user question.',
  'Use the recent conversation only to resolve follow-up references such as "that", "above", or "it".',
  'Current date in Asia/Saigon: {currentDate}.',
  'Current time in Asia/Saigon: {currentTime}.',
  'Workspace scope: {scopeLabel}.',
  '',
  'Recent conversation (oldest to newest, may be empty):',
  '{recentConversation}',
  '',
  'Question:',
  '{question}',
  '',
  'Document context:',
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

@Injectable()
export class RagQuestionAnsweringService {
  private readonly answerPrompt = PromptTemplate.fromTemplate(
    ANSWER_PROMPT_TEMPLATE,
  );
  private readonly logger = new Logger(RagQuestionAnsweringService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly geminiService: GeminiService,
    @Inject(LLM_GENERATION_SERVICE)
    private readonly generationService: LlmGenerationService,
    private readonly documentAskHistoryRepository: DocumentAskHistoryRepository,
    private readonly ragDocumentContextService: RagDocumentContextService,
    private readonly ragIndexingService: RagIndexingService,
  ) {}

  async askDocument(
    documentId: string,
    ownerId: string,
    question: string,
    mode: RagAskMode = 'document_strict',
  ): Promise<RagAnswerResponse & { historyItem: AskHistoryItem }> {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      throw new BadRequestException('Question is required');
    }

    const document = await this.ragDocumentContextService.ensureOwnedDocument(
      documentId,
      ownerId,
    );

    if (mode !== 'general_chat') {
      await this.ragIndexingService.ensureDocumentIndexed(documentId);
    }

    const recentHistory = await this.getRecentHistorySafe(documentId, ownerId);

    const result = await this.answerFromRelevantChunks(
      trimmedQuestion,
      ownerId,
      { scopedFolderId: null },
      {
        documentId,
        scopeLabel: document.title || 'Current document',
        recentHistory,
        mode,
      },
    );

    const historyEntry = await this.documentAskHistoryRepository.create({
      user: { id: ownerId },
      document: { id: documentId },
      question: trimmedQuestion,
      answer: result.answer,
      sources: result.sources,
    });
    await this.trimHistorySafe(documentId, ownerId);

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
    await this.trimHistorySafe(documentId, ownerId);
    const entries = await this.getRecentHistorySafe(documentId, ownerId, {
      limit: MAX_DOCUMENT_ASK_HISTORY_ITEMS,
    });

    return entries.reverse().map((entry) => this.toAskHistoryItem(entry));
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

  async answerStudyGpsDay(
    ownerId: string,
    question: string,
    options: {
      documentIds: string[];
      scopeLabel: string;
      studyContext: string;
      recentMessages?: StudyGpsDayChatMessage[];
    },
  ): Promise<RagAnswerResponse> {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      throw new BadRequestException('Message is required');
    }

    const documentIds = [...new Set(options.documentIds.filter(Boolean))];

    if (documentIds.length === 0) {
      throw new BadRequestException(
        'Study GPS chat requires at least one document.',
      );
    }

    await Promise.all(
      documentIds.map(async (documentId) => {
        await this.ragDocumentContextService.ensureOwnedDocument(
          documentId,
          ownerId,
        );
        await this.ragIndexingService.ensureDocumentIndexed(documentId);
      }),
    );

    const studyContext = normalizeConversationText(options.studyContext);
    const retrievalQuestion = [studyContext, trimmedQuestion]
      .filter(Boolean)
      .join('\n\n');
    const retrievedChunks = await this.retrieveRelevantChunksWithFallback(
      retrievalQuestion,
      ownerId,
      { scopedFolderId: null },
      {
        documentIds,
        limit: DEFAULT_RETRIEVAL_LIMIT,
      },
    );
    const answer = await this.answerQuestionWithConversation(
      trimmedQuestion,
      retrievedChunks,
      options.scopeLabel,
      this.buildRecentConversationContextFromTurns(
        options.recentMessages ?? [],
      ),
      studyContext,
      'document_assisted',
    );

    return {
      answer,
      sources: this.toSources(retrievedChunks),
    };
  }

  private async answerQuestion(
    question: string,
    chunks: RetrievedChunkRow[],
    scopeLabel: string,
    recentHistory: DocumentAskHistory[],
    mode: RagAskMode,
  ): Promise<string> {
    return this.answerQuestionWithConversation(
      question,
      chunks,
      scopeLabel,
      this.buildRecentConversationContext(recentHistory),
      '',
      mode,
    );
  }

  private async answerQuestionWithConversation(
    question: string,
    chunks: RetrievedChunkRow[],
    scopeLabel: string,
    recentConversation: string,
    contextPrefix = '',
    mode: RagAskMode = 'document_assisted',
  ): Promise<string> {
    const chunkContext =
      chunks.length > 0
        ? chunks
            .map((chunk) =>
              [
                `Document: ${chunk.documentName}`,
                chunk.pageNumber ? `Page: ${chunk.pageNumber}` : null,
                `Excerpt: ${chunk.chunkText}`,
              ].join('\n'),
            )
            .join('\n\n')
        : mode === 'general_chat'
          ? 'Document context is not used in general chat mode.'
          : 'No relevant document context was retrieved for this question.';
    const context = [contextPrefix, chunkContext]
      .map((item) => item.trim())
      .filter(Boolean)
      .join('\n\n');
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
      recentConversation,
      modeInstructions: this.getModeInstructions(mode),
    });
    const answer = await this.generationService.generateText(prompt);

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
      recentHistory: DocumentAskHistory[];
      mode: RagAskMode;
    },
  ): Promise<RagAnswerResponse> {
    const retrievedChunks =
      options.mode === 'general_chat'
        ? []
        : await this.retrieveRelevantChunksWithFallback(
            question,
            ownerId,
            scope,
            {
              documentId: options.documentId,
              limit: options.limit ?? DEFAULT_RETRIEVAL_LIMIT,
            },
          );

    if (
      options.mode === 'document_strict' &&
      !this.hasSufficientDocumentEvidence(retrievedChunks)
    ) {
      return {
        answer: this.buildInsufficientDocumentContextAnswer(question),
        sources: [],
      };
    }

    const answer = await this.answerQuestion(
      question,
      retrievedChunks,
      options.scopeLabel,
      options.recentHistory,
      options.mode,
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
      documentIds?: string[];
      limit?: number;
    } = {},
  ): Promise<RetrievedChunkRow[]> {
    const queryEmbedding = await this.geminiService.createEmbedding(question);
    const queryEmbeddingSql = toVectorSql(queryEmbedding);
    const params: unknown[] = [queryEmbeddingSql, ownerId];
    const whereClauses = ['ud.user_id = $2', 'c.embedding IS NOT NULL'];

    if (scope.scopedFolderId) {
      params.push(scope.scopedFolderId);
      whereClauses.push(`ud.folder_id = $${params.length}`);
    }

    if (options.documentId) {
      params.push(options.documentId);
      whereClauses.push(`d.id = $${params.length}`);
    } else if (options.documentIds?.length) {
      const documentIds = [...new Set(options.documentIds.filter(Boolean))];

      if (documentIds.length > 0) {
        params.push(documentIds);
        whereClauses.push(`d.id = ANY($${params.length}::uuid[])`);
      }
    }

    params.push(options.limit ?? DEFAULT_RETRIEVAL_LIMIT);
    const limitPlaceholder = `$${params.length}`;

    const rows = await runRawQuery(
      this.dataSource,
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

  private async retrieveRelevantChunksWithFallback(
    question: string,
    ownerId: string,
    scope: RetrievalScope,
    options: {
      documentId?: string;
      documentIds?: string[];
      limit?: number;
    } = {},
  ): Promise<RetrievedChunkRow[]> {
    try {
      return await this.retrieveRelevantChunks(
        question,
        ownerId,
        scope,
        options,
      );
    } catch (error) {
      if (!this.isEmbeddingRetrievalUnavailable(error)) {
        throw error;
      }

      this.logger.warn(
        `Semantic retrieval failed; falling back to local text chunk selection: ${this.toErrorMessage(
          error,
        )}`,
      );

      const documents = await this.resolveFallbackDocuments(ownerId, options);

      if (documents.length === 0) {
        return [];
      }

      return this.retrieveRelevantChunksLocally(
        documents,
        question,
        options.limit ?? DEFAULT_RETRIEVAL_LIMIT,
      );
    }
  }

  private async resolveFallbackDocuments(
    ownerId: string,
    options: {
      documentId?: string;
      documentIds?: string[];
    },
  ): Promise<Document[]> {
    const documentIds = [
      ...(options.documentId ? [options.documentId] : []),
      ...(options.documentIds ?? []),
    ].filter(Boolean);
    const uniqueDocumentIds = [...new Set(documentIds)];

    return Promise.all(
      uniqueDocumentIds.map((documentId) =>
        this.ragDocumentContextService.ensureOwnedDocument(documentId, ownerId),
      ),
    );
  }

  private async retrieveRelevantChunksLocally(
    documents: Document[],
    question: string,
    limit: number,
  ): Promise<RetrievedChunkRow[]> {
    const safeLimit = Math.max(1, limit);
    const perDocumentLimit = Math.max(
      1,
      Math.ceil(safeLimit / Math.max(documents.length, 1)),
    );
    const chunkGroups = await Promise.all(
      documents.map(async (document) => ({
        document,
        chunks: await this.ragDocumentContextService.getRelevantChunks(
          document.id,
          question,
          perDocumentLimit,
        ),
      })),
    );

    return chunkGroups
      .flatMap(({ document, chunks }) =>
        chunks.map((chunk) => ({
          documentId: document.id,
          documentName: document.title || 'Untitled document',
          chunkIndex: chunk.chunkIndex,
          pageNumber: chunk.pageNumber,
          snippet: chunk.chunkText.slice(0, SOURCE_SNIPPET_LENGTH),
          chunkText: chunk.chunkText,
          score: 0,
        })),
      )
      .slice(0, safeLimit);
  }

  private isEmbeddingRetrievalUnavailable(error: unknown): boolean {
    if (error instanceof ServiceUnavailableException) {
      return true;
    }

    const message = this.toErrorMessage(error).toLowerCase();

    return [
      'fetch failed',
      'failed sending request',
      'network',
      'timeout',
      'econnreset',
      'etimedout',
      'unavailable',
      'quota',
      'rate limit',
    ].some((token) => message.includes(token));
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  private hasSufficientDocumentEvidence(chunks: RetrievedChunkRow[]): boolean {
    return chunks.some(
      (chunk) =>
        chunk.score >= SEMANTIC_SCORE_THRESHOLD &&
        chunk.chunkText.trim().length >= 40,
    );
  }

  private buildInsufficientDocumentContextAnswer(question: string): string {
    return this.looksVietnamese(question)
      ? 'Mình chưa có đủ bằng chứng trong ngữ cảnh tài liệu để trả lời chắc chắn câu hỏi này.'
      : 'The document context is not sufficient to answer this question with reliable evidence.';
  }

  private looksVietnamese(value: string): boolean {
    return /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(
      value,
    );
  }

  private getModeInstructions(mode: RagAskMode): string {
    if (mode === 'document_strict') {
      return DOCUMENT_STRICT_PROMPT;
    }

    if (mode === 'document_assisted') {
      return DOCUMENT_ASSISTED_PROMPT;
    }

    return GENERAL_CHAT_PROMPT;
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

  private buildRecentConversationContext(
    entries: DocumentAskHistory[],
  ): string {
    if (!Array.isArray(entries) || entries.length === 0) {
      return 'No recent conversation.';
    }

    const conversationBlocks = [...entries]
      .reverse()
      .map((entry) => {
        const normalizedQuestion = normalizeConversationText(entry.question);
        const normalizedAnswer = truncateConversationText(entry.answer);

        if (!normalizedQuestion && !normalizedAnswer) {
          return '';
        }

        return [
          `User: ${normalizedQuestion || '(empty)'}`,
          `Assistant: ${normalizedAnswer || '(empty)'}`,
        ].join('\n');
      })
      .filter(Boolean);

    if (conversationBlocks.length > 0) {
      return conversationBlocks.join('\n\n');
    }

    return 'No recent conversation.';
  }

  private buildRecentConversationContextFromTurns(
    entries: StudyGpsDayChatMessage[],
  ): string {
    if (!Array.isArray(entries) || entries.length === 0) {
      return 'No recent conversation.';
    }

    const conversationBlocks = entries
      .slice(-STUDY_GPS_RECENT_CONTEXT_TURNS)
      .map((entry) => {
        const role = entry.role === 'assistant' ? 'Assistant' : 'User';
        const content = truncateConversationText(entry.content);

        return content ? `${role}: ${content}` : '';
      })
      .filter(Boolean);

    return conversationBlocks.length > 0
      ? conversationBlocks.join('\n')
      : 'No recent conversation.';
  }

  private mapRetrievedChunkRow(row: RawRow): RetrievedChunkRow {
    return {
      documentId: readRequiredString(row, 'documentId'),
      documentName: readString(row, 'documentName', 'Untitled document'),
      chunkIndex: readNumber(row, 'chunkIndex'),
      pageNumber: readNullableNumber(row, 'pageNumber'),
      snippet: readString(row, 'snippet'),
      chunkText: readString(row, 'chunkText'),
      score: readNumber(row, 'score'),
    };
  }

  private async getRecentHistorySafe(
    documentId: string,
    ownerId: string,
    options: { limit?: number } = {},
  ): Promise<DocumentAskHistory[]> {
    const limit = options.limit ?? RECENT_ASK_HISTORY_TURNS;

    try {
      return await this.documentAskHistoryRepository.findRecentByUserAndDocument(
        ownerId,
        documentId,
        limit,
      );
    } catch (error) {
      this.logger.warn(
        `Falling back to legacy ask history query for document ${documentId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      const legacyEntries =
        await this.documentAskHistoryRepository.findByUserAndDocument(
          ownerId,
          documentId,
        );

      return legacyEntries.slice(-limit).reverse();
    }
  }

  private async trimHistorySafe(
    documentId: string,
    ownerId: string,
  ): Promise<void> {
    try {
      await this.documentAskHistoryRepository.trimToLatestByUserAndDocument(
        ownerId,
        documentId,
        MAX_DOCUMENT_ASK_HISTORY_ITEMS,
      );
    } catch (error) {
      this.logger.warn(
        `Ask history trim failed for document ${documentId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
