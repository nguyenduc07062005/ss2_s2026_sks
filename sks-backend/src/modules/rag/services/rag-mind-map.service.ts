import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';
import {
  DocumentMindMapResponse,
  MindMapNode,
  SummaryLanguage,
} from '../types/rag.types';
import { RagArtifactCacheService } from './rag-artifact-cache.service';
import { RagDocumentContextService } from './rag-document-context.service';
import { RagIndexingService } from './rag-indexing.service';
import { RagStructuredGenerationService } from './rag-structured-generation.service';
import { parseJsonWithRepair } from '../utils/llm-json';

const MIND_MAP_CONTEXT_CHUNKS = 28;
const MIND_MAP_ARTIFACT_VERSION = 8;
const MAX_MIND_MAP_DEPTH = 5;

const MIND_MAP_PROMPT = [
  'You are a senior academic and technical analyst building an interactive mind map.',
  'Use ONLY the provided document context.',
  'Do not invent facts, claims, or relationships that are not grounded in the context.',
  'Write all text in {languageName}.',
  'Optimize for learning: preserve real concepts, mechanisms, comparisons, workflows, examples, and cause-effect relationships from the document.',
  'Do not include admin noise, vague meta commentary, or repeated paraphrases.',
  '',
  'Create a flexible hierarchical tree for progressive exploration in a UI.',
  'Do not force generic sections such as "overview", "introduction", "takeaway", or "conclusion" unless the document itself naturally supports them.',
  'Organize the tree according to the real structure of the document.',
  '',
  'Output requirements:',
  '- title: short document title',
  '- summary: 2 to 4 sentences describing the document as a whole',
  '- branches: prefer 4 to 8 top-level branches when the material supports it; avoid fewer than 3 unless the document is genuinely narrow',
  '- each branch must have label, summary, children',
  '- for substantial branches, include 2 to 4 children when those sub-ideas are grounded in the source',
  '- use grandchildren for procedures, grouped evidence, examples, formulas, or cause-effect chains when present in the document',
  '- each node summary should be 1 to 2 study-friendly sentences',
  '- each node label should be concise, specific, and understandable on its own',
  '- never use labels that are only the first few words of a sentence or truncated fragments ending mid-idea',
  '- children may be empty when the idea is already atomic',
  '- vary the depth naturally; do not pad the tree just to make it symmetrical',
  '- maximize informative coverage; do not collapse many distinct ideas into one generic branch',
  '- keep the tree faithful, compact, and useful for study',
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
  'Do not force generic sections unless they are grounded in the document.',
  'Return JSON using this exact structure:',
  '{{',
  '  "title": "short document title",',
  '  "summary": "2 to 4 sentences describing the document as a whole",',
  '  "branches": [',
  '    {{',
  '      "label": "branch label",',
  '      "summary": "1 to 2 study-friendly sentences",',
  '      "children": [',
  '        {{',
  '          "label": "child label",',
  '          "summary": "1 to 2 study-friendly sentences",',
  '          "children": [',
  '            {{',
  '              "label": "grandchild label",',
  '              "summary": "1 to 2 study-friendly sentences",',
  '              "children": []',
  '            }}',
  '          ]',
  '        }}',
  '      ]',
  '    }}',
  '  ]',
  '}}',
  'Children arrays may be empty. Stop at the natural depth of the document.',
  'Prefer a richer tree when the source supports it instead of collapsing many ideas into one branch.',
  'Each label must be self-contained and meaningful on its own. Do not output truncated sentence fragments.',
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
    summary: { type: 'string' },
    branches: {
      type: 'array',
      minItems: 1,
      maxItems: 10,
      items: { $ref: '#/$defs/node' },
    },
  },
  required: ['title', 'summary', 'branches'],
  $defs: {
    node: {
      type: 'object',
      additionalProperties: false,
      properties: {
        label: { type: 'string' },
        summary: { type: 'string' },
        children: {
          type: 'array',
          minItems: 0,
          maxItems: 8,
          items: { $ref: '#/$defs/node' },
        },
      },
      required: ['label', 'summary', 'children'],
    },
  },
} as const;

type MindMapDraftNode = {
  label: string;
  summary: string;
  children: MindMapDraftNode[];
};

