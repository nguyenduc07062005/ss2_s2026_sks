import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';
import { GeminiService } from 'src/common/llm/gemini.service';
import {
  DocumentSummaryResponse,
  StructuredDocumentSummary,
  SummaryArtifact,
  SummaryLanguage,
} from '../types/rag.types';
import { RagArtifactCacheService } from './rag-artifact-cache.service';
import { RagDocumentContextService } from './rag-document-context.service';
import { RagIndexingService } from './rag-indexing.service';

const MAX_SUMMARY_CONTEXT_CHUNKS = 12;

const SUMMARY_PROMPT_TEMPLATE = [
  'You are a senior academic and technical analyst.',
  'Create a faithful summary using ONLY the provided document context.',
  'Do not hallucinate facts, numbers, claims, or conclusions that are not present in the context.',
  'If the context is partial, keep the summary partial and explicit.',
  'Write the final answer entirely in {languageName}.',
  '',
  'Output requirements:',
  '- title: a short professional title',
  '- overview: 2 to 3 sentences explaining the document purpose and scope',
  '- key_points: 4 to 6 concise bullet-style statements',
  '- conclusion: 1 concise closing takeaway',
  '',
  'Document title: {documentTitle}',
  '',
  'Context:',
  '{context}',
].join('\n');

const SUMMARY_JSON_FALLBACK_PROMPT_TEMPLATE = [
  'You are a senior academic and technical analyst.',
  'Summarize the document using ONLY the provided context.',
  'Do not add facts that are not present in the context.',
  'Return ONLY valid JSON with this exact structure:',
  '{{',
  '  "title": "short professional title",',
  '  "overview": "2 to 3 sentences",',
  '  "key_points": ["point 1", "point 2", "point 3", "point 4"],',
  '  "conclusion": "1 concise takeaway"',
  '}}',
  'Write the full response in {languageName}.',
  '',
  'Document title: {documentTitle}',
  '',
  'Context:',
  '{context}',
].join('\n');

const SUMMARY_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: {
      type: 'string',
      description: 'A short, professional title for the document summary.',
    },
    overview: {
      type: 'string',
      description: 'A concise overview of the document in 2 to 3 sentences.',
    },
    key_points: {
      type: 'array',
      description: 'The most important ideas, methods, or findings.',
      items: {
        type: 'string',
      },
      minItems: 4,
      maxItems: 6,
    },
    conclusion: {
      type: 'string',
      description: 'A short closing takeaway grounded in the provided context.',
    },
  },
  required: ['title', 'overview', 'key_points', 'conclusion'],
} as const;

@Injectable()
export class RagSummaryService {
  private readonly logger = new Logger(RagSummaryService.name);
  private readonly summaryPrompt = PromptTemplate.fromTemplate(
    SUMMARY_PROMPT_TEMPLATE,
  );
  private readonly summaryJsonFallbackPrompt = PromptTemplate.fromTemplate(
    SUMMARY_JSON_FALLBACK_PROMPT_TEMPLATE,
  );

  constructor(
    private readonly geminiService: GeminiService,
    private readonly ragIndexingService: RagIndexingService,
    private readonly ragDocumentContextService: RagDocumentContextService,
    private readonly ragArtifactCacheService: RagArtifactCacheService,
  ) {}

  async generateSummary(
    documentId: string,
    ownerId: string,
    language: SummaryLanguage = 'en',
  ): Promise<DocumentSummaryResponse> {
    const document = await this.ragDocumentContextService.ensureOwnedDocument(
      documentId,
      ownerId,
    );
    const cachedSummary = this.ragArtifactCacheService.getSummary(
      document,
      language,
    );

    if (cachedSummary) {
      return {
        ...cachedSummary,
        cached: true,
      };
    }

    await this.ragIndexingService.ensureDocumentIndexed(documentId);

    const representativeChunks =
      await this.ragDocumentContextService.getRepresentativeChunks(
        documentId,
        MAX_SUMMARY_CONTEXT_CHUNKS,
      );

    if (representativeChunks.length === 0) {
      throw new BadRequestException(
        'This document has no indexed content available for summary generation.',
      );
    }

    const summary = await this.generateStructuredSummary({
      documentTitle: document.title ?? 'Untitled document',
      context:
        this.ragDocumentContextService.buildSummaryContext(
          representativeChunks,
        ),
      languageName: this.getLanguageName(language),
    });
    const normalizedSummary = this.normalizeSummary(
      summary,
      document.title ?? 'Untitled document',
      language,
    );
    const summaryArtifact: SummaryArtifact = {
      ...normalizedSummary,
      language,
      generatedAt: new Date().toISOString(),
      sources: this.ragDocumentContextService.buildSources(
        documentId,
        document.title ?? 'Untitled document',
        representativeChunks,
      ),
    };

    await this.ragArtifactCacheService.saveSummary(document, summaryArtifact);

    return {
      ...summaryArtifact,
      cached: false,
    };
  }

