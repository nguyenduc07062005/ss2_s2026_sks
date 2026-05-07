import { Inject, Injectable, Logger } from '@nestjs/common';
import { LLM_GENERATION_SERVICE } from 'src/common/llm/llm-generation.types';
import type { LlmGenerationService } from 'src/common/llm/llm-generation.types';
import { normalizeSearchText } from 'src/common/utils/text-normalization.util';
import type { SearchResultDocument } from './rag-search.service';

const SEARCH_REASON_MAX_EVIDENCE_LENGTH = 700;
const SEARCH_REASON_BATCH_MAX_EVIDENCE_LENGTH = 280;
const SEARCH_REASON_MAX_LENGTH = 260;
const SEARCH_REASON_MAX_OUTPUT_TOKENS = 256;
const SEARCH_REASON_BATCH_BASE_OUTPUT_TOKENS = 160;
const SEARCH_REASON_BATCH_OUTPUT_TOKENS_PER_DOCUMENT = 120;
const SEARCH_REASON_BATCH_MAX_OUTPUT_TOKENS = 1600;
const SEARCH_REASON_TIMEOUT_MS = 7000;

type BatchedSearchReasonDraft = {
  index?: unknown;
  reason?: unknown;
};

@Injectable()
export class RagSearchExplanationService {
  private readonly logger = new Logger(RagSearchExplanationService.name);

  constructor(
    @Inject(LLM_GENERATION_SERVICE)
    private readonly generationService: LlmGenerationService,
  ) {}

  async enrichSearchReasons(
    documents: SearchResultDocument[],
    query: string,
  ): Promise<SearchResultDocument[]> {
    if (documents.length <= 1) {
      return Promise.all(
        documents.map(async (document) => ({
          ...document,
          matchReason: await this.generateAiMatchReason(document, query),
        })),
      );
    }

    return this.generateBatchedAiMatchReasons(documents, query);
  }

