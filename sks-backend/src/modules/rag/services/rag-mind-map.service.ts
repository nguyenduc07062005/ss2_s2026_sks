import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';
import {
  DocumentMindMapResponse,
  MindMapNode,
  StructuredDocumentSummary,
  SummaryLanguage,
} from '../types/rag.types';
import { RagArtifactCacheService } from './rag-artifact-cache.service';
import { RagDocumentContextService } from './rag-document-context.service';
import { RagIndexingService } from './rag-indexing.service';
import { RagStructuredGenerationService } from './rag-structured-generation.service';
import { RagSummaryService } from './rag-summary.service';

const MIND_MAP_CONTEXT_CHUNKS = 18;
const MIND_MAP_ARTIFACT_VERSION = 3;

const MIND_MAP_PROMPT = [
  'You are a senior academic and technical analyst building an interactive mind map.',
  'Use ONLY the provided document context.',
  'Do not invent facts, claims, or structure that are not grounded in the context.',
  'Write all text in {languageName}.',
  'Optimize for learning: keep only concepts, steps, relationships, mechanisms, examples, or conclusions that are genuinely useful to study.',
  'Do not include admin noise, generic filler, repeated paraphrases, or vague meta commentary.',
  '',
  'Create a hierarchical structure suitable for progressive expansion in a UI.',
  'Requirements:',
  '- title: short document title',
  '- overview: 2 to 3 sentences describing the document purpose and scope',
  '- overviewDetails: 0 to 2 short supporting details, only when they add study value',
  '- clusters: 3 to 5 thematic branches',
  '- each cluster must have a short label, a study-friendly summary of 1 to 2 sentences, and 2 to 4 points',
  '- each point must have a short label, a study-friendly summary of 1 to 2 sentences using exact document terms when useful, and 0 to 2 supporting details only when they clarify the point',
  '- takeaway: 1 concise closing takeaway',
  '- takeawayDetails: 0 to 1 supporting details for the takeaway',
  '',
  'Document title: {documentTitle}',
  '',
  'Context:',
  '{context}',
].join('\n');

const MIND_MAP_JSON_FALLBACK_PROMPT = [
  'You are a senior academic and technical analyst building an interactive mind map.',
  'Use ONLY the provided document context and return ONLY valid JSON.',
  'Write the full response in {languageName}.',
  'Optimize for learning and clarity. Exclude admin noise, repeated paraphrases, and vague meta commentary.',
  'Return JSON using this exact structure:',
  '{{',
  '  "title": "short document title",',
  '  "overview": "2 to 3 sentences",',
  '  "overviewDetails": ["detail 1"],',
  '  "clusters": [',
  '    {{',
  '      "label": "branch label",',
  '      "summary": "1 to 2 study-friendly sentences",',
  '      "points": [',
  '        {{',
  '          "label": "point label",',
  '          "summary": "1 to 2 study-friendly sentences",',
  '          "details": ["supporting detail 1"]',
  '        }}',
  '      ]',
  '    }}',
  '  ],',
  '  "takeaway": "1 concise closing takeaway",',
  '  "takeawayDetails": ["supporting detail 1"]',
  '}}',
  '',
  'Document title: {documentTitle}',
  '',
  'Context:',
  '{context}',
].join('\n');

const MIND_MAP_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    overview: { type: 'string' },
    overviewDetails: {
      type: 'array',
      items: { type: 'string' },
      minItems: 0,
      maxItems: 2,
    },
    clusters: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string' },
          summary: { type: 'string' },
          points: {
            type: 'array',
            minItems: 2,
            maxItems: 4,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                label: { type: 'string' },
                summary: { type: 'string' },
                details: {
                  type: 'array',
                  minItems: 0,
                  maxItems: 2,
                  items: { type: 'string' },
                },
              },
              required: ['label', 'summary', 'details'],
            },
          },
        },
        required: ['label', 'summary', 'points'],
      },
    },
    takeaway: { type: 'string' },
    takeawayDetails: {
      type: 'array',
      items: { type: 'string' },
      minItems: 0,
      maxItems: 1,
    },
  },
  required: [
    'title',
    'overview',
    'overviewDetails',
    'clusters',
    'takeaway',
    'takeawayDetails',
  ],
} as const;

type MindMapDraftPoint = {
  label: string;
  summary: string;
  details: string[];
};

type MindMapDraftCluster = {
  label: string;
  summary: string;
  points: MindMapDraftPoint[];
};

type MindMapDraft = {
  title: string;
  overview: string;
  overviewDetails: string[];
  clusters: MindMapDraftCluster[];
  takeaway: string;
  takeawayDetails: string[];
};

