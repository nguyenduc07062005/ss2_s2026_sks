import { Injectable, NotFoundException } from '@nestjs/common';
import pgvector from 'pgvector';
import { DataSource } from 'typeorm';
import { GeminiService } from 'src/common/llm/gemini.service';
import { Document } from 'src/database/entities/document.entity';
import { Folder } from 'src/database/entities/folder.entity';
import { UserDocument } from 'src/database/entities/user-document.entity';
import { ChunkRepository } from 'src/database/repositories/chunks.repository';
import { FolderRepository } from 'src/database/repositories/folder.repository';
import { UserDocumentRepository } from 'src/database/repositories/user-document.repository';
import { RagDocumentContextService } from './rag-document-context.service';
import { RagIndexingService } from './rag-indexing.service';

const DEFAULT_SEARCH_LIMIT = 10;
const DEFAULT_RELATED_LIMIT = 6;
const SEMANTIC_SCORE_THRESHOLD = 0.58;
const FALLBACK_TRIGGER_THRESHOLD = 0.72;
const SEMANTIC_STRONG_MATCH_THRESHOLD = 0.78;
const SOURCE_SNIPPET_LENGTH = 280;
const SEARCH_SUCCESS_MESSAGE = 'Documents searched successfully';
const SEARCH_CONCEPT_LIMIT = 4;
const SEARCH_CONCEPT_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'how',
  'in',
  'into',
  'is',
  'it',
  'its',
  'of',
  'only',
  'on',
  'or',
  'should',
  'that',
  'the',
  'their',
  'this',
  'to',
  'within',
  'using',
  'what',
  'when',
  'where',
  'which',
  'with',
  'answer',
  'answers',
  'include',
  'includes',
  'including',
  'inside',
  'mention',
  'mentioned',
  'mentions',
  'specific',
]);
const SEARCH_CONCEPT_GENERIC_WORDS = new Set([
  'chapter',
  'content',
  'covers',
  'describes',
  'discusses',
  'document',
  'documents',
  'explains',
  'file',
  'introduction',
  'lecture',
  'module',
  'note',
  'notes',
  'overview',
  'paper',
  'section',
  'study',
  'summary',
  'topic',
  'topics',
]);
const SEARCH_CONCEPT_PREFIX_PATTERN =
  /^(?:(?:this|the|a|an)\s+)?(?:lecture|document|paper|chapter|section|module|note|notes|study|article)\s+(?:covers|explains|describes|discusses|introduces|summarizes|focuses on|presents)\s+/i;

type SearchMatchType = 'semantic' | 'keyword_fallback';

type ScopeResolution = {
  folder: Folder | null;
  scopedFolderId: string | null;
  isWorkspaceScope: boolean;
};

type ChunkProgressRow = {
  documentId: string;
  documentName: string;
  totalChunks: number;
  embeddedChunks: number;
};

type RankedDocumentRow = {
  documentId: string;
  semanticScore: number;
};

type DocumentMatchInsight = {
  documentId: string;
  snippet: string;
  chunkText: string;
  sectionTitle: string | null;
  pageNumber: number | null;
  score: number | null;
};

type DocumentSummary = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  title: string;
  metadata: Document['metadata'] | null;
  docDate: Date | null;
  extraAttributes: Document['extraAttributes'] | null;
  fileRef: string | null;
  fileSize: number | null;
  contentHash: string | null;
  status: string;
  isFavorite: boolean;
  formattedFileSize: string;
  folderId: string | null;
  folderName: string;
};

export type SearchResultDocument = DocumentSummary & {
  matchType: SearchMatchType;
  score: number | null;
  relevanceLabel: string;
  matchedConcepts: string[];
  matchSnippet: string | null;
  matchSectionTitle: string | null;
  matchPageNumber: number | null;
};

export type SearchDocumentsResponse = {
  message: string;
  mode: 'semantic';
  total: number;
  currentPage: number;
  totalPages: number;
  documents: SearchResultDocument[];
};

export type RelatedDocumentsResponse = {
  total: number;
  documents: SearchResultDocument[];
};

type RawRow = Record<string, unknown>;