  toPlainText(summary: StructuredDocumentSummary): string {
    const sections = [
      summary.title,
      summary.overview,
      'Key points:',
      ...summary.key_points.map((point) => `- ${point}`),
      'Conclusion:',
      summary.conclusion,
    ];

    return sections.join('\n').trim();
  }

  private async generateStructuredSummary(input: {
    documentTitle: string;
    context: string;
    languageName: string;
  }): Promise<StructuredDocumentSummary> {
    const baseModel = this.geminiService.createChatModel({
      temperature: 0.2,
      maxOutputTokens: 900,
      topP: 0.85,
    });

    try {
      const structuredSummary = this.coerceStructuredSummary(
        await this.summaryPrompt
          .pipe(
            baseModel.withStructuredOutput(SUMMARY_OUTPUT_SCHEMA, {
              method: 'jsonSchema',
            }),
          )
          .invoke(input),
      );

      if (structuredSummary) {
        return structuredSummary;
      }

      this.logger.warn(
        'Summary generation with JSON schema returned an empty structured payload. Falling back to function calling.',
      );
    } catch (jsonSchemaError) {
      this.logger.warn(
        `Summary generation fell back to function calling: ${this.toErrorMessage(
          jsonSchemaError,
        )}`,
      );
    }

    try {
      const structuredSummary = this.coerceStructuredSummary(
        await this.summaryPrompt
          .pipe(
            baseModel.withStructuredOutput(SUMMARY_OUTPUT_SCHEMA, {
              method: 'functionCalling',
              name: 'document_summary',
            }),
          )
          .invoke(input),
      );

      if (structuredSummary) {
        return structuredSummary;
      }

      this.logger.warn(
        'Summary generation with function calling returned an empty structured payload. Falling back to raw Gemini JSON mode.',
      );
    } catch (fallbackError) {
      this.logger.warn(
        `Summary generation fell back to raw Gemini JSON mode: ${this.toErrorMessage(
          fallbackError,
        )}`,
      );
    }

    try {
      const prompt = await this.summaryJsonFallbackPrompt.format(input);
      const rawResponse = await this.geminiService.generateText(prompt);
      return this.parseRawSummaryResponse(rawResponse);
    } catch (rawFallbackError) {
      this.logger.error(
        'Summary generation failed after LangChain and raw Gemini fallback.',
        this.toErrorStack(rawFallbackError),
      );
      throw this.toSummaryGenerationException(rawFallbackError);
    }
  }

  private normalizeSummary(
    summary: StructuredDocumentSummary | null | undefined,
    documentTitle: string,
    language: SummaryLanguage,
  ): StructuredDocumentSummary {
    const safeSummary = this.coerceStructuredSummary(summary);
    const fallbackCopy =
      language === 'vi'
        ? {
            title: `Tóm tắt ${documentTitle}`,
            overview:
              'Không thể trích xuất đầy đủ phần tổng quan từ ngữ cảnh hiện có của tài liệu.',
            keyPoints: [
              'Ngữ cảnh trích xuất từ tài liệu chưa đủ rõ để rút ra toàn bộ ý chính.',
            ],
            conclusion:
              'Bản tóm tắt hiện tại chỉ phản ánh phần nội dung đã được trích xuất thành công.',
          }
        : {
            title: `Summary of ${documentTitle}`,
            overview:
              'The available context was not sufficient to extract a complete overview of the document.',
            keyPoints: [
              'The extracted context was not sufficient to recover all important points reliably.',
            ],
            conclusion:
              'This summary reflects only the content that was successfully extracted.',
          };

    const keyPoints = Array.isArray(safeSummary?.key_points)
      ? safeSummary.key_points
          .map((point) => this.normalizeLine(point))
          .filter((point): point is string => Boolean(point))
          .slice(0, 6)
      : [];

    return {
      title: this.normalizeLine(safeSummary?.title) || fallbackCopy.title,
      overview:
        this.normalizeParagraph(safeSummary?.overview) || fallbackCopy.overview,
      key_points: keyPoints.length > 0 ? keyPoints : fallbackCopy.keyPoints,
      conclusion:
        this.normalizeParagraph(safeSummary?.conclusion) ||
        fallbackCopy.conclusion,
    };
  }

