import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import pgvector from 'pgvector';
import { DataSource } from 'typeorm';
import { GeminiService } from 'src/common/llm/gemini.service';
import {
  RawRow,
  runRawQuery,
  readRequiredString,
  readString,
  readNullableString,
  readNumber,
  readNullableNumber,
} from 'src/common/utils/raw-query.util';
import {
  normalizeComparisonText,
  normalizeSearchText,
} from 'src/common/utils/text-normalization.util';
import { formatFileSize, toVectorSql } from '../shared-rag.util';
import {
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_RELATED_LIMIT,
  SEMANTIC_SCORE_THRESHOLD,
  SEMANTIC_STRONG_MATCH_THRESHOLD,
  SOURCE_SNIPPET_LENGTH,
  SEARCH_CONCEPT_LIMIT,
  CONTEXT_SEARCH_STOPWORDS,
} from '../constants';
import { Document } from 'src/database/entities/document.entity';
import { Folder } from 'src/database/entities/folder.entity';
import { UserDocument } from 'src/database/entities/user-document.entity';
import { ChunkRepository } from 'src/database/repositories/chunks.repository';
import { FolderRepository } from 'src/database/repositories/folder.repository';
import { UserDocumentRepository } from 'src/database/repositories/user-document.repository';
import { RagDocumentContextService } from './rag-document-context.service';
import { RagIndexingService } from './rag-indexing.service';
import { RagSearchExplanationService } from './rag-search-explanation.service';

const SEARCH_SUCCESS_MESSAGE = 'Documents searched successfully';
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
const SEARCH_FILE_EXTENSION_PATTERN = /\b(?:pdf|docx?|txt|pptx?|ppt)\b/i;
const SEARCH_FILENAME_PATTERN =
  /(?:^|[\s\\/])[\p{L}\p{N} _.-]+\.[a-z0-9]{2,5}$/iu;
const SEARCH_RANK_WEIGHTS: Record<SearchMatchType, number> = {
  title: 1000,
  section: 700,
  content: 500,
  meaning: 300,
};

type SearchQueryMode = 'lexical' | 'semantic' | 'hybrid';
type SearchMatchType = 'title' | 'section' | 'content' | 'meaning';

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

type RankedSearchDocument = {
  documentId: string;
  score: number;
  matchType: SearchMatchType;
};

type SearchQueryIntent = {
  mode: SearchQueryMode;
  normalizedQuery: string;
  tokens: string[];
  hasDigits: boolean;
  hasSymbols: boolean;
  looksLikeFileName: boolean;
  looksLikeExtension: boolean;
  isShort: boolean;
  semanticTokenCount: number;
};

type DocumentMatchInsight = {
  documentId: string;
  snippet: string;
  chunkText: string;
  sectionTitle: string | null;
  pageNumber: number | null;
  score: number | null;
  matchType?: SearchMatchType;
};

type LexicalSearchRow = {
  documentId: string;
  documentName: string;
  fileRef: string;
  chunkText: string;
  sectionTitle: string | null;
  pageNumber: number | null;
};

type LexicalMatch = {
  score: number;
  matchType: Exclude<SearchMatchType, 'meaning'>;
  snippet: string;
  chunkText: string;
  sectionTitle: string | null;
  pageNumber: number | null;
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
  matchLabel: string;
  matchReason: string;
  evidenceSnippet: string | null;
  topics: string[];
};

export type SearchDocumentsResponse = {
  message: string;
  mode: SearchQueryMode;
  total: number;
  currentPage: number;
  totalPages: number;
  documents: SearchResultDocument[];
};

export type RelatedDocumentsResponse = {
  total: number;
  documents: SearchResultDocument[];
};