@Injectable()
export class RagSearchService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly geminiService: GeminiService,
    private readonly chunkRepository: ChunkRepository,
    private readonly folderRepository: FolderRepository,
    private readonly userDocumentRepository: UserDocumentRepository,
    private readonly ragDocumentContextService: RagDocumentContextService,
    private readonly ragIndexingService: RagIndexingService,
  ) {}

  async searchDocuments(
    query: string,
    ownerId: string,
    options: {
      folderId?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<SearchDocumentsResponse> {
    const trimmedQuery = query.trim();
    const page = Math.max(options.page ?? 1, 1);
    const limit = Math.max(options.limit ?? DEFAULT_SEARCH_LIMIT, 1);

    if (!trimmedQuery) {
      return this.createSearchResponse([], page, limit);
    }

    const scope = await this.resolveScope(ownerId, options.folderId);
    await this.ensureScopeIndexed(ownerId, scope);

    const queryEmbedding =
      await this.geminiService.createEmbedding(trimmedQuery);
    const rankedSemanticResults = await this.getSemanticDocumentScores(
      ownerId,
      scope,
      queryEmbedding,
    );

    const semanticHits = rankedSemanticResults.reduce<
      Array<{ documentId: string; score: number }>
    >((accumulator, row) => {
      if (row.semanticScore >= SEMANTIC_SCORE_THRESHOLD) {
        accumulator.push({
          documentId: row.documentId,
          score: row.semanticScore,
        });
      }

      return accumulator;
    }, []);

    const semanticInsightMap = await this.getSemanticDocumentInsights(
      ownerId,
      scope,
      queryEmbedding,
      semanticHits.map((document) => document.documentId),
    );

    const rawSemanticDocuments = await this.getRankedDocumentSummaries(
      ownerId,
      semanticHits,
      'semantic',
      trimmedQuery,
      semanticInsightMap,
    );
    const semanticDocuments = rawSemanticDocuments.filter((document) =>
      this.shouldKeepSemanticResult(document, trimmedQuery),
    );

    const shouldAppendFallback =
      semanticDocuments.length === 0 ||
      (semanticDocuments[0]?.score ?? 0) < FALLBACK_TRIGGER_THRESHOLD;

    const fallbackDocuments = shouldAppendFallback
      ? await this.getKeywordFallbackDocuments(
          ownerId,
          scope,
          trimmedQuery,
          semanticDocuments.map((document) => document.id),
        )
      : [];

    const mergedDocuments = [...semanticDocuments, ...fallbackDocuments];

    return this.createSearchResponse(mergedDocuments, page, limit);
  }

  async getRelatedDocuments(
    documentId: string,
    ownerId: string,
    limit: number = DEFAULT_RELATED_LIMIT,
  ): Promise<RelatedDocumentsResponse> {
    await this.ragDocumentContextService.ensureOwnedDocument(
      documentId,
      ownerId,
    );
    await this.ragIndexingService.ensureDocumentIndexed(documentId);

    const sourceChunks = await this.chunkRepository.findByDocument(documentId);
    const sourceEmbeddings = sourceChunks.reduce<number[][]>(
      (accumulator, chunk) => {
        const embedding = this.parseEmbedding(chunk.embedding);

        if (embedding.length > 0) {
          accumulator.push(embedding);
        }

        return accumulator;
      },
      [],
    );

    if (sourceEmbeddings.length === 0) {
      return {
        total: 0,
        documents: [],
      };
    }

    const candidateScores = new Map<string, number>();

    for (const sourceEmbedding of sourceEmbeddings.slice(0, 4)) {
      const scores = await this.getSemanticDocumentScores(
        ownerId,
        { folder: null, scopedFolderId: null, isWorkspaceScope: true },
        sourceEmbedding,
        documentId,
      );

      for (const row of scores) {
        const currentScore = candidateScores.get(row.documentId) ?? 0;

        if (row.semanticScore > currentScore) {
          candidateScores.set(row.documentId, row.semanticScore);
        }
      }
    }

    const rankedDocuments = [...candidateScores.entries()]
      .map(([candidateDocumentId, score]) => ({
        documentId: candidateDocumentId,
        score,
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);

    const documents = await this.getRankedDocumentSummaries(
      ownerId,
      rankedDocuments.map((row) => ({
        documentId: row.documentId,
        score: row.score,
      })),
      'semantic',
      '',
      new Map<string, DocumentMatchInsight>(),
    );

    return {
      total: documents.length,
      documents,
    };
  }

  private createSearchResponse(
    documents: SearchResultDocument[],
    page: number,
    limit: number,
  ): SearchDocumentsResponse {
    const total = documents.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;

    return {
      message: SEARCH_SUCCESS_MESSAGE,
      mode: 'semantic',
      total,
      currentPage: page,
      totalPages,
      documents: documents.slice(startIndex, startIndex + limit),
    };
  }

  private async getSemanticDocumentScores(
    ownerId: string,
    scope: ScopeResolution,
    embedding: number[],
    excludeDocumentId?: string,
  ): Promise<RankedDocumentRow[]> {
    const embeddingSql = this.toVectorSql(embedding);
    const params: Array<string | number> = [embeddingSql, ownerId];
    const whereClauses = ['ud.user_id = $2', 'c.embedding IS NOT NULL'];

    if (scope.scopedFolderId) {
      params.push(scope.scopedFolderId);
      whereClauses.push(`ud.folder_id = $${params.length}`);
    }

    if (excludeDocumentId) {
      params.push(excludeDocumentId);
      whereClauses.push(`d.id <> $${params.length}`);
    }

    const rows = await this.runRawQuery(
      `
        SELECT
          d.id AS "documentId",
          MAX(1 - (c.embedding <=> $1::vector)) AS "semanticScore"
        FROM user_documents ud
        INNER JOIN document d ON d.id = ud.document_id
        INNER JOIN document_chunks dc ON dc.document_id = d.id
        INNER JOIN chunks c ON c.id = dc.chunk_id
        WHERE ${whereClauses.join(' AND ')}
        GROUP BY d.id
        ORDER BY MAX(1 - (c.embedding <=> $1::vector)) DESC
      `,
      params,
    );

    return rows.map((row) => this.mapRankedDocumentRow(row));
  }

  private async getKeywordFallbackDocuments(
    ownerId: string,
    scope: ScopeResolution,
    query: string,
    excludedIds: string[],
  ): Promise<SearchResultDocument[]> {
    const searchTerm = `%${query}%`;
    const repository = this.userDocumentRepository.getRepository();
    const queryBuilder = repository
      .createQueryBuilder('userDocument')
      .leftJoinAndSelect('userDocument.document', 'document')
      .leftJoinAndSelect('userDocument.folder', 'folder')
      .leftJoin('userDocument.user', 'user')
      .leftJoin('document.chunks', 'chunk')
      .where('user.id = :ownerId', { ownerId })
      .andWhere(
        `
          (
            LOWER(COALESCE(userDocument.documentName, document.title, '')) LIKE LOWER(:searchTerm)
            OR LOWER(chunk.chunkText) LIKE LOWER(:searchTerm)
          )
        `,
        { searchTerm },
      )
      .distinct(true)
      .orderBy('document.createdAt', 'DESC');

    if (scope.scopedFolderId) {
      queryBuilder.andWhere('folder.id = :folderId', {
        folderId: scope.scopedFolderId,
      });
    }

    if (excludedIds.length > 0) {
      queryBuilder.andWhere('document.id NOT IN (:...excludedIds)', {
        excludedIds,
      });
    }

    const rows = await queryBuilder.getMany();
    const insightMap = await this.getKeywordFallbackInsights(
      ownerId,
      scope,
      query,
      rows.map((userDocument) => userDocument.document.id),
    );

    return rows.map((userDocument) =>
      this.buildSearchResultDocument(
        this.toDocumentSummary(userDocument),
        'keyword_fallback',
        null,
        query,
        insightMap.get(userDocument.document.id),
      ),
    );
  }

  private async getRankedDocumentSummaries(
    ownerId: string,
    rankedDocuments: Array<{ documentId: string; score: number }>,
    matchType: SearchMatchType,
    query: string,
    insightMap: Map<string, DocumentMatchInsight>,
  ): Promise<SearchResultDocument[]> {
    if (rankedDocuments.length === 0) {
      return [];
    }

    const scoreMap = new Map(
      rankedDocuments.map((document) => [document.documentId, document.score]),
    );
    const documentIds = rankedDocuments.map((document) => document.documentId);
    const documents = await this.userDocumentRepository
      .getRepository()
      .createQueryBuilder('userDocument')
      .leftJoinAndSelect('userDocument.document', 'document')
      .leftJoinAndSelect('userDocument.folder', 'folder')
      .leftJoin('userDocument.user', 'user')
      .where('user.id = :ownerId', { ownerId })
      .andWhere('document.id IN (:...documentIds)', { documentIds })
      .getMany();

    const summaryMap = new Map(
      documents.map((userDocument) => [
        userDocument.document.id,
        this.toDocumentSummary(userDocument),
      ]),
    );

    const summaries: SearchResultDocument[] = [];

    for (const document of rankedDocuments) {
      const summary = summaryMap.get(document.documentId);

      if (!summary) {
        continue;
      }

      summaries.push(
        this.buildSearchResultDocument(
          summary,
          matchType,
          scoreMap.get(document.documentId) ?? null,
          query,
          insightMap.get(document.documentId),
        ),
      );
    }

    return summaries;
  }

  private async getSemanticDocumentInsights(
    ownerId: string,
    scope: ScopeResolution,
    embedding: number[],
    documentIds: string[],
  ): Promise<Map<string, DocumentMatchInsight>> {
    if (documentIds.length === 0) {
      return new Map();
    }

    const embeddingSql = this.toVectorSql(embedding);
    const params: unknown[] = [embeddingSql, ownerId, documentIds];
    const whereClauses = [
      'ud.user_id = $2',
      'c.embedding IS NOT NULL',
      `d.id = ANY($3::uuid[])`,
    ];

    if (scope.scopedFolderId) {
      params.push(scope.scopedFolderId);
      whereClauses.push(`ud.folder_id = $${params.length}`);
    }

    const rows = await this.runRawQuery(
      `
        SELECT DISTINCT ON (d.id)
          d.id AS "documentId",
          LEFT(c.chunk_text, ${SOURCE_SNIPPET_LENGTH}) AS "snippet",
          c.chunk_text AS "chunkText",
          c.section_title AS "sectionTitle",
          c.page_number AS "pageNumber",
          1 - (c.embedding <=> $1::vector) AS "score"
        FROM user_documents ud
        INNER JOIN document d ON d.id = ud.document_id
        INNER JOIN document_chunks dc ON dc.document_id = d.id
        INNER JOIN chunks c ON c.id = dc.chunk_id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY d.id, c.embedding <=> $1::vector ASC
      `,
      params,
    );

    return new Map(
      rows.map((row) => {
        const insight = this.mapDocumentMatchInsightRow(row);
        return [insight.documentId, insight];
      }),
    );
  }

  private async getKeywordFallbackInsights(
    ownerId: string,
    scope: ScopeResolution,
    query: string,
    documentIds: string[],
  ): Promise<Map<string, DocumentMatchInsight>> {
    if (documentIds.length === 0) {
      return new Map();
    }

    const searchTerm = `%${query}%`;
    const params: unknown[] = [ownerId, documentIds, searchTerm, query];
    const whereClauses = ['ud.user_id = $1', `d.id = ANY($2::uuid[])`];

    if (scope.scopedFolderId) {
      params.push(scope.scopedFolderId);
      whereClauses.push(`ud.folder_id = $${params.length}`);
    }

    const rows = await this.runRawQuery(
      `
        SELECT DISTINCT ON (d.id)
          d.id AS "documentId",
          LEFT(COALESCE(c.chunk_text, ''), ${SOURCE_SNIPPET_LENGTH}) AS "snippet",
          COALESCE(c.chunk_text, '') AS "chunkText",
          c.section_title AS "sectionTitle",
          c.page_number AS "pageNumber",
          NULL AS "score"
        FROM user_documents ud
        INNER JOIN document d ON d.id = ud.document_id
        LEFT JOIN document_chunks dc ON dc.document_id = d.id
        LEFT JOIN chunks c ON c.id = dc.chunk_id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY
          d.id,
          CASE
            WHEN LOWER(COALESCE(c.chunk_text, '')) LIKE LOWER($3) THEN 0
            ELSE 1
          END ASC,
          CASE
            WHEN LOWER(COALESCE(c.chunk_text, '')) LIKE LOWER($3)
              THEN POSITION(LOWER($4) IN LOWER(COALESCE(c.chunk_text, '')))
            ELSE 2147483647
          END ASC,
          c.chunk_index ASC
      `,
      params,
    );

    return new Map(
      rows.map((row) => {
        const insight = this.mapDocumentMatchInsightRow(row);
        return [insight.documentId, insight];
      }),
    );
  }

  private async ensureScopeIndexed(
    ownerId: string,
    scope: ScopeResolution,
  ): Promise<void> {
    const progressRows = await this.getScopeChunkProgress(ownerId, scope);

    for (const row of progressRows) {
      if (row.totalChunks === 0 || row.embeddedChunks >= row.totalChunks) {
        continue;
      }

      await this.ragIndexingService.ensureDocumentIndexed(row.documentId);
    }
  }

  private async getScopeChunkProgress(
    ownerId: string,
    scope: ScopeResolution,
  ): Promise<ChunkProgressRow[]> {
    const params: Array<string | number> = [ownerId];
    const whereClauses = ['ud.user_id = $1'];

    if (scope.scopedFolderId) {
      params.push(scope.scopedFolderId);
      whereClauses.push(`ud.folder_id = $${params.length}`);
    }

    const rows = await this.runRawQuery(
      `
        SELECT
          d.id AS "documentId",
          COALESCE(ud.document_name, d.title, 'Untitled document') AS "documentName",
          COUNT(c.id)::int AS "totalChunks",
          COUNT(c.embedding)::int AS "embeddedChunks"
        FROM user_documents ud
        INNER JOIN document d ON d.id = ud.document_id
        LEFT JOIN document_chunks dc ON dc.document_id = d.id
        LEFT JOIN chunks c ON c.id = dc.chunk_id
        WHERE ${whereClauses.join(' AND ')}
        GROUP BY d.id, ud.document_name, d.title
        ORDER BY LOWER(COALESCE(ud.document_name, d.title, 'Untitled document')) ASC
      `,
      params,
    );

    return rows.map((row) => this.mapChunkProgressRow(row));
  }

  private async resolveScope(
    ownerId: string,
    folderId?: string,
  ): Promise<ScopeResolution> {
    if (!folderId) {
      return {
        folder: null,
        scopedFolderId: null,
        isWorkspaceScope: true,
      };
    }

    const folder = await this.folderRepository.findOne({
      where: { id: folderId, ownerId },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    return {
      folder,
      scopedFolderId: folder.parentId ? folder.id : null,
      isWorkspaceScope: !folder.parentId,
    };
  }

  private parseEmbedding(embedding: number[] | string | null): number[] {
    if (!embedding) {
      return [];
    }

    if (Array.isArray(embedding)) {
      return embedding.reduce<number[]>((accumulator, value) => {
        const numericValue = typeof value === 'number' ? value : Number(value);

        if (Number.isFinite(numericValue)) {
          accumulator.push(numericValue);
        }

        return accumulator;
      }, []);
    }

    let rawVector: unknown;

    try {
      rawVector = pgvector.fromSql(embedding) as unknown;
    } catch {
      return [];
    }

    if (!Array.isArray(rawVector)) {
      return [];
    }

    return rawVector.reduce<number[]>((accumulator, value) => {
      const numericValue = typeof value === 'number' ? value : Number(value);

      if (Number.isFinite(numericValue)) {
        accumulator.push(numericValue);
      }

      return accumulator;
    }, []);
  }

  private toDocumentSummary(
    userDocument: UserDocument & {
      document: Document;
      folder?: Folder | null;
    },
  ): DocumentSummary {
    return {
      id: userDocument.document.id,
      createdAt: userDocument.document.createdAt,
      updatedAt: userDocument.document.updatedAt,
      title:
        userDocument.documentName ||
        userDocument.document?.title ||
        'Untitled document',
      metadata: userDocument.document?.metadata ?? null,
      docDate: userDocument.document?.docDate ?? null,
      extraAttributes: userDocument.document?.extraAttributes ?? null,
      fileRef: userDocument.document?.fileRef ?? null,
      fileSize: userDocument.document?.fileSize ?? null,
      contentHash: userDocument.document?.contentHash ?? null,
      status: userDocument.document?.status ?? 'pending',
      isFavorite: userDocument.isFavorite,
      formattedFileSize: this.formatFileSize(
        userDocument.document?.fileSize || 0,
      ),
      folderId: userDocument.folder?.id || null,
      folderName: userDocument.folder?.name || 'Workspace',
    };
  }

  private buildSearchResultDocument(
    summary: DocumentSummary,
    matchType: SearchMatchType,
    score: number | null,
    query: string,
    insight?: DocumentMatchInsight,
  ): SearchResultDocument {
    return {
      ...summary,
      matchType,
      score: score === null ? null : Number(score.toFixed(4)),
      relevanceLabel: this.buildRelevanceLabel(matchType, score),
      matchedConcepts: this.extractMatchedConcepts(summary, query, insight),
      matchSnippet: this.resolveMatchSnippet(insight),
      matchSectionTitle: insight?.sectionTitle ?? null,
      matchPageNumber: insight?.pageNumber ?? null,
    };
  }

  private shouldKeepSemanticResult(
    document: SearchResultDocument,
    query: string,
  ): boolean {
    if (document.matchType !== 'semantic') {
      return true;
    }

    const score = document.score ?? 0;

    if (score >= SEMANTIC_STRONG_MATCH_THRESHOLD) {
      return true;
    }

    return this.hasLexicalEvidence(document, query);
  }

  private hasLexicalEvidence(
    document: SearchResultDocument,
    query: string,
  ): boolean {
    const normalizedQuery = this.normalizeComparisonText(query);

    if (!normalizedQuery) {
      return true;
    }

    const queryTokens = this.extractComparisonTokens(query);

    if (queryTokens.length === 0) {
      return true;
    }

    const sources = [
      document.title,
      document.matchSectionTitle,
      document.matchSnippet,
    ];
    const requiredOverlap =
      queryTokens.length === 1 ? 1 : Math.min(queryTokens.length, 2);

    for (const source of sources) {
      const normalizedSource = this.normalizeComparisonText(source ?? '');

      if (!normalizedSource) {
        continue;
      }

      if (normalizedSource.includes(normalizedQuery)) {
        return true;
      }

      const sourceTokens = new Set(
        normalizedSource.split(/\s+/).filter(Boolean),
      );
      const overlapCount = queryTokens.reduce(
        (count, token) => count + (sourceTokens.has(token) ? 1 : 0),
        0,
      );

      if (overlapCount >= requiredOverlap) {
        return true;
      }
    }

    return false;
  }

  private buildRelevanceLabel(
    matchType: SearchMatchType,
    score: number | null,
  ): string {
    if (matchType === 'keyword_fallback') {
      return 'Keyword match';
    }

    if (score === null) {
      return 'Semantic match';
    }

    if (score >= 0.86) {
      return 'Very relevant';
    }

    if (score >= FALLBACK_TRIGGER_THRESHOLD) {
      return 'Relevant';
    }

    return 'Related';
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) {
      return '0 Bytes';
    }

    const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const sizeIndex = Math.floor(Math.log(bytes) / Math.log(1024));

    return `${parseFloat((bytes / 1024 ** sizeIndex).toFixed(2))} ${units[sizeIndex]}`;
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

  private mapRankedDocumentRow(row: RawRow): RankedDocumentRow {
    return {
      documentId: this.readRequiredString(row, 'documentId'),
      semanticScore: this.readNumber(row, 'semanticScore'),
    };
  }

  private mapChunkProgressRow(row: RawRow): ChunkProgressRow {
    return {
      documentId: this.readRequiredString(row, 'documentId'),
      documentName: this.readString(row, 'documentName', 'Untitled document'),
      totalChunks: this.readNumber(row, 'totalChunks'),
      embeddedChunks: this.readNumber(row, 'embeddedChunks'),
    };
  }

  private mapDocumentMatchInsightRow(row: RawRow): DocumentMatchInsight {
    return {
      documentId: this.readRequiredString(row, 'documentId'),
      snippet: this.readString(row, 'snippet'),
      chunkText: this.readString(row, 'chunkText'),
      sectionTitle: this.readNullableString(row, 'sectionTitle'),
      pageNumber: this.readNullableNumber(row, 'pageNumber'),
      score: this.readNullableNumber(row, 'score'),
    };
  }

  private resolveMatchSnippet(insight?: DocumentMatchInsight): string | null {
    const snippet = this.normalizeSearchText(
      insight?.snippet || insight?.chunkText || '',
    );

    if (!snippet || !this.isReadableMatchSnippet(snippet)) {
      return null;
    }

    return snippet;
  }

  private extractMatchedConcepts(
    summary: DocumentSummary,
    query: string,
    insight?: DocumentMatchInsight,
  ): string[] {
    const queryTokens = this.extractMeaningfulTokens(query);
    const conceptScores = new Map<string, number>();
    const pushCandidate = (phrase: string | null, weight: number) => {
      const cleanedPhrase = this.cleanConceptPhrase(phrase);

      if (!cleanedPhrase) {
        return;
      }

      const normalizedKey = cleanedPhrase.toLowerCase();
      const overlapScore =
        this.countTokenOverlap(normalizedKey, queryTokens) * 12;
      const wordCount = cleanedPhrase.split(/\s+/).length;
      const lengthBonus = wordCount >= 2 && wordCount <= 4 ? 4 : 0;
      const totalScore = weight + overlapScore + lengthBonus;
      const currentScore = conceptScores.get(normalizedKey) ?? 0;

      if (totalScore > currentScore) {
        conceptScores.set(normalizedKey, totalScore);
      }
    };

    if (Array.isArray(summary.metadata?.keywords)) {
      for (const keyword of summary.metadata.keywords) {
        pushCandidate(keyword, 100);
      }
    }

    pushCandidate(summary.metadata?.topic ?? null, 90);
    pushCandidate(summary.metadata?.field ?? null, 82);
    pushCandidate(summary.metadata?.methodology ?? null, 78);
    pushCandidate(insight?.sectionTitle ?? null, 86);

    const sourceText = this.normalizeSearchText(
      insight?.chunkText || insight?.snippet || '',
    );

    for (const candidate of this.extractTextConceptCandidates(sourceText)) {
      pushCandidate(candidate, 56);
    }

    const rankedConcepts = [...conceptScores.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, SEARCH_CONCEPT_LIMIT)
      .map(([phrase]) => phrase);

    if (rankedConcepts.length > 0) {
      return rankedConcepts;
    }

    return [];
  }

  private extractTextConceptCandidates(text: string): string[] {
    if (!text) {
      return [];
    }

    const directCandidates = text
      .split(/[.!?]/)
      .slice(0, 3)
      .flatMap((sentence) => sentence.split(/[,:;()]/))
      .flatMap((segment) =>
        segment.split(
          /\b(?:and|or|including|such as|with|about|covering|focused on|focuses on)\b/i,
        ),
      )
      .map((segment) => this.cleanConceptPhrase(segment))
      .filter((segment): segment is string => Boolean(segment));

    if (directCandidates.length >= SEARCH_CONCEPT_LIMIT) {
      return directCandidates;
    }

    const tokenCandidates: string[] = [];
    const tokens = this.normalizeSearchText(text)
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    for (let index = 0; index < tokens.length; index += 1) {
      for (let size = 2; size <= 4; size += 1) {
        const slice = tokens.slice(index, index + size);

        if (slice.length !== size) {
          continue;
        }

        if (
          SEARCH_CONCEPT_STOPWORDS.has(slice[0]) ||
          SEARCH_CONCEPT_STOPWORDS.has(slice[slice.length - 1])
        ) {
          continue;
        }

        tokenCandidates.push(slice.join(' '));
      }
    }

    return [...directCandidates, ...tokenCandidates];
  }

  private cleanConceptPhrase(value: string | null | undefined): string | null {
    const normalizedValue = this.normalizeSearchText(value ?? '');

    if (!normalizedValue) {
      return null;
    }

    const strippedPrefix = normalizedValue
      .replace(SEARCH_CONCEPT_PREFIX_PATTERN, '')
      .replace(/^(?:overview|introduction|summary)\s+of\s+/i, '')
      .replace(/^(?:focus(?:es)? on|about|topic(?:s)?|related to)\s+/i, '')
      .replace(/[^\p{L}\p{N}\s-]+/gu, ' ');

    const words = strippedPrefix.toLowerCase().split(/\s+/).filter(Boolean);

    while (
      words.length > 0 &&
      (SEARCH_CONCEPT_STOPWORDS.has(words[0]) ||
        SEARCH_CONCEPT_GENERIC_WORDS.has(words[0]))
    ) {
      words.shift();
    }

    while (
      words.length > 0 &&
      (SEARCH_CONCEPT_STOPWORDS.has(words[words.length - 1]) ||
        SEARCH_CONCEPT_GENERIC_WORDS.has(words[words.length - 1]))
    ) {
      words.pop();
    }

    if (words.length === 0) {
      return null;
    }

    const limitedWords = words.slice(0, 5);

    if (
      limitedWords.every(
        (word) =>
          SEARCH_CONCEPT_STOPWORDS.has(word) ||
          SEARCH_CONCEPT_GENERIC_WORDS.has(word),
      )
    ) {
      return null;
    }

    if (!this.hasReadableConceptWords(limitedWords)) {
      return null;
    }

    const phrase = limitedWords.join(' ').trim();

    return phrase.length >= 3 ? phrase : null;
  }

  private hasReadableConceptWords(words: string[]): boolean {
    const alphabeticWords = words
      .map((word) => word.replace(/[^\p{L}]+/gu, ''))
      .filter(Boolean);
    const numericWords = words.filter((word) => /^\d+$/.test(word));

    if (alphabeticWords.length === 0) {
      return false;
    }

    if (words.length > 1 && alphabeticWords.length < 2) {
      return false;
    }

    const uniqueAlphabeticWords = new Set(alphabeticWords);

    if (alphabeticWords.length >= 2 && uniqueAlphabeticWords.size === 1) {
      return false;
    }

    if (numericWords.length >= 2 && uniqueAlphabeticWords.size < 2) {
      return false;
    }

    const repeatedWordCounts = new Map<string, number>();

    for (const word of alphabeticWords) {
      repeatedWordCounts.set(word, (repeatedWordCounts.get(word) ?? 0) + 1);
    }

    const maxRepeatedCount = Math.max(0, ...repeatedWordCounts.values());

    if (maxRepeatedCount >= 3 && uniqueAlphabeticWords.size <= 2) {
      return false;
    }

    return true;
  }

  private isReadableMatchSnippet(value: string): boolean {
    const words = value
      .split(/\s+/)
      .map((word) => word.replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase())
      .filter(Boolean);
    const alphabeticWords = words.filter((word) => /[\p{L}]/u.test(word));
    const numericWords = words.filter((word) => /^\d+$/.test(word));

    if (alphabeticWords.length < 3) {
      return false;
    }

    const uniqueAlphabeticWords = new Set(alphabeticWords);
    const letterCount = (value.match(/\p{L}/gu) || []).length;

    if (letterCount < 10) {
      return false;
    }

    if (numericWords.length >= 2 && uniqueAlphabeticWords.size < 3) {
      return false;
    }

    const repeatedWordCounts = new Map<string, number>();

    for (const word of alphabeticWords) {
      repeatedWordCounts.set(word, (repeatedWordCounts.get(word) ?? 0) + 1);
    }

    const maxRepeatedCount = Math.max(0, ...repeatedWordCounts.values());

    if (maxRepeatedCount >= 3 && uniqueAlphabeticWords.size <= 2) {
      return false;
    }

    return true;
  }

  private extractMeaningfulTokens(text: string): Set<string> {
    return new Set(
      this.normalizeSearchText(text)
        .toLowerCase()
        .split(/\s+/)
        .filter(
          (token) =>
            token.length > 2 &&
            !SEARCH_CONCEPT_STOPWORDS.has(token) &&
            !SEARCH_CONCEPT_GENERIC_WORDS.has(token),
        ),
    );
  }

  private countTokenOverlap(phrase: string, queryTokens: Set<string>): number {
    if (queryTokens.size === 0) {
      return 0;
    }

    return phrase
      .split(/\s+/)
      .reduce((count, token) => count + (queryTokens.has(token) ? 1 : 0), 0);
  }

  private normalizeSearchText(value: string): string {
    return value
      .replace(/\s+/g, ' ')
      .replace(/[^\S\r\n]+/g, ' ')
      .trim();
  }

  private normalizeComparisonText(value: string): string {
    return this.normalizeSearchText(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractComparisonTokens(value: string): string[] {
    return this.normalizeComparisonText(value)
      .split(/\s+/)
      .filter((token) => token.length >= 2);
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

  private readNullableString(row: RawRow, key: string): string | null {
    const value = row[key];

    if (typeof value === 'string') {
      const trimmedValue = value.trim();
      return trimmedValue ? trimmedValue : null;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    return null;
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