@Injectable()
export class RagMindMapService {
  private readonly logger = new Logger(RagMindMapService.name);
  private readonly mindMapPrompt = PromptTemplate.fromTemplate(MIND_MAP_PROMPT);
  private readonly mindMapJsonFallbackPrompt = PromptTemplate.fromTemplate(
    MIND_MAP_JSON_FALLBACK_PROMPT,
  );

  constructor(
    private readonly ragIndexingService: RagIndexingService,
    private readonly ragDocumentContextService: RagDocumentContextService,
    private readonly ragArtifactCacheService: RagArtifactCacheService,
    private readonly ragStructuredGenerationService: RagStructuredGenerationService,
    private readonly ragSummaryService: RagSummaryService,
  ) {}

  async getDocumentMindMap(
    documentId: string,
    ownerId: string,
    language: SummaryLanguage = 'en',
    forceRefresh = false,
  ): Promise<DocumentMindMapResponse> {
    const document = await this.ragDocumentContextService.ensureOwnedDocument(
      documentId,
      ownerId,
    );
    const cachedMindMap = this.ragArtifactCacheService.getMindMap(
      document,
      language,
    );

    if (cachedMindMap?.root && cachedMindMap.summaryText && !forceRefresh) {
      return {
        mindMap: cachedMindMap.root,
        summary: cachedMindMap.summaryText,
        language: cachedMindMap.summaryLanguage,
        generatedAt: cachedMindMap.generatedAt,
        cached: true,
      };
    }

    await this.ragIndexingService.ensureDocumentIndexed(documentId);
    const representativeChunks =
      await this.ragDocumentContextService.getRepresentativeChunks(
        documentId,
        MIND_MAP_CONTEXT_CHUNKS,
      );

    if (representativeChunks.length === 0) {
      throw new BadRequestException(
        'This document has no indexed content available for mind map generation.',
      );
    }

    let outputLanguage = language;
    let summaryText = '';
    let mindMapRoot: MindMapNode;

    try {
      const mindMapDraft = await this.generateMindMapDraft({
        documentTitle: document.title ?? 'Untitled document',
        context:
          this.ragDocumentContextService.buildSummaryContext(
            representativeChunks,
          ),
        languageName: this.getLanguageName(language),
      });

      mindMapRoot = this.buildMindMapFromDraft(mindMapDraft, language);
      summaryText = this.buildMindMapSummaryText(mindMapDraft);
    } catch (generationError) {
      this.logger.warn(
        `Mind map generation fell back to summary reconstruction: ${this.toErrorMessage(
          generationError,
        )}`,
      );
      const summaryResult = await this.ragSummaryService.generateSummary(
        documentId,
        ownerId,
        language,
        forceRefresh,
      );
      outputLanguage = summaryResult.language;
      summaryText = this.ragSummaryService.toPlainText(summaryResult);
      mindMapRoot = this.buildMindMapFromSummary(
        summaryResult,
        summaryResult.language,
      );
    }

    const generatedAt = new Date().toISOString();

    await this.ragArtifactCacheService.saveMindMap(document, {
      root: mindMapRoot,
      summaryText,
      generatedAt,
      summaryLanguage: outputLanguage,
      version: MIND_MAP_ARTIFACT_VERSION,
    });

    return {
      mindMap: mindMapRoot,
      summary: summaryText,
      language: outputLanguage,
      generatedAt,
      cached: false,
    };
  }

  private getLanguageName(language: SummaryLanguage): string {
    return language === 'vi' ? 'Vietnamese' : 'English';
  }

  private async generateMindMapDraft(input: {
    documentTitle: string;
    context: string;
    languageName: string;
  }): Promise<MindMapDraft> {
    const draft = await this.ragStructuredGenerationService.generate({
      input,
      prompt: this.mindMapPrompt,
      fallbackPrompt: this.mindMapJsonFallbackPrompt,
      outputSchema: MIND_MAP_OUTPUT_SCHEMA,
      schemaName: 'document_mind_map',
      operationLabel: 'Mind map generation',
      modelOptions: {
        temperature: 0.2,
        maxOutputTokens: 1800,
        topP: 0.9,
      },
      coerce: (value) => this.coerceMindMapDraft(value),
      parseRawResponse: (rawResponse) => this.parseRawMindMapDraft(rawResponse),
      logger: this.logger,
    });

    return this.normalizeMindMapDraft(
      draft,
      input.documentTitle,
      input.languageName,
    );
  }

  private parseRawMindMapDraft(rawResponse: string): MindMapDraft {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Mind map generation did not return JSON.');
    }

    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    const draft = this.coerceMindMapDraft(parsed);