type MindMapDraft = {
  title: string;
  summary: string;
  branches: MindMapDraftNode[];
};

type MindMapSourceChunk = {
  chunkIndex: number;
  chunkText: string;
  pageNumber: number | null;
  sectionTitle: string | null;
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

    if (
      cachedMindMap?.root &&
      cachedMindMap.summaryText &&
      cachedMindMap.version >= MIND_MAP_ARTIFACT_VERSION &&
      !forceRefresh
    ) {
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

    const sourceDrivenDraft = this.buildSourceDrivenMindMapDraft(
      document.title ?? 'Untitled document',
      representativeChunks,
      language,
    );
    const generationContext = this.buildMindMapGenerationContext(
      representativeChunks,
      sourceDrivenDraft,
      language,
    );
    let resolvedDraft = sourceDrivenDraft;

    try {
      const aiDraft = await this.generateMindMapDraft({
        documentTitle: document.title ?? 'Untitled document',
        context: generationContext,
        languageName: this.getLanguageName(language),
      });

      if (this.isMindMapDraftHighQuality(aiDraft, sourceDrivenDraft)) {
        resolvedDraft = aiDraft;
      } else {
        this.logger.warn(
          'Mind map generation returned a shallow or weak tree. Falling back to source-driven reconstruction.',
        );
      }
    } catch (generationError) {
      this.logger.warn(
        `Mind map generation fell back to source-driven reconstruction: ${this.toErrorMessage(
          generationError,
        )}`,
      );
    }

    const mindMapRoot = this.buildMindMapFromDraft(resolvedDraft);
    const summaryText = this.buildMindMapSummaryText(resolvedDraft, language);
    const outputLanguage = language;

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
      skipJsonSchema: true,
      skipFunctionCalling: true,
      modelOptions: {
        temperature: 0.2,
        maxOutputTokens: 2600,
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

  private buildMindMapGenerationContext(
    chunks: MindMapSourceChunk[],
    sourceDraft: MindMapDraft,
    language: SummaryLanguage,
  ): string {
    const outlineHeader =
      language === 'vi'
        ? 'Goi y cau truc duoc rut ra truc tiep tu tai lieu:'
        : 'Structure hints distilled directly from the document:';
    const excerptsHeader =
      language === 'vi'
        ? 'Doan trich dai dien tu tai lieu:'
        : 'Representative document excerpts:';
    const sourceOutline = sourceDraft.branches
      .slice(0, 6)
      .map((branch) =>
        [
          `- ${branch.label}: ${branch.summary}`,
          ...branch.children
            .slice(0, 3)
            .map((child) => `  - ${child.label}: ${child.summary}`),
        ].join('\n'),
      )
      .join('\n');

    return [
      outlineHeader,
      sourceOutline,
      '',
      excerptsHeader,
      this.ragDocumentContextService.buildSummaryContext(chunks),
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildSourceDrivenMindMapDraft(
    documentTitle: string,
    chunks: MindMapSourceChunk[],
    language: SummaryLanguage,
  ): MindMapDraft {
    const isVietnamese = language === 'vi';
    const branches = this.buildSourceDrivenMindMapBranches(chunks, isVietnamese);
    const prominentLabels = branches
      .map((branch) => this.normalizeMindMapLabel(branch.label))
      .filter(Boolean)
      .slice(0, 4);
    const summary = isVietnamese
      ? [
          `So do tu duy nay to chuc tai lieu thanh ${branches.length} cum y chinh.`,
          prominentLabels.length > 0
            ? `Cac nhanh noi bat gom ${prominentLabels.join(', ')}.`
            : 'Moi nhanh tong hop mot cum khai niem, luan diem hoac vi du tieu bieu.',
          'Moi nhanh duoc dung tu cac doan trich co mat do thong tin cao de giu y nghia hoc tap ro rang.',
        ].join(' ')
      : [
          `This mind map organizes the document into ${branches.length} main thematic clusters.`,
          prominentLabels.length > 0
            ? `The most prominent branches are ${prominentLabels.join(', ')}.`
            : 'Each branch captures a distinct concept, argument, or example from the source.',
          'The nodes are reconstructed from high-signal excerpts to keep the structure compact and study-friendly.',
        ].join(' ');

    return this.normalizeMindMapDraft(
      {
        title: documentTitle,
        summary,
        branches,
      },
      documentTitle,
      this.getLanguageName(language),
    );
  }

  private buildSourceDrivenMindMapBranches(
    chunks: MindMapSourceChunk[],
    isVietnamese: boolean,
  ): MindMapDraftNode[] {
    const groupedChunks = this.groupSourceChunksForMindMap(chunks);

    return groupedChunks
      .map((group, groupIndex) =>
        this.buildSourceDrivenBranchNode(group, groupIndex, isVietnamese),
      )
      .filter((branch): branch is MindMapDraftNode => Boolean(branch));
  }

  private groupSourceChunksForMindMap(
    chunks: MindMapSourceChunk[],
  ): MindMapSourceChunk[][] {
    if (chunks.length <= 2) {
      return chunks.map((chunk) => [chunk]);
    }

    const desiredGroupCount = Math.min(
      6,
      Math.max(chunks.length >= 12 ? 4 : 2, Math.round(Math.sqrt(chunks.length))),
    );
    const bucketSize = Math.ceil(chunks.length / desiredGroupCount);
    const groups: MindMapSourceChunk[][] = [];

    for (let start = 0; start < chunks.length; start += bucketSize) {
      groups.push(chunks.slice(start, start + bucketSize));
    }

    return groups.filter((group) => group.length > 0);
  }

  private buildSourceDrivenBranchNode(
    group: MindMapSourceChunk[],
    groupIndex: number,
    isVietnamese: boolean,
  ): MindMapDraftNode | null {
    const sentences = this.dedupeMindMapDetails(
      group.flatMap((chunk) => this.extractMindMapSentences(chunk.chunkText, 3)),
    );
    const combinedText = this.normalizeMindMapText(
      group.map((chunk) => chunk.chunkText).join(' '),
    );
    const sectionTitle =
      group
        .map((chunk) => this.normalizeMindMapLabel(chunk.sectionTitle))
        .find((title) => this.isMeaningfulMindMapHeading(title)) ?? '';
    const branchSummary =
      sentences[0] ||
      combinedText ||
      (isVietnamese
        ? 'Nhanh nay tong hop mot cum y chinh cua tai lieu.'
        : 'This branch groups one major idea from the document.');
    const childSentences = sentences
      .slice(1)
      .filter((sentence) => sentence !== branchSummary)
      .slice(0, 3);
    const children =
      childSentences.length > 0
        ? childSentences.map((sentence, index) =>
            this.buildSourceDrivenChildNode(sentence, index, isVietnamese),
          )
        : this.extractMindMapClauses(branchSummary, 3).map((clause, index) =>
            this.buildSourceDrivenChildNode(clause, index, isVietnamese),
          );
    const fallbackLabel = this.deriveFallbackNodeLabel(
      branchSummary,
      0,
      groupIndex,
      isVietnamese,
    );

    return {
      label:
        this.deriveSourceDrivenLabel(
          sectionTitle || branchSummary,
          combinedText,
          fallbackLabel,
        ) || fallbackLabel,
      summary: branchSummary,
      children,
    };
  }

  private buildSourceDrivenChildNode(
    sentence: string,
    index: number,
    isVietnamese: boolean,
  ): MindMapDraftNode {
    const normalizedSentence = this.normalizeMindMapText(sentence);
    const subClauses = this.extractMindMapClauses(normalizedSentence, 3)
      .filter((clause) => clause !== normalizedSentence)
      .slice(0, 2);
    const fallbackLabel = this.deriveFallbackNodeLabel(
      normalizedSentence,
      1,
      index,
      isVietnamese,
    );

    return {
      label:
        this.deriveSourceDrivenLabel(
          normalizedSentence,
          normalizedSentence,
          fallbackLabel,
        ) || fallbackLabel,
      summary: normalizedSentence,
      children: subClauses.map((clause, clauseIndex) => ({
        label:
          this.deriveSourceDrivenLabel(
            clause,
            clause,
            this.deriveFallbackNodeLabel(
              clause,
              2,
              clauseIndex,
              isVietnamese,
            ),
          ) ||
          this.deriveFallbackNodeLabel(clause, 2, clauseIndex, isVietnamese),
        summary: clause,
        children: [],
      })),
    };
  }

  private extractMindMapSentences(value: string, maxItems = 4): string[] {
    const normalizedValue = this.normalizeMindMapText(value);

    if (!normalizedValue) {
      return [];
    }

    const sentences = this.dedupeMindMapDetails(
      normalizedValue
        .split(/(?<=[.!?])\s+|\n+/)
        .map((segment) =>
          this.normalizeMindMapText(
            segment.replace(/^\s*(?:[-*•]|\d+\.)\s*/, ''),
          ),
        )
        .filter((segment) => segment.length >= 24),
    );

    if (sentences.length > 0) {
      return sentences.slice(0, maxItems);
    }

    return this.extractMindMapClauses(normalizedValue, maxItems);
  }

  private extractMindMapClauses(value: string, maxItems = 3): string[] {
    const normalizedValue = this.normalizeMindMapText(value);

    if (!normalizedValue) {
      return [];
    }

    const clauses = this.dedupeMindMapDetails(
      normalizedValue
        .split(/\s*;\s+/)
        .map((segment) => this.normalizeMindMapText(segment))
        .filter((segment) => segment.length >= 18),
    );

    return clauses
      .filter((clause) => clause !== normalizedValue)
      .slice(0, maxItems);
  }

  private deriveSourceDrivenLabel(
    primaryText: string,
    fallbackText: string,
    fallbackLabel: string,
  ): string {
    for (const candidate of [primaryText, fallbackText]) {
      const strippedCandidate = this.stripWeakMindMapLeadIn(candidate);
      const candidateLabel = this.normalizeMindMapLabel(
        this.extractMindMapLabelSource(strippedCandidate),
      );

      if (
        candidateLabel &&
        !this.shouldRegenerateMindMapLabel(candidateLabel, strippedCandidate)
      ) {
        return candidateLabel;
      }
    }

    return this.normalizeMindMapLabel(fallbackLabel);
  }

  private stripWeakMindMapLeadIn(value: string): string {
    let normalizedValue = this.normalizeMindMapText(value);
    const weakLeadInPattern =
      /^(trong giai doan nay|o giai doan nay|giai doan nay|ve mat nay|doi voi|theo do|noi cach khac|dong thoi|mat khac|truoc het|tiep theo|in this phase|during this period|at this stage|this stage|overall|moreover|however|first|next)\s*,?\s*/i;

    while (weakLeadInPattern.test(normalizedValue)) {
      normalizedValue = normalizedValue.replace(weakLeadInPattern, '').trim();
    }

    return normalizedValue;
  }

  private isMeaningfulMindMapHeading(value: string): boolean {
    const normalizedValue = this.normalizeMindMapLabel(value);

    if (!normalizedValue) {
      return false;
    }

    return !/^(section|part|chapter|muc|phan)\s+\d+$/i.test(normalizedValue);
  }

  private isMindMapDraftHighQuality(
    draft: MindMapDraft,
    sourceDraft: MindMapDraft,
  ): boolean {
    const branches = Array.isArray(draft.branches) ? draft.branches : [];
    const allLabels = branches.flatMap((branch) => [
      this.normalizeMindMapLabel(branch.label).toLowerCase(),
      ...branch.children.map((child) =>
        this.normalizeMindMapLabel(child.label).toLowerCase(),
      ),
    ]);
    const uniqueLabels = new Set(allLabels.filter(Boolean));
    const weakBranchCount = branches.filter((branch) =>
      this.shouldRegenerateMindMapLabel(branch.label, branch.summary),
    ).length;
    const childCount = branches.reduce(
      (total, branch) => total + branch.children.length,
      0,
    );
    const minimumBranchCount = Math.min(
      3,
      Math.max(1, sourceDraft.branches.length),
    );

    if (branches.length < minimumBranchCount) {
      return false;
    }

    if (weakBranchCount > Math.ceil(branches.length / 3)) {
      return false;
    }

    if (childCount < Math.min(3, Math.max(1, sourceDraft.branches.length))) {
      return false;
    }

    if (uniqueLabels.size < Math.ceil(allLabels.filter(Boolean).length * 0.75)) {
      return false;
    }

    return true;
  }

  private parseRawMindMapDraft(rawResponse: string): MindMapDraft {
    const parsed = parseJsonWithRepair<unknown>(rawResponse);
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
    const rawBranches = Array.isArray(candidate.branches)
      ? candidate.branches
      : Array.isArray(candidate.clusters)
        ? candidate.clusters
        : [];
    const branches = rawBranches
      .map((branch) => this.coerceMindMapNode(branch))
      .filter((branch): branch is MindMapDraftNode => Boolean(branch));
    const draft: MindMapDraft = {
      title: typeof candidate.title === 'string' ? candidate.title : '',
      summary:
        typeof candidate.summary === 'string'
          ? candidate.summary
          : typeof candidate.overview === 'string'
            ? candidate.overview
            : '',
      branches,
    };

    if (
      !this.normalizeText(draft.title) &&
      !this.normalizeText(draft.summary) &&
      draft.branches.length === 0
    ) {
      return null;
    }

    return draft;
  }

  private coerceMindMapNode(value: unknown): MindMapDraftNode | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const candidate = value as Record<string, unknown>;
    const label = typeof candidate.label === 'string' ? candidate.label : '';
    const summary =
      typeof candidate.summary === 'string'
        ? candidate.summary
        : typeof candidate.overview === 'string'
          ? candidate.overview
          : '';
    const rawChildren = Array.isArray(candidate.children)
      ? candidate.children
      : Array.isArray(candidate.points)
        ? candidate.points
        : [];
    const children = rawChildren
      .map((child) => this.coerceMindMapNode(child))
      .filter((child): child is MindMapDraftNode => Boolean(child));
    const detailChildren = Array.isArray(candidate.details)
      ? candidate.details
          .filter((detail): detail is string => typeof detail === 'string')
          .map((detail) => this.createDraftLeafFromText(detail))
      : [];
    const mergedChildren = [...children, ...detailChildren];

    if (
      !this.normalizeText(label) &&
      !this.normalizeText(summary) &&
      mergedChildren.length === 0
    ) {
      return null;
    }

    return {
      label,
      summary,
      children: mergedChildren,
    };
  }

  private normalizeMindMapDraft(
    draft: MindMapDraft,
    documentTitle: string,
    languageName: string,
  ): MindMapDraft {
    const isVietnamese = languageName === 'Vietnamese';
    const rawBranches = Array.isArray(draft.branches) ? draft.branches : [];
    const fallbackSummary =
      this.normalizeMindMapText(draft.summary) ||
      (isVietnamese
        ? 'So do tu duy nay phan anh phan noi dung da duoc trich xuat tu tai lieu.'
        : 'This mind map reflects the document content that was successfully extracted.');
    const normalizedBranches = this.normalizeMindMapNodes(
      rawBranches,
      fallbackSummary,
      isVietnamese,
      0,
    );
    const resolvedBranches =
      normalizedBranches.length > 0
        ? normalizedBranches
        : this.extractMindMapDetails(fallbackSummary, 4).map(
            (detail, index) => ({
              label: this.deriveFallbackNodeLabel(
                detail,
                0,
                index,
                isVietnamese,
              ),
              summary: detail,
              children: [],
            }),
          );

    return {
      title: this.normalizeText(draft.title) || documentTitle,
      summary: fallbackSummary,
      branches: resolvedBranches,
    };
  }

  private normalizeMindMapNodes(
    nodes: MindMapDraftNode[],
    parentSummary: string,
    isVietnamese: boolean,
    depth: number,
  ): MindMapDraftNode[] {
    const maxNodes = depth === 0 ? 10 : depth === 1 ? 8 : depth === 2 ? 6 : 5;

    return nodes
      .map((node, index) => {
        const normalizedLabel = this.normalizeMindMapLabel(node.label);
        const normalizedSummary = this.normalizeMindMapText(node.summary);
        const baseSummary =
          normalizedSummary ||
          parentSummary ||
          (isVietnamese
            ? 'Nhanh nay tom luoc mot y chinh cua tai lieu.'
            : 'This branch summarizes one important idea from the document.');
        const normalizedChildren =
          depth + 1 >= MAX_MIND_MAP_DEPTH
            ? []
            : this.normalizeMindMapNodes(
                node.children,
                baseSummary,
                isVietnamese,
                depth + 1,
              );
        const resolvedSummary = this.resolveMindMapNodeSummary(
          normalizedLabel,
          baseSummary || normalizedChildren[0]?.summary || parentSummary,
          parentSummary,
          normalizedChildren[0]?.summary,
          isVietnamese,
        );
        const children = this.expandSparseMindMapChildren(
          normalizedChildren,
          resolvedSummary,
          depth,
          isVietnamese,
        );
        const resolvedLabel =
          normalizedLabel &&
          !this.shouldRegenerateMindMapLabel(normalizedLabel, resolvedSummary)
            ? normalizedLabel
            : this.deriveFallbackNodeLabel(
                resolvedSummary,
                depth,
                index,
                isVietnamese,
              );

        return {
          label: resolvedLabel,
          summary: resolvedSummary,
          children,
        } satisfies MindMapDraftNode;
      })
      .filter((node) => node.label || node.summary || node.children.length > 0)
      .slice(0, maxNodes);
  }

  private expandSparseMindMapChildren(
    children: MindMapDraftNode[],
    summary: string,
    depth: number,
    isVietnamese: boolean,
  ): MindMapDraftNode[] {
    if (depth + 1 >= MAX_MIND_MAP_DEPTH) {
      return children;
    }

    const targetChildCount =
      depth === 0 ? 4 : depth === 1 ? 3 : depth === 2 ? 2 : 0;

    if (targetChildCount === 0 || children.length >= targetChildCount) {
      return children;
    }

    const normalizedSummary = this.normalizeText(summary);
    const existingKeys = new Set(
      children.flatMap((child) => [
        this.normalizeText(child.label).toLowerCase(),
        this.normalizeText(child.summary).toLowerCase(),
      ]),
    );
    const detailCandidates = this.extractMindMapDetails(
      normalizedSummary,
      targetChildCount + 2,
    ).filter(
      (detail) =>
        !this.isTrivialMindMapDetail(detail, normalizedSummary) &&
        !existingKeys.has(detail.toLowerCase()),
    );

    if (detailCandidates.length === 0) {
      return children;
    }

    const generatedChildren = detailCandidates.map((detail, index) => ({
      label: this.deriveFallbackNodeLabel(
        detail,
        depth + 1,
        index,
        isVietnamese,
      ),
      summary: this.buildSyntheticMindMapSummary(
        detail,
        normalizedSummary,
        isVietnamese,
      ),
      children: [],
    }));

    return [...children, ...generatedChildren].slice(0, targetChildCount);
  }

  private isTrivialMindMapDetail(detail: string, summary: string): boolean {
    const normalizedDetail = this.normalizeText(detail).toLowerCase();
    const normalizedSummary = this.normalizeText(summary).toLowerCase();

    if (!normalizedDetail) {
      return true;
    }

    if (normalizedDetail === normalizedSummary) {
      return true;
    }

    return normalizedDetail.length < 12;
  }

  private resolveMindMapNodeSummary(
    label: string,
    summary: string,
    parentSummary: string,
    childSummary: string | undefined,
    isVietnamese: boolean,
  ): string {
    const normalizedLabel = this.normalizeText(label);
    const normalizedSummary = this.normalizeText(summary);
    const normalizedChildSummary = this.normalizeText(childSummary);
    const normalizedParentSummary = this.normalizeText(parentSummary);

    if (
      normalizedSummary &&
      !this.shouldSynthesizeMindMapSummary(normalizedLabel, normalizedSummary)
    ) {
      return normalizedSummary;
    }

    const contextualSource =
      (normalizedChildSummary &&
      !this.isMindMapSummaryTooSimilar(normalizedLabel, normalizedChildSummary)
        ? normalizedChildSummary
        : '') ||
      normalizedParentSummary ||
      normalizedSummary;

    return this.buildSyntheticMindMapSummary(
      normalizedLabel || normalizedSummary,
      contextualSource,
      isVietnamese,
    );
  }

  private shouldSynthesizeMindMapSummary(
    label: string,
    summary: string,
  ): boolean {
    const normalizedLabel = this.normalizeText(label);
    const normalizedSummary = this.normalizeText(summary);

    if (!normalizedSummary) {
      return true;
    }

    return this.isMindMapSummaryTooSimilar(normalizedLabel, normalizedSummary);
  }

  private isMindMapSummaryTooSimilar(label: string, summary: string): boolean {
    const normalizedLabel = this.normalizeText(label).toLowerCase();
    const normalizedSummary = this.normalizeText(summary).toLowerCase();

    if (!normalizedLabel || !normalizedSummary) {
      return false;
    }

    if (normalizedLabel === normalizedSummary) {
      return true;
    }

    if (
      normalizedSummary.startsWith(normalizedLabel) &&
      normalizedSummary.length - normalizedLabel.length <= 12
    ) {
      return true;
    }

    return false;
  }

  private buildSyntheticMindMapSummary(
    label: string,
    context: string,
    isVietnamese: boolean,
  ): string {
    const normalizedLabel = this.normalizeText(label);
    const normalizedContext = this.normalizeText(context);

    if (!normalizedLabel && !normalizedContext) {
      return isVietnamese
        ? 'Y nay can duoc doc trong mach noi dung cua tai lieu.'
        : 'This idea should be read in the document context.';
    }

    if (!normalizedContext) {
      return isVietnamese
        ? `Y nay tap trung vao ${normalizedLabel}.`
        : `This node focuses on ${normalizedLabel}.`;
    }

    if (!normalizedLabel) {
      return normalizedContext;
    }

    return isVietnamese
      ? `Y nay nhan manh ${normalizedLabel}. Trong tai lieu, no duoc dat trong boi canh: ${normalizedContext}`
      : `This node highlights ${normalizedLabel}. In the document, it appears in this context: ${normalizedContext}`;
  }

  private deriveFallbackNodeLabel(
    summary: string,
    depth: number,
    index: number,
    isVietnamese: boolean,
  ): string {
    const derivedLabel = this.buildMindMapDetailLabel(summary);

    if (derivedLabel) {
      return derivedLabel;
    }

    if (depth === 0) {
      return isVietnamese ? `Nhanh ${index + 1}` : `Branch ${index + 1}`;
    }

    if (depth === 1) {
      return isVietnamese ? `Muc ${index + 1}` : `Section ${index + 1}`;
    }

    return isVietnamese ? `Chi tiet ${index + 1}` : `Detail ${index + 1}`;
  }

  private createDraftLeafFromText(value: string): MindMapDraftNode {
    const normalizedValue = this.normalizeMindMapText(value);

    return {
      label: this.buildMindMapDetailLabel(normalizedValue),
      summary: normalizedValue,
      children: [],
    };
  }

  private buildMindMapFromDraft(draft: MindMapDraft): MindMapNode {
    return this.createMindMapNode(
      'root',
      this.truncateMindMapLabel(draft.title, 60),
      this.truncateMindMapSummary(draft.summary, 420),
      'root',
      draft.branches.map((branch, index) =>
        this.buildMindMapTreeNode(branch, `branch-${index + 1}`, 1),
      ),
    );
  }

  private buildMindMapTreeNode(
    node: MindMapDraftNode,
    id: string,
    depth: number,
  ): MindMapNode {
    const children = node.children.map((child, index) =>
      this.buildMindMapTreeNode(child, `${id}-${index + 1}`, depth + 1),
    );

    return this.createMindMapNode(
      id,
      this.truncateMindMapLabel(node.label, depth === 1 ? 58 : 54),
      this.truncateMindMapSummary(node.summary, depth === 1 ? 320 : 260),
      this.resolveMindMapNodeKind(depth),
      children,
    );
  }

  private resolveMindMapNodeKind(depth: number): MindMapNode['kind'] {
    if (depth <= 1) {
      return 'cluster';
    }

    if (depth === 2) {
      return 'insight';
    }

    return 'detail';
  }

  private buildMindMapSummaryText(
    draft: MindMapDraft,
    language: SummaryLanguage,
  ): string {
    const branchHeader = language === 'vi' ? 'Cac nhanh chinh:' : 'Map branches:';
    const sections = [
      draft.title,
      draft.summary,
      branchHeader,
      ...draft.branches.map((branch) => `- ${branch.label}: ${branch.summary}`),
    ];

    return sections.join('\n').trim();
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
    const labelSource = this.extractMindMapLabelSource(point);

    return this.truncateMindMapLabel(labelSource, 58);
  }

  private buildMindMapDetailLabel(value: string): string {
    const labelSource = this.extractMindMapLabelSource(value);

    return this.truncateMindMapLabel(labelSource, 54);
  }

  private extractMindMapDetails(value: string, maxItems = 2): string[] {
    const normalizedValue = this.normalizeMindMapText(value);

    if (!normalizedValue) {
      return [];
    }

    const primarySegments = normalizedValue
      .split(/(?:\.\s+|;\s+|:\s+|\n+|•\s+|\s[-–]\s+)/)
      .map((segment) => this.normalizeText(segment))
      .filter(Boolean);

    if (primarySegments.length > 1) {
      return this.dedupeMindMapDetails(primarySegments).slice(0, maxItems);
    }

    return [normalizedValue];
  }

  private dedupeMindMapDetails(details: string[]): string[] {
    const seen = new Set<string>();

    return details.filter((detail) => {
      const normalizedDetail = this.normalizeText(detail).toLowerCase();

      if (!normalizedDetail || seen.has(normalizedDetail)) {
        return false;
      }

      seen.add(normalizedDetail);
      return true;
    });
  }

  private truncateMindMapLabel(value: string, maxLength = 44): string {
    const normalizedValue = this.normalizeMindMapLabel(value);

    if (normalizedValue.length <= maxLength) {
      return normalizedValue;
    }

    return `${normalizedValue.slice(0, maxLength - 3).trimEnd()}...`;
  }

  private truncateMindMapSummary(value: string, maxLength = 160): string {
    const normalizedValue = this.normalizeMindMapText(value);

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

  private normalizeMindMapText(value: string | null | undefined): string {
    return this.normalizeText(value)
      .replace(/^\s*(?:[-*•]\s*|\d+\.\s*)+/, '')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[>*_`~#]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeMindMapLabel(value: string | null | undefined): string {
    return this.normalizeMindMapText(value)
      .replace(/^[,;:.()\[\]\-–]+\s*/, '')
      .replace(/\s*[,;:.()\[\]\-–]+$/, '')
      .trim();
  }

  private extractMindMapLabelSource(value: string): string {
    const normalizedValue = this.normalizeMindMapText(value);

    if (!normalizedValue) {
      return '';
    }

    const prefixBeforeColon = normalizedValue.match(/^([^:]{6,80}):\s+/)?.[1];

    if (prefixBeforeColon) {
      return this.normalizeMindMapLabel(prefixBeforeColon);
    }

    const firstSentence =
      normalizedValue.split(/(?:\.\s+|!\s+|\?\s+|\n+)/)[0] || normalizedValue;

    return this.normalizeMindMapLabel(firstSentence);
  }

  private shouldRegenerateMindMapLabel(
    label: string,
    summary: string,
  ): boolean {
    const normalizedLabel = this.normalizeMindMapLabel(label);
    const normalizedSummary = this.normalizeMindMapText(summary);

    if (!normalizedLabel) {
      return true;
    }

    if (/[,:;]$/.test(normalizedLabel)) {
      return true;
    }

    if (
      /^(trong giai đoạn này|ở giai đoạn này|giai đoạn này|điều này|nội dung này|khi đó|từ đó|in this phase|during this period|at this stage|this stage)\b/i.test(
        normalizedLabel,
      ) &&
      normalizedSummary.length > normalizedLabel.length + 12
    ) {
      return true;
    }

    if (
      normalizedSummary &&
      normalizedSummary
        .toLowerCase()
        .startsWith(normalizedLabel.toLowerCase()) &&
      normalizedSummary.length - normalizedLabel.length > 20 &&
      normalizedLabel.split(/\s+/).length <= 6 &&
      /^[,;–-]/.test(
        normalizedSummary.slice(normalizedLabel.length).trimStart(),
      ) &&
      !normalizedSummary
        .slice(normalizedLabel.length)
        .trimStart()
        .startsWith(':')
    ) {
      return true;
    }

    return false;
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