  private getLanguageName(language: SummaryLanguage): string {
    return language === 'vi' ? 'Vietnamese' : 'English';
  }

  private normalizeLine(value: string | null | undefined): string {
    return (value ?? '').replace(/\s+/g, ' ').trim();
  }

  private normalizeParagraph(value: string | null | undefined): string {
    return (value ?? '').replace(/\s+/g, ' ').trim();
  }

  private parseRawSummaryResponse(
    rawResponse: string,
  ): StructuredDocumentSummary {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Raw Gemini fallback did not return JSON.');
    }

    const parsed = JSON.parse(
      jsonMatch[0],
    ) as Partial<StructuredDocumentSummary>;

    const structuredSummary = this.coerceStructuredSummary({
      title: typeof parsed.title === 'string' ? parsed.title : '',
      overview: typeof parsed.overview === 'string' ? parsed.overview : '',
      key_points: Array.isArray(parsed.key_points)
        ? parsed.key_points.filter(
            (point): point is string => typeof point === 'string',
          )
        : [],
      conclusion:
        typeof parsed.conclusion === 'string' ? parsed.conclusion : '',
    });

    if (!structuredSummary) {
      throw new Error('Raw Gemini fallback returned an empty summary payload.');
    }

    return structuredSummary;
  }

  private coerceStructuredSummary(
    summary: unknown,
  ): StructuredDocumentSummary | null {
    if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
      return null;
    }

    const candidate = summary as Record<string, unknown>;
    const keyPointsValue = Array.isArray(candidate.key_points)
      ? candidate.key_points
      : Array.isArray(candidate.keyPoints)
        ? candidate.keyPoints
        : [];
    const keyPoints = keyPointsValue.filter(
      (point): point is string => typeof point === 'string',
    );
    const title = typeof candidate.title === 'string' ? candidate.title : '';
    const overview =
      typeof candidate.overview === 'string' ? candidate.overview : '';
    const conclusion =
      typeof candidate.conclusion === 'string' ? candidate.conclusion : '';

    if (
      !this.normalizeLine(title) &&
      !this.normalizeParagraph(overview) &&
      keyPoints.length === 0 &&
      !this.normalizeParagraph(conclusion)
    ) {
      return null;
    }

    return {
      title,
      overview,
      key_points: keyPoints,
      conclusion,
    };
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  private toErrorStack(error: unknown): string | undefined {
    if (error instanceof Error) {
      return error.stack;
    }

    return undefined;
  }

  private toSummaryGenerationException(
    error: unknown,
  ): BadGatewayException | ServiceUnavailableException {
    const normalizedMessage = this.toErrorMessage(error).toLowerCase();

    if (
      normalizedMessage.includes('resource_exhausted') ||
      normalizedMessage.includes('quota exceeded') ||
      normalizedMessage.includes('429 too many requests')
    ) {
      return new ServiceUnavailableException(
        'Gemini API quota is exhausted. Please update the API key or billing/quota configuration, then try generating the summary again.',
      );
    }

    if (
      normalizedMessage.includes('model') &&
      normalizedMessage.includes('not found')
    ) {
      return new ServiceUnavailableException(
        'The configured Gemini model is unavailable. Please update the backend Gemini model configuration and try again.',
      );
    }

    return new BadGatewayException(
      'Summary generation failed. Please try again in a moment.',
    );
  }
}
