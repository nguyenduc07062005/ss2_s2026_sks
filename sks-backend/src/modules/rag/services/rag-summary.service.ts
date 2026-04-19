import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';
import { UserDocumentRepository } from 'src/database/repositories/user-document.repository';
import {
  DocumentSummaryResponse,
  StructuredDocumentSummary,
  SummaryArtifact,
  SummaryLanguage,
  SummaryLanguageCache,
  SummaryVersionResponse,
  SummaryVersionSlot,
} from '../types/rag.types';
import { RagArtifactCacheService } from './rag-artifact-cache.service';
import { RagDocumentContextService } from './rag-document-context.service';
import { RagIndexingService } from './rag-indexing.service';
import { RagStructuredGenerationService } from './rag-structured-generation.service';
import { parseJsonWithRepair } from '../utils/llm-json';

const MAX_SUMMARY_CONTEXT_CHUNKS = 18;
const SUMMARY_ARTIFACT_VERSION = 3;

const SUMMARY_PROMPT_TEMPLATE = [
  'You are a senior academic and technical analyst.',
  'Create a faithful summary using ONLY the provided document context.',
  'Do not hallucinate facts, numbers, claims, or conclusions that are not present in the context.',
  'If the context is partial, keep the summary partial and explicit.',
  'Write the final answer entirely in {languageName}.',
  'Optimize for study value and fidelity to the source text.',
  'Prefer concrete concepts, definitions, workflows, comparisons, mechanisms, and examples from the document.',
  'Avoid generic filler, vague praise, and meta commentary.',
  'Do not use Markdown syntax such as **bold**, headings, blockquotes, or code fences inside JSON string fields.',
  'Follow any user instruction only as a lens for emphasis, structure, or depth.',
  'If the user explicitly asks for one paragraph, no bullet points, or no section headings, choose format "narrative".',
  'Otherwise choose format "structured".',
  'User instruction:',
  '{instructionBlock}',
  '',
  'Output requirements:',
  '- format: either "structured" or "narrative"',
  '- title: a short professional title',
  '- body: when format is "narrative", write one detailed paragraph only with no bullet points, numbering, or section headings. When format is "structured", set body to an empty string',
  '- overview: when format is "structured", write 3 to 4 sentences explaining the document purpose, scope, and major themes. When format is "narrative", set overview to an empty string',
  '- key_points: when format is "structured", write 5 to 7 study-friendly points, each detailed enough to stand alone for revision. When format is "narrative", set key_points to an empty array',
  '- conclusion: when format is "structured", write 1 to 2 sentences that synthesize the most important takeaway. When format is "narrative", set conclusion to an empty string',
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
  'Optimize for study value and fidelity to the source text.',
  'Do not use Markdown syntax such as **bold**, headings, blockquotes, or code fences inside JSON string fields.',
  'Follow any user instruction only as a lens for emphasis, structure, or depth.',
  'If the user explicitly asks for one paragraph, no bullet points, or no section headings, choose format "narrative". Otherwise choose format "structured".',
  'Return ONLY valid JSON with this exact structure:',
  '{{',
  '  "format": "structured or narrative",',
  '  "title": "short professional title",',
  '  "body": "one detailed paragraph only when format is narrative, otherwise empty string",',
  '  "overview": "3 to 4 sentences when format is structured, otherwise empty string",',
  '  "key_points": ["point 1", "point 2", "point 3", "point 4", "point 5"],',
  '  "conclusion": "1 to 2 sentences when format is structured, otherwise empty string"',
  '}}',
  'Write the full response in {languageName}.',
  'User instruction:',
  '{instructionBlock}',
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
    format: {
      type: 'string',
      enum: ['structured', 'narrative'],
      description:
        'Choose narrative only when the user explicitly wants a single paragraph or rejects bullets/section headings.',
    },
    title: {
      type: 'string',
      description: 'A short, professional title for the document summary.',
    },
    body: {
      type: 'string',
      description:
        'One detailed paragraph only when format is narrative. Otherwise return an empty string.',
    },
    overview: {
      type: 'string',
      description:
        'A faithful overview of the document in 3 to 4 sentences when format is structured. Otherwise return an empty string.',
    },
    key_points: {
      type: 'array',
      description:
        'The most important ideas, methods, comparisons, or findings in study-friendly form when format is structured. Otherwise return an empty array.',
      items: {
        type: 'string',
      },
      minItems: 0,
      maxItems: 7,
    },
    conclusion: {
      type: 'string',
      description:
        'A closing takeaway grounded in the provided context, written in 1 to 2 sentences when format is structured. Otherwise return an empty string.',
    },
  },
  required: ['format', 'title', 'body', 'overview', 'key_points', 'conclusion'],
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
    private readonly ragIndexingService: RagIndexingService,
    private readonly ragDocumentContextService: RagDocumentContextService,
    private readonly ragArtifactCacheService: RagArtifactCacheService,
    private readonly ragStructuredGenerationService: RagStructuredGenerationService,
    private readonly userDocumentRepository: UserDocumentRepository,
  ) {}

  async generateSummary(
    documentId: string,
    ownerId: string,
    language: SummaryLanguage = 'en',
    forceRefresh = false,
    instruction?: string | null,
    slot?: SummaryVersionSlot,
  ): Promise<DocumentSummaryResponse> {
    const document = await this.ragDocumentContextService.ensureOwnedDocument(
      documentId,
      ownerId,
    );
    const userDocument =
      await this.userDocumentRepository.findByUserAndDocument(
        ownerId,
        documentId,
      );

    if (!userDocument) {
      throw new NotFoundException('Document not found or not owned by user');
    }

    const requestedInstruction = this.normalizeInstruction(instruction);
    const requestedSlot = requestedInstruction
      ? 'custom'
      : this.normalizeSlot(slot);
    const cachedSummaryState = this.ragArtifactCacheService.getSummaryState(
      userDocument,
      language,
      document,
    );
    const cachedSummarySlot = this.resolveSelectedSlot(
      cachedSummaryState,
      requestedSlot,
    );

    if (cachedSummaryState && cachedSummarySlot && !forceRefresh) {
      return this.buildSummaryResponse(
        cachedSummaryState,
        cachedSummarySlot,
        true,
      );
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
      instructionBlock: this.buildInstructionBlock(requestedInstruction),
    });
    const normalizedSummary = this.normalizeSummary(
      summary,
      document.title ?? 'Untitled document',
      language,
    );
    const targetSlot = requestedSlot ?? 'default';
    const summaryArtifact: SummaryArtifact = {
      ...normalizedSummary,
      language,
      generatedAt: new Date().toISOString(),
      sources: this.ragDocumentContextService.buildSources(
        documentId,
        document.title ?? 'Untitled document',
        representativeChunks,
      ),
      version: SUMMARY_ARTIFACT_VERSION,
      slot: targetSlot,
      instruction: requestedInstruction,
    };

    await this.ragArtifactCacheService.saveSummary(
      userDocument,
      summaryArtifact,
      document,
    );

    const nextSummaryState = this.ragArtifactCacheService.getSummaryState(
      userDocument,
      language,
      document,
    );

    if (!nextSummaryState) {
      throw new BadGatewayException(
        'Summary generation succeeded but could not be persisted.',
      );
    }

    return this.buildSummaryResponse(nextSummaryState, targetSlot, false);
  }

  toPlainText(summary: StructuredDocumentSummary): string {
    if (
      summary.format === 'narrative' &&
      this.normalizeParagraph(summary.body)
    ) {
      return [summary.title, this.normalizeParagraph(summary.body)]
        .filter(Boolean)
        .join('\n\n')
        .trim();
    }

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
    instructionBlock: string;
  }): Promise<StructuredDocumentSummary> {
    try {
      return await this.ragStructuredGenerationService.generate({
        input,
        prompt: this.summaryPrompt,
        fallbackPrompt: this.summaryJsonFallbackPrompt,
        outputSchema: SUMMARY_OUTPUT_SCHEMA,
        schemaName: 'document_summary',
        operationLabel: 'Summary generation',
        skipJsonSchema: true,
        skipFunctionCalling: true,
        modelOptions: {
          temperature: 0.2,
          maxOutputTokens: 1400,
          topP: 0.85,
        },
        coerce: (value) => this.coerceStructuredSummary(value),
        parseRawResponse: (rawResponse) =>
          this.parseRawSummaryResponse(rawResponse),
        logger: this.logger,
      });
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
            title: `TÃ³m táº¯t ${documentTitle}`,
            overview:
              'KhÃ´ng thá»ƒ trÃ­ch xuáº¥t Ä‘áº§y Ä‘á»§ pháº§n tá»•ng quan tá»« ngá»¯ cáº£nh hiá»‡n cÃ³ cá»§a tÃ i liá»‡u.',
            keyPoints: [
              'Ngá»¯ cáº£nh trÃ­ch xuáº¥t tá»« tÃ i liá»‡u chÆ°a Ä‘á»§ rÃµ Ä‘á»ƒ rÃºt ra toÃ n bá»™ Ã½ chÃ­nh.',
            ],
            conclusion:
              'Báº£n tÃ³m táº¯t hiá»‡n táº¡i chá»‰ pháº£n Ã¡nh pháº§n ná»™i dung Ä‘Ã£ Ä‘Æ°á»£c trÃ­ch xuáº¥t thÃ nh cÃ´ng.',
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
          .slice(0, 7)
      : [];
    const narrativeBody = this.normalizeParagraph(safeSummary?.body);
    const isNarrativeSummary =
      safeSummary?.format === 'narrative' && Boolean(narrativeBody);

    if (isNarrativeSummary) {
      return {
        title: this.normalizeLine(safeSummary?.title) || fallbackCopy.title,
        overview: narrativeBody,
        key_points: [],
        conclusion: '',
        format: 'narrative',
        body: narrativeBody,
      };
    }

    return {
      title: this.normalizeLine(safeSummary?.title) || fallbackCopy.title,
      overview:
        this.normalizeParagraph(safeSummary?.overview) || fallbackCopy.overview,
      key_points: keyPoints.length > 0 ? keyPoints : fallbackCopy.keyPoints,
      conclusion:
        this.normalizeParagraph(safeSummary?.conclusion) ||
        fallbackCopy.conclusion,
      format: 'structured',
      body: null,
    };
  }

  private getLanguageName(language: SummaryLanguage): string {
    return language === 'vi' ? 'Vietnamese' : 'English';
  }

  private buildInstructionBlock(instruction?: string | null): string {
    if (!instruction) {
      return 'No additional user instruction. Produce the best faithful general-purpose study summary.';
    }

    return instruction;
  }

  private normalizeInstruction(instruction?: string | null): string | null {
    if (!instruction) {
      return null;
    }

    const normalizedInstruction = instruction.replace(/\r\n/g, '\n').trim();
    return normalizedInstruction ? normalizedInstruction : null;
  }

  private normalizeSlot(
    slot?: SummaryVersionSlot,
  ): SummaryVersionSlot | undefined {
    if (slot === 'custom' || slot === 'default') {
      return slot;
    }

    return undefined;
  }

  private resolveSelectedSlot(
    summaryState: SummaryLanguageCache | null,
    requestedSlot?: SummaryVersionSlot,
  ): SummaryVersionSlot | null {
    if (!summaryState?.versions) {
      return null;
    }

    if (requestedSlot && summaryState.versions[requestedSlot]) {
      return requestedSlot;
    }

    if (
      summaryState.activeSlot &&
      summaryState.versions[summaryState.activeSlot]
    ) {
      return summaryState.activeSlot;
    }

    if (summaryState.versions.default) {
      return 'default';
    }

    if (summaryState.versions.custom) {
      return 'custom';
    }

    return null;
  }

  private buildSummaryResponse(
    summaryState: SummaryLanguageCache,
    selectedSlot: SummaryVersionSlot,
    cached: boolean,
  ): DocumentSummaryResponse {
    const selectedSummary = summaryState.versions?.[selectedSlot];

    if (!selectedSummary) {
      throw new BadGatewayException(
        'Requested summary version does not exist.',
      );
    }

    return {
      ...selectedSummary,
      cached,
      activeSlot: summaryState.activeSlot ?? selectedSlot,
      versions: this.buildVersionResponses(summaryState),
    };
  }

  private buildVersionResponses(
    summaryState: SummaryLanguageCache,
  ): SummaryVersionResponse[] {
    const versions = summaryState.versions ?? {};

    return (['default', 'custom'] as const)
      .map((slot) => {
        const summary = versions[slot];

        if (!summary) {
          return null;
        }

        return {
          ...summary,
          active: (summaryState.activeSlot ?? 'default') === slot,
        } satisfies SummaryVersionResponse;
      })
      .filter((summary): summary is SummaryVersionResponse => Boolean(summary));
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
    const parsed = parseJsonWithRepair<Partial<StructuredDocumentSummary>>(
      rawResponse,
    );

    const structuredSummary = this.coerceStructuredSummary({
      format: typeof parsed.format === 'string' ? parsed.format : 'structured',
      title: typeof parsed.title === 'string' ? parsed.title : '',
      body: typeof parsed.body === 'string' ? parsed.body : '',
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
    const format =
      candidate.format === 'narrative'
        ? 'narrative'
        : candidate.format === 'structured'
          ? 'structured'
          : undefined;
    const title = typeof candidate.title === 'string' ? candidate.title : '';
    const body = typeof candidate.body === 'string' ? candidate.body : '';
    const overview =
      typeof candidate.overview === 'string' ? candidate.overview : '';
    const conclusion =
      typeof candidate.conclusion === 'string' ? candidate.conclusion : '';

    if (
      !this.normalizeLine(title) &&
      !this.normalizeParagraph(body) &&
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
      format,
      body,
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