  private async generateBatchedAiMatchReasons(
    documents: SearchResultDocument[],
    query: string,
  ): Promise<SearchResultDocument[]> {
    try {
      const rawReasons = await this.withTimeout(
        this.generationService.generateText(
          this.buildBatchedSearchReasonPrompt(documents, query),
          {
            temperature: 0.1,
            topP: 0.8,
            maxOutputTokens: this.getBatchedReasonOutputTokenBudget(
              documents.length,
            ),
            responseMimeType: 'application/json',
          },
        ),
        SEARCH_REASON_TIMEOUT_MS,
        'Search match reason generation timed out',
      );
      const reasonMap = this.parseBatchedAiMatchReasons(rawReasons);

      return documents.map((document, index) => {
        const cleanedReason = this.cleanAiMatchReason(
          reasonMap.get(index) ?? '',
        );

        if (!this.isUsableAiMatchReason(cleanedReason)) {
          return document;
        }

        return {
          ...document,
          matchReason: cleanedReason,
        };
      });
    } catch (error) {
      this.logger.warn(
        `Search match reason generation failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return documents;
    }
  }

  buildFallbackReason(
    document: Pick<SearchResultDocument, 'matchType'>,
  ): string {
    if (document.matchType === 'title') {
      return 'The document title or file name is the closest match for this search.';
    }

    if (document.matchType === 'section') {
      return 'A section in this document matches the search request.';
    }

    if (document.matchType === 'content') {
      return 'The document content contains information related to the search request.';
    }

    return 'The document discusses ideas that are meaningfully related to the search request.';
  }

  private async generateAiMatchReason(
    document: SearchResultDocument,
    query: string,
  ): Promise<string> {
    const fallbackReason = document.matchReason;

    try {
      const reason = await this.withTimeout(
        this.generationService.generateText(
          this.buildSearchReasonPrompt(document, query),
          {
            temperature: 0.1,
            topP: 0.8,
            maxOutputTokens: SEARCH_REASON_MAX_OUTPUT_TOKENS,
          },
        ),
        SEARCH_REASON_TIMEOUT_MS,
        'Search match reason generation timed out',
      );
      const cleanedReason = this.cleanAiMatchReason(reason);

      if (!this.isUsableAiMatchReason(cleanedReason)) {
        return fallbackReason;
      }

      return cleanedReason;
    } catch (error) {
      this.logger.warn(
        `Search match reason generation failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return fallbackReason;
    }
  }

  private buildSearchReasonPrompt(
    document: SearchResultDocument,
    query: string,
  ): string {
    const evidence = this.truncateSearchReasonText(
      normalizeSearchText(
        document.evidenceSnippet || document.matchSnippet || '',
      ),
      SEARCH_REASON_MAX_EVIDENCE_LENGTH,
    );
    const section = normalizeSearchText(document.matchSectionTitle || '');

    return [
      'You write user-facing search result explanations for an academic document app.',
      'Use only the provided title, match label, section, and evidence.',
      'Return exactly one concise sentence.',
      'Write in the same language as the user query.',
      'Do not mention chunks, embeddings, vectors, scores, retrieval, fallback, or internal search mechanics.',
      'Do not quote long evidence. Do not invent facts.',
      '',
      `User query: ${query}`,
      `Match label: ${document.matchLabel}`,
      `Document title: ${document.title}`,
      `Section: ${section || 'Not available'}`,
      `Evidence: ${evidence || 'Not available'}`,
      '',
      'One-sentence reason:',
    ].join('\n');
  }

  private buildBatchedSearchReasonPrompt(
    documents: SearchResultDocument[],
    query: string,
  ): string {
    const results = documents.map((document, index) => ({
      index,
      title: normalizeSearchText(document.title),
      matchLabel: document.matchLabel,
      section:
        normalizeSearchText(document.matchSectionTitle || '') ||
        'Not available',
      evidence:
        this.truncateSearchReasonText(
          normalizeSearchText(
            document.evidenceSnippet || document.matchSnippet || '',
          ),
          SEARCH_REASON_BATCH_MAX_EVIDENCE_LENGTH,
        ) || 'Not available',
    }));

    return [
      'You write user-facing search result explanations for an academic document app.',
      'Use only the provided query and result data.',
      'Return ONLY valid JSON. Do not include Markdown, comments, or code fences.',
      'Use this exact JSON shape: {"reasons":[{"index":0,"reason":"one concise sentence"}]}.',
      'Write each reason in the same language as the user query.',
      'Each reason must be one concise sentence.',
      'Do not mention chunks, embeddings, vectors, scores, retrieval, fallback, or internal search mechanics.',
      'Do not invent facts.',
      '',
      `User query: ${query}`,
      'Results JSON:',
      JSON.stringify(results),
    ].join('\n');
  }

  private parseBatchedAiMatchReasons(rawResponse: string): Map<number, string> {
    const jsonText = this.extractJsonObjectText(rawResponse);
    const parsed = JSON.parse(jsonText) as unknown;
    const rawReasons = Array.isArray(parsed)
      ? parsed
      : typeof parsed === 'object' && parsed !== null && 'reasons' in parsed
        ? (parsed as { reasons?: unknown }).reasons
        : undefined;
    const reasons = Array.isArray(rawReasons) ? rawReasons : [];
    const reasonMap = new Map<number, string>();

    for (const item of reasons) {
      const draft = item as BatchedSearchReasonDraft;
      const index =
        typeof draft.index === 'number' && Number.isInteger(draft.index)
          ? draft.index
          : -1;
      const reason = typeof draft.reason === 'string' ? draft.reason : '';

      if (index >= 0 && reason.trim()) {
        reasonMap.set(index, reason);
      }
    }

    return reasonMap;
  }

  private extractJsonObjectText(rawResponse: string): string {
    const normalizedResponse = rawResponse
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```$/u, '')
      .trim();

    if (normalizedResponse.startsWith('{')) {
      return normalizedResponse;
    }

    const startIndex = normalizedResponse.indexOf('{');
    const endIndex = normalizedResponse.lastIndexOf('}');

    if (startIndex >= 0 && endIndex > startIndex) {
      return normalizedResponse.slice(startIndex, endIndex + 1);
    }

    return normalizedResponse;
  }

  private getBatchedReasonOutputTokenBudget(documentCount: number): number {
    return Math.min(
      SEARCH_REASON_BATCH_MAX_OUTPUT_TOKENS,
      Math.max(
        SEARCH_REASON_MAX_OUTPUT_TOKENS,
        SEARCH_REASON_BATCH_BASE_OUTPUT_TOKENS +
          documentCount * SEARCH_REASON_BATCH_OUTPUT_TOKENS_PER_DOCUMENT,
      ),
    );
  }

  private cleanAiMatchReason(value: string): string {
    const normalizedValue = normalizeSearchText(value)
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/^(?:reason|why this matches)\s*:\s*/i, '')
      .replace(/^[-*]\s*/, '')
      .trim();

    return this.truncateSearchReasonText(
      normalizedValue,
      SEARCH_REASON_MAX_LENGTH,
    );
  }

  private isUsableAiMatchReason(value: string): boolean {
    if (!value || value.length < 12) {
      return false;
    }

    return !/\b(?:chunk|embedding|vector|score|retrieval|fallback|semantic score|raw)\b/i.test(
      value,
    );
  }

  private truncateSearchReasonText(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }

    const truncatedValue = value.slice(0, maxLength).trim();
    const lastSentenceEnd = Math.max(
      truncatedValue.lastIndexOf('.'),
      truncatedValue.lastIndexOf('!'),
      truncatedValue.lastIndexOf('?'),
    );

    if (lastSentenceEnd >= Math.floor(maxLength * 0.45)) {
      return truncatedValue.slice(0, lastSentenceEnd + 1).trim();
    }

    return `${truncatedValue.replace(/\s+\S*$/, '')}...`;
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string,
  ): Promise<T> {
    let timeout: NodeJS.Timeout | undefined;

    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error(timeoutMessage)),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
}