    if (!draft) {
      throw new Error('Mind map generation returned an empty JSON payload.');
    }

    return draft;
  }

  private coerceMindMapDraft(value: unknown): MindMapDraft | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const candidate = value as Record<string, unknown>;
    const clusters = Array.isArray(candidate.clusters)
      ? candidate.clusters
          .map((cluster) => this.coerceMindMapCluster(cluster))
          .filter((cluster): cluster is MindMapDraftCluster => Boolean(cluster))
      : [];
    const draft: MindMapDraft = {
      title: typeof candidate.title === 'string' ? candidate.title : '',
      overview:
        typeof candidate.overview === 'string' ? candidate.overview : '',
      overviewDetails: Array.isArray(candidate.overviewDetails)
        ? candidate.overviewDetails.filter(
            (detail): detail is string => typeof detail === 'string',
          )
        : [],
      clusters,
      takeaway:
        typeof candidate.takeaway === 'string' ? candidate.takeaway : '',
      takeawayDetails: Array.isArray(candidate.takeawayDetails)
        ? candidate.takeawayDetails.filter(
            (detail): detail is string => typeof detail === 'string',
          )
        : [],
    };

    if (
      !this.normalizeText(draft.title) &&
      !this.normalizeText(draft.overview) &&
      draft.overviewDetails.length === 0 &&
      draft.clusters.length === 0 &&
      !this.normalizeText(draft.takeaway) &&
      draft.takeawayDetails.length === 0
    ) {
      return null;
    }

    return draft;
  }

  private coerceMindMapCluster(value: unknown): MindMapDraftCluster | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const candidate = value as Record<string, unknown>;
    const points = Array.isArray(candidate.points)
      ? candidate.points
          .map((point) => this.coerceMindMapPoint(point))
          .filter((point): point is MindMapDraftPoint => Boolean(point))
      : [];
    const label = typeof candidate.label === 'string' ? candidate.label : '';
    const summary =
      typeof candidate.summary === 'string' ? candidate.summary : '';

    if (
      !this.normalizeText(label) &&
      !this.normalizeText(summary) &&
      points.length === 0
    ) {
      return null;
    }

    return {
      label,
      summary,
      points,
    };
  }

  private coerceMindMapPoint(value: unknown): MindMapDraftPoint | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const candidate = value as Record<string, unknown>;
    const label = typeof candidate.label === 'string' ? candidate.label : '';
    const summary =
      typeof candidate.summary === 'string' ? candidate.summary : '';
    const details = Array.isArray(candidate.details)
      ? candidate.details.filter(
          (detail): detail is string => typeof detail === 'string',
        )
      : [];

    if (
      !this.normalizeText(label) &&
      !this.normalizeText(summary) &&
      details.length === 0
    ) {
      return null;
    }

    return {
      label,
      summary,
      details,
    };
  }

  private normalizeMindMapDraft(
    draft: MindMapDraft,
    documentTitle: string,
    languageName: string,
  ): MindMapDraft {
    const isVietnamese = languageName === 'Vietnamese';
    const normalizedOverview = this.normalizeText(draft.overview);
    const normalizedTakeaway = this.normalizeText(draft.takeaway);
    const overviewDetails = draft.overviewDetails
      .map((detail) => this.normalizeText(detail))
      .filter(Boolean)
      .slice(0, 4);
    const takeawayDetails = draft.takeawayDetails
      .map((detail) => this.normalizeText(detail))
      .filter(Boolean)
      .slice(0, 3);
    const clusters = draft.clusters
      .map((cluster) => ({
        label: this.normalizeText(cluster.label),
        summary: this.normalizeText(cluster.summary),
        points: cluster.points
          .map((point) => ({
            label: this.normalizeText(point.label),
            summary: this.normalizeText(point.summary),
            details: point.details
              .map((detail) => this.normalizeText(detail))
              .filter(Boolean)
              .slice(0, 3),
          }))
          .filter(
            (point) => point.label || point.summary || point.details.length > 0,
          )
          .slice(0, 4),
      }))
      .filter(
        (cluster) =>
          cluster.label || cluster.summary || cluster.points.length > 0,
      )
      .slice(0, 6);

    const fallbackOverview =
      normalizedOverview ||
      (isVietnamese
        ? 'Ngữ cảnh hiện có chỉ cho phép mô tả khái quát một phần tài liệu.'
        : 'The available context supports only a partial overview of the document.');
    const fallbackTakeaway =
      normalizedTakeaway ||
      (isVietnamese
        ? 'Kết luận phản ánh phần nội dung đã được trích xuất thành công.'
        : 'The takeaway reflects only the content that was successfully extracted.');
    const resolvedOverviewDetails =
      overviewDetails.length > 0
        ? overviewDetails
        : this.extractMindMapDetails(fallbackOverview, 3);
    const resolvedTakeawayDetails =
      takeawayDetails.length > 0
        ? takeawayDetails
        : this.extractMindMapDetails(fallbackTakeaway, 2);
    const resolvedClusters =
      clusters.length > 0
        ? clusters
        : [
            {
              label: isVietnamese ? 'Ý chính' : 'Key ideas',
              summary: fallbackOverview,
              points: this.extractMindMapDetails(fallbackOverview, 3).map(
                (detail) => ({
                  label: this.buildMindMapDetailLabel(detail),
                  summary: detail,
                  details: [detail],
                }),
              ),
            },
          ];

    return {
      title: this.normalizeText(draft.title) || documentTitle,
      overview: fallbackOverview,
      overviewDetails: resolvedOverviewDetails,
      clusters: resolvedClusters.map((cluster) => ({
        label:
          cluster.label || (isVietnamese ? 'Nhánh nội dung' : 'Content branch'),
        summary: cluster.summary || fallbackOverview,
        points:
          cluster.points.length > 0
            ? cluster.points.map((point) => ({
                label:
                  point.label || this.buildMindMapDetailLabel(point.summary),
                summary: point.summary || point.details[0] || cluster.summary,
                details:
                  point.details.length > 0
                    ? point.details
                    : this.extractMindMapDetails(
                        point.summary || cluster.summary,
                        2,
                      ),
              }))
            : this.extractMindMapDetails(
                cluster.summary || fallbackOverview,
                2,
              ).map((detail) => ({
                label: this.buildMindMapDetailLabel(detail),
                summary: detail,
                details: [detail],
              })),
      })),
      takeaway: fallbackTakeaway,
      takeawayDetails: resolvedTakeawayDetails,
    };
  }

  private buildMindMapFromDraft(
    draft: MindMapDraft,
    language: SummaryLanguage,
  ): MindMapNode {
    const overviewNode = this.createMindMapNode(
      'overview',
      language === 'vi' ? 'Tong quan' : 'Overview',
      this.truncateMindMapSummary(draft.overview, 420),
      'overview',
      this.createMindMapDetailNodes('overview-detail', draft.overviewDetails),
    );
    const clusterNodes = draft.clusters.map((cluster, clusterIndex) =>
      this.createMindMapNode(
        `cluster-${clusterIndex + 1}`,
        this.truncateMindMapLabel(cluster.label, 48),
        this.truncateMindMapSummary(cluster.summary, 320),
        'cluster',
        cluster.points.map((point, pointIndex) =>
          this.createMindMapNode(
            `cluster-${clusterIndex + 1}-point-${pointIndex + 1}`,
            this.truncateMindMapLabel(point.label, 46),
            this.truncateMindMapSummary(point.summary, 320),
            'insight',
            this.createMindMapDetailNodes(
              `cluster-${clusterIndex + 1}-point-${pointIndex + 1}-detail`,
              point.details,
            ),
          ),
        ),
      ),
    );
    const takeawayNode = this.createMindMapNode(
      'takeaway',
      language === 'vi' ? 'Ket luan' : 'Takeaway',
      this.truncateMindMapSummary(draft.takeaway, 320),
      'takeaway',
      this.createMindMapDetailNodes('takeaway-detail', draft.takeawayDetails),
    );

    return this.createMindMapNode(
      'root',
      this.truncateMindMapLabel(draft.title, 60),
      this.truncateMindMapSummary(draft.overview, 420),
      'root',
      [overviewNode, ...clusterNodes, takeawayNode],
    );
  }

  private buildMindMapSummaryText(draft: MindMapDraft): string {
    const sections = [
      draft.title,
      draft.overview,
      'Key branches:',
      ...draft.clusters.map(
        (cluster) => `- ${cluster.label}: ${cluster.summary}`,
      ),
      'Takeaway:',
      draft.takeaway,
    ];

    return sections.join('\n').trim();
  }

  private buildMindMapFromSummary(
    summary: StructuredDocumentSummary,
    language: SummaryLanguage,
  ): MindMapNode {
    const overviewNode = this.createMindMapNode(
      'overview',
      language === 'vi' ? 'Tong quan' : 'Overview',
      this.truncateMindMapSummary(summary.overview, 420),
      'overview',
    );
    const insightNodes = summary.key_points.map((point, index) =>
      this.createMindMapNode(
        `insight-${index + 1}`,
        this.buildMindMapInsightLabel(point),
        this.truncateMindMapSummary(point, 320),
        'insight',
      ),
    );
    const clusterNode = this.createMindMapNode(
      'key-ideas',
      language === 'vi' ? 'Y chinh' : 'Key ideas',
      this.buildMindMapClusterSummary(summary.key_points, language),
      'cluster',
      insightNodes,
    );
    const takeawayNode = this.createMindMapNode(
      'takeaway',
      language === 'vi' ? 'Ket luan' : 'Takeaway',
      this.truncateMindMapSummary(summary.conclusion, 320),
      'takeaway',
    );

    return this.createMindMapNode(
      'root',
      this.truncateMindMapLabel(summary.title, 56),
      this.truncateMindMapSummary(summary.overview, 420),
      'root',
      [overviewNode, clusterNode, takeawayNode],
    );
  }

  private createMindMapDetailNodes(
    idPrefix: string,
    details: string[],
  ): MindMapNode[] {
    return details
      .filter(Boolean)
      .map((detail, index) =>
        this.createMindMapNode(
          `${idPrefix}-${index + 1}`,
          this.buildMindMapDetailLabel(detail),
          this.truncateMindMapSummary(detail, 180),
          'detail',
        ),
      );
  }

  private createMindMapNode(
    id: string,
    label: string,
    summary: string,
    kind: MindMapNode['kind'],
    children: MindMapNode[] = [],
  ): MindMapNode {
    return {
      id,
      label,
      summary,
      kind,
      children,
    };
  }

  private buildMindMapInsightLabel(point: string): string {
    const normalizedPoint = this.normalizeText(point).replace(/^[-*]\s*/, '');
    const condensedLabel = normalizedPoint.split(/\s+/).slice(0, 6).join(' ');

    return this.truncateMindMapLabel(condensedLabel || normalizedPoint, 44);
  }

  private buildMindMapDetailLabel(value: string): string {
    const normalizedValue = this.normalizeText(value).replace(/^[-*]\s*/, '');
    const condensedLabel = normalizedValue.split(/\s+/).slice(0, 5).join(' ');

    return this.truncateMindMapLabel(condensedLabel || normalizedValue, 40);
  }

  private extractMindMapDetails(value: string, maxItems = 2): string[] {
    const normalizedValue = this.normalizeText(value);

    if (!normalizedValue) {
      return [];
    }

    const segments = normalizedValue
      .split(/(?:\.\s+|;\s+|\n+)/)
      .map((segment) => this.normalizeText(segment))
      .filter(Boolean);

    if (segments.length > 1) {
      return segments.slice(0, maxItems);
    }

    return [normalizedValue];
  }

  private buildMindMapClusterSummary(
    keyPoints: string[],
    language: SummaryLanguage,
  ): string {
    const normalizedPoints = keyPoints
      .map((point) => this.normalizeText(point))
      .filter(Boolean);

    if (normalizedPoints.length === 0) {
      return language === 'vi'
        ? 'Khong co y chinh nao duoc trich xuat tu tai lieu.'
        : 'No key ideas were extracted from the document.';
    }

    const baseSummary =
      language === 'vi'
        ? `${normalizedPoints.length} y chinh duoc tong hop tu noi dung tai lieu.`
        : `${normalizedPoints.length} key ideas synthesized from the document content.`;
    const previewPoints = normalizedPoints.slice(0, 2);

    if (previewPoints.length === 0) {
      return baseSummary;
    }

    const previewLabel =
      language === 'vi'
        ? `Trong do noi bat: ${previewPoints.join(' ')}`
        : `Most important ideas: ${previewPoints.join(' ')}`;

    return this.truncateMindMapSummary(`${baseSummary} ${previewLabel}`, 320);
  }

  private truncateMindMapLabel(value: string, maxLength = 44): string {
    const normalizedValue = this.normalizeText(value);

    if (normalizedValue.length <= maxLength) {
      return normalizedValue;
    }

    return `${normalizedValue.slice(0, maxLength - 3).trimEnd()}...`;
  }

  private truncateMindMapSummary(value: string, maxLength = 160): string {
    const normalizedValue = this.normalizeText(value);

    if (normalizedValue.length <= maxLength) {
      return normalizedValue;
    }

    const roughSlice = normalizedValue.slice(0, maxLength).trimEnd();
    const lastWordBoundary = roughSlice.lastIndexOf(' ');
    const safeSlice =
      lastWordBoundary > Math.floor(maxLength / 2)
        ? roughSlice.slice(0, lastWordBoundary)
        : roughSlice;

    return `${safeSlice}...`;
  }

  private normalizeText(value: string | null | undefined): string {
    return (value ?? '').replace(/\s+/g, ' ').trim();
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