@Injectable()
export class RagSearchService {
  private readonly logger = new Logger(RagSearchService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly geminiService: GeminiService,
    private readonly chunkRepository: ChunkRepository,
    private readonly folderRepository: FolderRepository,
    private readonly userDocumentRepository: UserDocumentRepository,
    private readonly ragDocumentContextService: RagDocumentContextService,
    private readonly ragIndexingService: RagIndexingService,
    private readonly ragSearchExplanationService: RagSearchExplanationService,
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

    const intent = this.analyzeSearchQuery(trimmedQuery);
    const mode = intent.mode;
    const [lexicalDocuments, semanticDocuments] = await Promise.all([
      mode === 'semantic'
        ? Promise.resolve([])
        : this.getLexicalDocumentMatches(ownerId, scope, trimmedQuery, intent),
      mode === 'lexical'
        ? Promise.resolve([])
        : this.getSemanticSearchDocuments(ownerId, scope, trimmedQuery),
    ]);
    const mergedDocuments = this.mergeSearchDocuments(
      lexicalDocuments,
      semanticDocuments,
    );

    const response = this.createSearchResponse(
      mergedDocuments,
      page,
      limit,
      mode,
    );
    response.documents =
      await this.ragSearchExplanationService.enrichSearchReasons(
        response.documents,
        trimmedQuery,
      );

    return response;
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
        matchType: 'meaning',
      })),
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
    mode: SearchQueryMode = 'semantic',
  ): SearchDocumentsResponse {
    const total = documents.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;

    return {
      message: SEARCH_SUCCESS_MESSAGE,
      mode,
      total,
      currentPage: page,
      totalPages,
      documents: documents.slice(startIndex, startIndex + limit),
    };
  }

  private analyzeSearchQuery(query: string): SearchQueryIntent {
    const normalizedQuery = normalizeComparisonText(query);

    if (!normalizedQuery) {
      return {
        mode: 'lexical',
        normalizedQuery,
        tokens: [],
        hasDigits: false,
        hasSymbols: false,
        looksLikeFileName: false,
        looksLikeExtension: false,
        isShort: true,
        semanticTokenCount: 0,
      };
    }

    const tokens = this.extractComparisonTokens(query);
    const semanticTokens = tokens.filter(
      (token) =>
        token.length >= 3 &&
        !CONTEXT_SEARCH_STOPWORDS.has(token) &&
        !SEARCH_CONCEPT_GENERIC_WORDS.has(token),
    );
    const hasDigits = /\d/.test(query);
    const hasSymbols = /[._/#:[\](){}-]/.test(query);
    const looksLikeFileName = SEARCH_FILENAME_PATTERN.test(query.trim());
    const looksLikeExtension =
      /^\.[a-z0-9]{2,6}$/i.test(query.trim()) ||
      (tokens.length === 1 && SEARCH_FILE_EXTENSION_PATTERN.test(query));
    const isShort = tokens.length <= 2 || normalizedQuery.length <= 4;
    let mode: SearchQueryMode = 'hybrid';

    if (
      looksLikeFileName ||
      looksLikeExtension ||
      hasSymbols ||
      hasDigits ||
      isShort
    ) {
      mode = 'lexical';
    } else if (semanticTokens.length >= 5) {
      mode = 'semantic';
    }

    return {
      mode,
      normalizedQuery,
      tokens,
      hasDigits,
      hasSymbols,
      looksLikeFileName,
      looksLikeExtension,
      isShort,
      semanticTokenCount: semanticTokens.length,
    };
  }

  private async getSemanticSearchDocuments(
    ownerId: string,
    scope: ScopeResolution,
    query: string,
  ): Promise<SearchResultDocument[]> {
    const queryEmbedding = await this.geminiService.createEmbedding(query);
    const rankedSemanticResults = await this.getSemanticDocumentScores(
      ownerId,
      scope,
      queryEmbedding,
    );
    const semanticHits = rankedSemanticResults.reduce<RankedSearchDocument[]>(
      (accumulator, row) => {
        if (row.semanticScore >= SEMANTIC_SCORE_THRESHOLD) {
          accumulator.push({
            documentId: row.documentId,
            score: row.semanticScore,
            matchType: 'meaning',
          });
        }

        return accumulator;
      },
      [],
    );
    const semanticInsightMap = await this.getSemanticDocumentInsights(
      ownerId,
      scope,
      queryEmbedding,
      semanticHits.map((document) => document.documentId),
    );
    const rawSemanticDocuments = await this.getRankedDocumentSummaries(
      ownerId,
      semanticHits,
      query,
      semanticInsightMap,
    );

    return rawSemanticDocuments.filter((document) =>
      this.shouldKeepSemanticResult(document, query),
    );
  }

  private mergeSearchDocuments(
    lexicalDocuments: SearchResultDocument[],
    semanticDocuments: SearchResultDocument[],
  ): SearchResultDocument[] {
    const documentMap = new Map<string, SearchResultDocument>();

    for (const document of [...lexicalDocuments, ...semanticDocuments]) {
      const current = documentMap.get(document.id);

      if (!current || this.compareSearchDocuments(document, current) < 0) {
        documentMap.set(document.id, document);
      }
    }

    return [...documentMap.values()].sort((left, right) =>
      this.compareSearchDocuments(left, right),
    );
  }

  private getSearchRank(document: SearchResultDocument): number {
    return SEARCH_RANK_WEIGHTS[document.matchType] + (document.score ?? 0);
  }

  private compareSearchDocuments(
    left: SearchResultDocument,
    right: SearchResultDocument,
  ): number {
    const rankDifference = this.getSearchRank(right) - this.getSearchRank(left);

    if (rankDifference !== 0) {
      return rankDifference;
    }

    const leftUpdatedAt = this.getDocumentSortTime(left);
    const rightUpdatedAt = this.getDocumentSortTime(right);

    return rightUpdatedAt - leftUpdatedAt;
  }

  private getDocumentSortTime(document: SearchResultDocument): number {
    return document.updatedAt?.getTime() ?? document.createdAt?.getTime() ?? 0;
  }

  private async getSemanticDocumentScores(
    ownerId: string,
    scope: ScopeResolution,
    embedding: number[],
    excludeDocumentId?: string,
  ): Promise<RankedDocumentRow[]> {
    const embeddingSql = toVectorSql(embedding);
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

    const rows = await runRawQuery(
      this.dataSource,
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

  private async getLexicalDocumentMatches(
    ownerId: string,
    scope: ScopeResolution,
    query: string,
    intent: SearchQueryIntent = this.analyzeSearchQuery(query),
  ): Promise<SearchResultDocument[]> {
    const params: unknown[] = [ownerId];
    const whereClauses = ['ud.user_id = $1'];
    const searchTerms = this.buildLexicalSearchTerms(query, intent);

    if (scope.scopedFolderId) {
      params.push(scope.scopedFolderId);
      whereClauses.push(`ud.folder_id = $${params.length}`);
    }

    if (searchTerms.length > 0) {
      const sourceClauses = searchTerms.map((searchTerm) => {
        params.push(searchTerm);
        const paramIndex = params.length;
        return `
          (
            COALESCE(ud.document_name, d.title, '') ILIKE $${paramIndex}
            OR COALESCE(d.file_ref, '') ILIKE $${paramIndex}
            OR COALESCE(c.section_title, '') ILIKE $${paramIndex}
            OR COALESCE(c.chunk_text, '') ILIKE $${paramIndex}
          )
        `;
      });
      whereClauses.push(`(${sourceClauses.join(' OR ')})`);
    }

    const rows = await runRawQuery(
      this.dataSource,
      `
        SELECT
          d.id AS "documentId",
          COALESCE(ud.document_name, d.title, 'Untitled document') AS "documentName",
          COALESCE(d.file_ref, '') AS "fileRef",
          COALESCE(c.chunk_text, '') AS "chunkText",
          c.section_title AS "sectionTitle",
          c.page_number AS "pageNumber"
        FROM user_documents ud
        INNER JOIN document d ON d.id = ud.document_id
        LEFT JOIN document_chunks dc ON dc.document_id = d.id
        LEFT JOIN chunks c ON c.id = dc.chunk_id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY d.created_at DESC, c.chunk_index ASC
      `,
      params,
    );
    const bestMatches = new Map<string, LexicalMatch>();

    for (const row of rows) {
      const lexicalRow = this.mapLexicalSearchRow(row);
      const match = this.resolveLexicalMatch(lexicalRow, query);

      if (!match) {
        continue;
      }

      const current = bestMatches.get(lexicalRow.documentId);

      if (!current || match.score > current.score) {
        bestMatches.set(lexicalRow.documentId, match);
      }
    }

    const rankedDocuments = [...bestMatches.entries()]
      .map(([documentId, match]) => ({
        documentId,
        score: match.score,
        matchType: match.matchType,
      }))
      .sort((left, right) => right.score - left.score);
    const insightMap = new Map<string, DocumentMatchInsight>(
      [...bestMatches.entries()].map(([documentId, match]) => [
        documentId,
        {
          documentId,
          snippet: match.snippet,
          chunkText: match.chunkText,
          sectionTitle: match.sectionTitle,
          pageNumber: match.pageNumber,
          score: match.score,
          matchType: match.matchType,
        },
      ]),
    );

    return this.getRankedDocumentSummaries(
      ownerId,
      rankedDocuments,
      query,
      insightMap,
    );
  }

  private buildLexicalSearchTerms(
    query: string,
    intent: SearchQueryIntent,
  ): string[] {
    const rawTerm = normalizeSearchText(query);
    const terms = new Set<string>();

    if (rawTerm) {
      terms.add(`%${rawTerm}%`);
    }

    if (intent.looksLikeFileName) {
      terms.add(`%${this.getFileName(rawTerm)}%`);
    }

    for (const token of intent.tokens.slice(0, 6)) {
      if (token.length >= 2) {
        terms.add(`%${token}%`);
      }
    }

    return [...terms];
  }

  private resolveLexicalMatch(
    row: LexicalSearchRow,
    query: string,
  ): LexicalMatch | null {
    const normalizedQuery = normalizeComparisonText(query);

    if (!normalizedQuery) {
      return null;
    }

    const queryTokens = this.extractComparisonTokens(query);
    const title = row.documentName;
    const fileName = this.getFileName(row.fileRef);
    const sectionTitle = row.sectionTitle ?? '';
    const chunkText = normalizeSearchText(row.chunkText);
    const titleMatch = this.getLexicalSourceMatch(
      title,
      normalizedQuery,
      queryTokens,
    );
    const fileNameMatch = this.getLexicalSourceMatch(
      fileName,
      normalizedQuery,
      queryTokens,
    );

    if (titleMatch === 'exact' || fileNameMatch === 'exact') {
      return {
        score: 1,
        matchType: 'title',
        snippet: title,
        chunkText: '',
        sectionTitle: null,
        pageNumber: null,
      };
    }

    if (titleMatch || fileNameMatch || this.isFileExtensionMatch(query, row)) {
      return {
        score: 0.94,
        matchType: 'title',
        snippet: title,
        chunkText: '',
        sectionTitle: null,
        pageNumber: null,
      };
    }

    if (
      this.getLexicalSourceMatch(sectionTitle, normalizedQuery, queryTokens)
    ) {
      return {
        score: 0.84,
        matchType: 'section',
        snippet: sectionTitle,
        chunkText,
        sectionTitle: row.sectionTitle,
        pageNumber: row.pageNumber,
      };
    }

    if (this.getLexicalSourceMatch(chunkText, normalizedQuery, queryTokens)) {
      return {
        score: 0.72,
        matchType: 'content',
        snippet: chunkText.slice(0, SOURCE_SNIPPET_LENGTH),
        chunkText,
        sectionTitle: row.sectionTitle,
        pageNumber: row.pageNumber,
      };
    }

    return null;
  }

  private getLexicalSourceMatch(
    source: string,
    normalizedQuery: string,
    queryTokens: string[],
  ): 'exact' | 'contains' | null {
    const normalizedSource = normalizeComparisonText(source);

    if (!normalizedSource) {
      return null;
    }

    if (normalizedSource === normalizedQuery) {
      return 'exact';
    }

    if (normalizedSource.includes(normalizedQuery)) {
      return 'contains';
    }

    if (
      queryTokens.length > 1 &&
      queryTokens.every((token) => normalizedSource.includes(token))
    ) {
      return 'contains';
    }

    return null;
  }

  private isFileExtensionMatch(query: string, row: LexicalSearchRow): boolean {
    const normalizedQuery = normalizeComparisonText(query);

    if (!SEARCH_FILE_EXTENSION_PATTERN.test(normalizedQuery)) {
      return false;
    }

    const extension = this.getFileName(row.fileRef || row.documentName)
      .split('.')
      .pop()
      ?.toLowerCase();

    return Boolean(
      extension && normalizedQuery.split(/\s+/).includes(extension),
    );
  }

  private getFileName(value: string): string {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      return '';
    }

    return normalizedValue.split(/[\\/]/).pop() || normalizedValue;
  }

  private async getRankedDocumentSummaries(
    ownerId: string,
    rankedDocuments: RankedSearchDocument[],
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
          document.matchType,
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

    const embeddingSql = toVectorSql(embedding);
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

    const rows = await runRawQuery(
      this.dataSource,
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

    const rows = await runRawQuery(
      this.dataSource,
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
      scopedFolderId: folder.id,
      isWorkspaceScope: false,
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
    } catch (error) {
      this.logger.warn(
        `pgvector.fromSql failed to parse embedding: ${error instanceof Error ? error.message : String(error)}`,
      );
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
      formattedFileSize: formatFileSize(userDocument.document?.fileSize || 0),
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
    const evidenceSnippet = this.resolveMatchSnippet(insight);
    const topics = this.extractMatchedConcepts(summary, query, insight);
    const matchLabel = this.buildMatchLabel(matchType);

    return {
      ...summary,
      matchType,
      score: score === null ? null : Number(score.toFixed(4)),
      relevanceLabel: this.buildRelevanceLabel(matchType),
      matchedConcepts: topics,
      matchSnippet: evidenceSnippet,
      matchSectionTitle: insight?.sectionTitle ?? null,
      matchPageNumber: insight?.pageNumber ?? null,
      matchLabel,
      matchReason: this.ragSearchExplanationService.buildFallbackReason({
        matchType,
      }),
      evidenceSnippet,
      topics,
    };
  }

  private shouldKeepSemanticResult(
    document: SearchResultDocument,
    query: string,
  ): boolean {
    if (document.matchType !== 'meaning') {
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
    const normalizedQuery = normalizeComparisonText(query);

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
      const normalizedSource = normalizeComparisonText(source ?? '');

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

  private buildRelevanceLabel(matchType: SearchMatchType): string {
    if (matchType !== 'meaning') {
      return this.buildMatchLabel(matchType);
    }

    return 'Meaning match';
  }

  private buildMatchLabel(matchType: SearchMatchType): string {
    if (matchType === 'title') {
      return 'Title match';
    }

    if (matchType === 'section') {
      return 'Section match';
    }

    if (matchType === 'content') {
      return 'Content match';
    }

    return 'Meaning match';
  }

  private mapRankedDocumentRow(row: RawRow): RankedDocumentRow {
    return {
      documentId: readRequiredString(row, 'documentId'),
      semanticScore: readNumber(row, 'semanticScore'),
    };
  }

  private mapChunkProgressRow(row: RawRow): ChunkProgressRow {
    return {
      documentId: readRequiredString(row, 'documentId'),
      documentName: readString(row, 'documentName', 'Untitled document'),
      totalChunks: readNumber(row, 'totalChunks'),
      embeddedChunks: readNumber(row, 'embeddedChunks'),
    };
  }

  private mapDocumentMatchInsightRow(row: RawRow): DocumentMatchInsight {
    return {
      documentId: readRequiredString(row, 'documentId'),
      snippet: readString(row, 'snippet'),
      chunkText: readString(row, 'chunkText'),
      sectionTitle: readNullableString(row, 'sectionTitle'),
      pageNumber: readNullableNumber(row, 'pageNumber'),
      score: readNullableNumber(row, 'score'),
      matchType: 'meaning',
    };
  }

  private mapLexicalSearchRow(row: RawRow): LexicalSearchRow {
    return {
      documentId: readRequiredString(row, 'documentId'),
      documentName: readString(row, 'documentName', 'Untitled document'),
      fileRef: readString(row, 'fileRef'),
      chunkText: readString(row, 'chunkText'),
      sectionTitle: readNullableString(row, 'sectionTitle'),
      pageNumber: readNullableNumber(row, 'pageNumber'),
    };
  }

  private resolveMatchSnippet(insight?: DocumentMatchInsight): string | null {
    const snippet = normalizeSearchText(
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

    const rankedConcepts = [...conceptScores.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, SEARCH_CONCEPT_LIMIT)
      .map(([phrase]) => phrase);

    if (rankedConcepts.length > 0) {
      return rankedConcepts;
    }

    return [];
  }

  private cleanConceptPhrase(value: string | null | undefined): string | null {
    const normalizedValue = normalizeSearchText(value ?? '');

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
      (CONTEXT_SEARCH_STOPWORDS.has(words[0]) ||
        SEARCH_CONCEPT_GENERIC_WORDS.has(words[0]))
    ) {
      words.shift();
    }

    while (
      words.length > 0 &&
      (CONTEXT_SEARCH_STOPWORDS.has(words[words.length - 1]) ||
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
          CONTEXT_SEARCH_STOPWORDS.has(word) ||
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
      normalizeSearchText(text)
        .toLowerCase()
        .split(/\s+/)
        .filter(
          (token) =>
            token.length > 2 &&
            !CONTEXT_SEARCH_STOPWORDS.has(token) &&
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

  private extractComparisonTokens(value: string): string[] {
    return normalizeComparisonText(value)
      .split(/\s+/)
      .filter((token) => token.length >= 2);
  }
}
