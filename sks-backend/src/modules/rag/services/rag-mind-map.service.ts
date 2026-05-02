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
  countMojibakeSignals,
  hasMojibakeText,
  repairMojibakeText,
} from 'src/common/utils/text-encoding';
import {
  DocumentMindMapResponse,
  DocumentSummaryResponse,
  MindMapArtifact,
  MindMapLanguageCache,
  MindMapNode,
  MindMapNodeStudyNoteResponse,
  MindMapVersionResponse,
  SummaryLanguage,
  SummaryVersionSlot,
} from '../types/rag.types';
import { RagArtifactCacheService } from './rag-artifact-cache.service';
import { RagDocumentContextService } from './rag-document-context.service';
import { RagIndexingService } from './rag-indexing.service';
import { RagSummaryService } from './rag-summary.service';
import { RagStructuredGenerationService } from './rag-structured-generation.service';
import { parseJsonWithRepair } from '../utils/llm-json';

const MIND_MAP_CONTEXT_CHUNKS = 28;
const MIND_MAP_ARTIFACT_VERSION = 18;
const MAX_MIND_MAP_DEPTH = 5;

const MIND_MAP_PROMPT = [
  'You are a senior academic and technical analyst building an interactive mind map.',
  'Use ONLY the provided document context.',
  'Do not invent facts, claims, or relationships that are not grounded in the context.',
  'Write all text in {languageName}.',
  'If the requested language is English, translate concepts and explanations into English even when the source context is in another language.',
  'If the requested language is Vietnamese, write natural Vietnamese with full diacritics.',
  'Optimize for learning: preserve real concepts, mechanisms, comparisons, workflows, examples, and cause-effect relationships from the document.',
  'Do not include admin noise, vague meta commentary, or repeated paraphrases.',
  'Use any user instruction only to choose emphasis, depth, visual grouping, and learning style.',
  '',
  'Create a flexible hierarchical tree for progressive exploration in a UI.',
  'Do not force generic sections such as "overview", "introduction", "takeaway", or "conclusion" unless the document itself naturally supports them.',
  'Organize the tree according to the real structure of the document.',
  'Let branch count and depth follow the source material; do not pad the tree to satisfy a template.',
  'Never collapse rich source material into a single shallow branch; a single top-level branch is acceptable only for a genuinely narrow, atomic document.',
  '',
  'User instruction:',
  '{instructionBlock}',
  '',
  'Output requirements:',
  '- title: short document title',
  '- summary: 2 to 4 sentences describing the document as a whole',
  '- branches: choose the natural number of top-level branches for the document; use a compact map for narrow material and a richer map for dense material',
  '- each branch must have label, summary, children',
  '- each node must include studyNote with overview, explanation, keyPoints, and studyFocus so the UI can show node details without another AI call',
  '- for substantial branches, include 2 to 4 children when those sub-ideas are grounded in the source',
  '- use grandchildren for procedures, grouped evidence, examples, formulas, or cause-effect chains when present in the document',
  '- each node summary should be 1 to 2 study-friendly sentences',
  '- each node label should be concise, specific, and understandable on its own',
  '- node labels must be semantic concept titles, not raw source sentences or chunk snippets',
  '- synthesize labels into short noun phrases, normally 2 to 8 words',
  '- never copy a whole excerpt, OCR fragment, or unfinished sentence into a label',
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
  'If the requested language is English, translate concepts and explanations into English even when the source context is in another language.',
  'If the requested language is Vietnamese, write natural Vietnamese with full diacritics.',
  'Do not force generic sections unless they are grounded in the document.',
  'Let branch count and depth follow the source material; do not pad the tree to satisfy a template.',
  'Do not return a single shallow branch for rich source material. Use natural grouping and nested children when the context contains multiple concepts.',
  'Use the source outline scaffold as the starting structure. Rewrite every scaffold heading and evidence line into polished, complete study nodes.',
  'Never output raw evidence lines, chunk text, page labels, or source group labels as mind map nodes.',
  'User instruction: {instructionBlock}',
  'You must synthesize the mind map yourself from the context. Do not reuse any raw context line as a node label.',
  'Node labels must be polished concept names, not fragments. Bad labels include "This is...", "Mác", "Căn cứ vào...", or any phrase ending mid-idea.',
  'Return JSON using this exact structure:',
  '{{',
  '  "title": "short document title",',
  '  "summary": "2 to 4 sentences describing the document as a whole",',
  '  "branches": [',
  '    {{',
  '      "label": "branch label",',
  '      "summary": "1 to 2 study-friendly sentences",',
  '      "studyNote": {{',
  '        "overview": "one clear sentence",',
  '        "explanation": "2 to 4 study-friendly sentences",',
  '        "keyPoints": ["specific grounded point", "specific grounded point"],',
  '        "studyFocus": "what the learner should remember"',
  '      }},',
  '      "children": [',
  '        {{',
  '          "label": "child label",',
  '          "summary": "1 to 2 study-friendly sentences",',
  '          "studyNote": {{',
  '            "overview": "one clear sentence",',
  '            "explanation": "2 to 4 study-friendly sentences",',
  '            "keyPoints": ["specific grounded point", "specific grounded point"],',
  '            "studyFocus": "what the learner should remember"',
  '          }},',
  '          "children": [',
  '            {{',
  '              "label": "grandchild label",',
  '              "summary": "1 to 2 study-friendly sentences",',
  '              "studyNote": {{',
  '                "overview": "one clear sentence",',
  '                "explanation": "2 to 4 study-friendly sentences",',
  '                "keyPoints": ["specific grounded point", "specific grounded point"],',
  '                "studyFocus": "what the learner should remember"',
  '              }},',
  '              "children": []',
  '            }}',
  '          ]',
  '        }}',
  '      ]',
  '    }}',
  '  ]',
  '}}',
  'Children arrays may be empty. Stop at the natural depth of the document.',
  'Prefer a richer tree when the source supports it, but do not invent or pad branches.',
  'Each label must be self-contained and meaningful on its own. Do not output truncated sentence fragments.',
  'Each label must be a semantic concept title, not a copied source sentence or chunk snippet.',
  'Never copy a whole excerpt, OCR fragment, or unfinished sentence into a label.',
  '',
  'Document title: {documentTitle}',
  '',
  'Context:',
  '{context}',
].join('\n');

const MIND_MAP_REPAIR_PROMPT = [
  'You are repairing an AI-generated mind map draft for a study app.',
  'Use ONLY the provided document context and the previous draft as hints.',
  'Return ONLY valid JSON. Do not include Markdown, comments, or code fences.',
  'Write every title, label, and summary in {languageName}.',
  'If the requested language is English, translate concepts and explanations into English even when the source context is in another language.',
  'If the requested language is Vietnamese, write natural Vietnamese with full diacritics.',
  'Respect this user instruction as the target style and emphasis: {instructionBlock}',
  '',
  'Fix these quality problems:',
  '{qualityFeedback}',
  '',
  'Repair requirements:',
  '- Build a polished academic mind map, not a chunk outline.',
  '- Use the source outline scaffold to recover branch structure, then rewrite every node into complete study language.',
  '- Do not copy raw source chunks, OCR fragments, long sentences, or unfinished phrases into labels.',
  '- Labels must be short semantic concept names, normally 2 to 8 words.',
  '- Choose the natural number of meaningful top-level branches for the context.',
  '- If the previous draft has only one shallow branch but the context contains multiple grounded ideas, expand it into a natural multi-branch tree.',
  '- Each substantial branch should have 2 to 4 grounded children.',
  '- Summaries should explain the idea clearly in 1 to 2 study-friendly sentences.',
  '- Keep facts faithful to the context; omit uncertain details instead of guessing.',
  '',
  'Return JSON with keys: title, summary, branches. Each branch and child must have label, summary, studyNote, children.',
  '',
  'Document title: {documentTitle}',
  '',
  'Previous weak draft JSON:',
  '{draftJson}',
  '',
  'Document context:',
  '{context}',
].join('\n');

const MIND_MAP_NODE_NOTE_PROMPT = [
  'You are a careful study tutor explaining one selected node from an academic mind map.',
  'Use ONLY the provided document context. Do not use sibling nodes as facts unless the document context supports the connection.',
  'Write in {languageName}. If Vietnamese, use natural Vietnamese with full diacritics.',
  'Explain the selected node directly. Do not merely repeat the node label or its short summary.',
  'If the node names a country, organization, person, period, or policy, explain the concrete implications for that entity when the context supports it.',
  'If the context only mentions the node generally, say that the document only states it at a general level, then list the specific questions the learner should look for. Do not invent unsupported details.',
  '',
  'Selected node:',
  '- Label: {nodeLabel}',
  '- Existing short summary: {nodeSummary}',
  '- Path in map: {nodePath}',
  '- Child labels: {childLabels}',
  '- Nearby sibling labels: {siblingLabels}',
  '',
  'Return JSON with:',
  '- overview: one clear sentence defining or situating the node',
  '- explanation: 3 to 6 study-friendly sentences that answer what the node means in this document',
  '- keyPoints: 3 to 6 concrete points grounded in the context; make them specific, not generic',
  '- studyFocus: 1 to 2 sentences telling the learner what to remember or check when revising this node',
  '',
  'Document title: {documentTitle}',
  '',
  'Relevant document context:',
  '{context}',
].join('\n');

const MIND_MAP_NODE_NOTE_JSON_FALLBACK_PROMPT = [
  'Return ONLY valid JSON for a study note explaining one selected mind map node.',
  'Use ONLY the provided document context. Write in {languageName}.',
  'Do not repeat the label as the explanation. Do not bring in sibling labels unless the context supports them.',
  'If context is too general, state the limitation clearly instead of inventing details.',
  'JSON shape:',
  '{{',
  '  "overview": "one sentence",',
  '  "explanation": "3 to 6 sentences",',
  '  "keyPoints": ["specific grounded point", "specific grounded point", "specific grounded point"],',
  '  "studyFocus": "1 to 2 sentences"',
  '}}',
  '',
  'Selected node label: {nodeLabel}',
  'Existing short summary: {nodeSummary}',
  'Path in map: {nodePath}',
  'Child labels: {childLabels}',
  'Nearby sibling labels: {siblingLabels}',
  'Document title: {documentTitle}',
  '',
  'Relevant document context:',
  '{context}',
].join('\n');

const MIND_MAP_STUDY_NOTE_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    overview: { type: 'string' },
    explanation: { type: 'string' },
    keyPoints: {
      type: 'array',
      minItems: 1,
      maxItems: 8,
      items: { type: 'string' },
    },
    studyFocus: { type: 'string' },
  },
  required: ['overview', 'explanation', 'keyPoints', 'studyFocus'],
} as const;

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
        studyNote: MIND_MAP_STUDY_NOTE_OUTPUT_SCHEMA,
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

const MIND_MAP_NODE_NOTE_OUTPUT_SCHEMA = MIND_MAP_STUDY_NOTE_OUTPUT_SCHEMA;

type MindMapDraftNode = {
  label: string;
  summary: string;
  children: MindMapDraftNode[];
  studyNote?: MindMapNodeStudyNoteDraft | null;
};

type MindMapDraft = {
  title: string;
  summary: string;
  branches: MindMapDraftNode[];
};

type MindMapNodeStudyNoteDraft = {
  overview: string;
  explanation: string;
  keyPoints: string[];
  studyFocus: string;
};

type MindMapSourceChunk = {
  chunkIndex: number;
  chunkText: string;
  pageNumber: number | null;
  sectionTitle: string | null;
};

type MindMapSourceProfile = {
  sourceWordCount: number;
  meaningfulChunkCount: number;
  minTopLevelBranches: number;
  minTotalNodes: number;
  requireNestedNode: boolean;
};

type MindMapSourceOutlineGroup = {
  heading: string;
  pages: string;
  evidence: string[];
};

@Injectable()
export class RagMindMapService {
  private readonly logger = new Logger(RagMindMapService.name);
  private readonly mindMapPrompt = PromptTemplate.fromTemplate(MIND_MAP_PROMPT);
  private readonly mindMapJsonFallbackPrompt = PromptTemplate.fromTemplate(
    MIND_MAP_JSON_FALLBACK_PROMPT,
  );
  private readonly mindMapRepairPrompt = PromptTemplate.fromTemplate(
    MIND_MAP_REPAIR_PROMPT,
  );
  private readonly mindMapNodeNotePrompt = PromptTemplate.fromTemplate(
    MIND_MAP_NODE_NOTE_PROMPT,
  );
  private readonly mindMapNodeNoteJsonFallbackPrompt =
    PromptTemplate.fromTemplate(MIND_MAP_NODE_NOTE_JSON_FALLBACK_PROMPT);

  constructor(
    private readonly ragIndexingService: RagIndexingService,
    private readonly ragDocumentContextService: RagDocumentContextService,
    private readonly ragArtifactCacheService: RagArtifactCacheService,
    private readonly ragSummaryService: RagSummaryService,
    private readonly ragStructuredGenerationService: RagStructuredGenerationService,
    private readonly userDocumentRepository: UserDocumentRepository,
  ) {}

  async getDocumentMindMap(
    documentId: string,
    ownerId: string,
    language: SummaryLanguage = 'en',
    forceRefresh = false,
    instruction?: string | null,
    slot?: SummaryVersionSlot,
  ): Promise<DocumentMindMapResponse> {
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
    const cachedMindMapState = this.ragArtifactCacheService.getMindMapState(
      userDocument,
      language,
      document,
    );
    const cachedMindMapSlot = this.resolveSelectedSlot(
      cachedMindMapState,
      requestedSlot,
    );

    if (
      cachedMindMapState &&
      cachedMindMapSlot &&
      this.isMindMapArtifactCurrentAndSafe(
        cachedMindMapState.versions?.[cachedMindMapSlot],
        language,
      ) &&
      !forceRefresh
    ) {
      return this.buildMindMapResponse(
        cachedMindMapState,
        cachedMindMapSlot,
        true,
      );
    }

    await this.ragIndexingService.ensureDocumentIndexed(documentId);
    const representativeChunks =
      await this.ragDocumentContextService.getRepresentativeChunks(
        documentId,
        MIND_MAP_CONTEXT_CHUNKS,
      );

    const documentTitle = document.title ?? 'Untitled document';

    if (representativeChunks.length === 0) {
      throw new BadRequestException(
        'This document has no indexed content available for mind map generation.',
      );
    }

    const generationContext = this.buildMindMapGenerationContext(
      representativeChunks,
      language,
    );
    const sourceProfile = this.buildMindMapSourceProfile(representativeChunks);
    let resolvedDraft: MindMapDraft;
    let weakDraft: MindMapDraft | null = null;
    const instructionBlock = this.buildInstructionBlock(requestedInstruction);

    try {
      weakDraft = await this.generateMindMapDraft({
        documentTitle,
        context: generationContext,
        languageName: this.getLanguageName(language),
        instructionBlock,
      });

      const draftIssues = this.describeMindMapAcceptanceIssues(
        weakDraft,
        sourceProfile,
        language,
      );

      if (draftIssues) {
        throw new Error(draftIssues);
      }

      resolvedDraft = weakDraft;
    } catch (generationError) {
      this.logger.warn(
        `Mind map primary generation failed quality checks: ${this.toErrorMessage(
          generationError,
        )}`,
      );
      try {
        const repairedDraft = await this.generateMindMapRepairDraft({
          documentTitle,
          context: generationContext,
          languageName: this.getLanguageName(language),
          instructionBlock,
          draftJson: this.stringifyMindMapDraftForRepair(weakDraft),
          qualityFeedback:
            weakDraft !== null
              ? this.describeMindMapAcceptanceIssues(
                  weakDraft,
                  sourceProfile,
                  language,
                )
              : this.toErrorMessage(generationError),
        });

        const repairedDraftIssues = this.describeMindMapAcceptanceIssues(
          repairedDraft,
          sourceProfile,
          language,
        );

        if (repairedDraftIssues) {
          throw new Error(repairedDraftIssues);
        }

        resolvedDraft = repairedDraft;
      } catch (repairError) {
        this.logger.warn(
          `Mind map AI generation failed after primary and repair attempts; using source-driven fallback: ${this.toErrorMessage(
            repairError,
          )}`,
        );
        resolvedDraft = this.buildSourceDrivenMindMapDraft(
          documentTitle,
          representativeChunks,
          language,
        );

        const fallbackLanguageIssue = this.describeMindMapLanguageIssue(
          resolvedDraft,
          language,
        );

        if (fallbackLanguageIssue) {
          throw new ServiceUnavailableException(
            'AI service could not generate a mind map in the requested language right now. Please wait a bit and try again.',
          );
        }
      }
    }

    const displayDraft = this.sanitizeMindMapDraftForDisplay(
      resolvedDraft,
      documentTitle,
      language,
    );
    const mindMapRoot = this.buildMindMapFromDraft(displayDraft, language);
    const summaryText = this.buildMindMapSummaryText(displayDraft, language);
    const outputLanguage = language;

    const generatedAt = new Date().toISOString();
    const targetSlot = requestedSlot ?? 'default';
    const mindMapArtifact: MindMapArtifact = {
      root: mindMapRoot,
      summaryText,
      generatedAt,
      summaryLanguage: outputLanguage,
      version: MIND_MAP_ARTIFACT_VERSION,
      slot: targetSlot,
      instruction: requestedInstruction,
      sources: this.ragDocumentContextService.buildSources(
        documentId,
        documentTitle,
        representativeChunks,
      ),
    };

    await this.ragArtifactCacheService.saveMindMap(
      userDocument,
      mindMapArtifact,
      document,
    );

    const nextMindMapState = this.ragArtifactCacheService.getMindMapState(
      userDocument,
      language,
      document,
    );

    if (!nextMindMapState) {
      throw new BadGatewayException(
        'Mind map generation succeeded but could not be persisted.',
      );
    }

    return this.buildMindMapResponse(nextMindMapState, targetSlot, false);
  }

  async generateMindMapNodeStudyNote(
    documentId: string,
    ownerId: string,
    options: {
      language: SummaryLanguage;
      label: string;
      summary?: string | null;
      pathLabels?: string[];
      childLabels?: string[];
      siblingLabels?: string[];
    },
  ): Promise<MindMapNodeStudyNoteResponse> {
    const document = await this.ragDocumentContextService.ensureOwnedDocument(
      documentId,
      ownerId,
    );
    const nodeLabel = this.normalizeMindMapLabel(options.label);

    if (!nodeLabel) {
      throw new BadRequestException('Mind map node label is required.');
    }

    await this.ragIndexingService.ensureDocumentIndexed(documentId);

    const nodeSummary = this.normalizeMindMapText(options.summary);
    const pathLabels = this.normalizeMindMapLabelList(options.pathLabels);
    const childLabels = this.normalizeMindMapLabelList(options.childLabels);
    const siblingLabels = this.normalizeMindMapLabelList(options.siblingLabels);
    const query = [
      nodeLabel,
      nodeSummary,
      pathLabels.join(' > '),
      childLabels.join(', '),
    ]
      .filter(Boolean)
      .join('\n');
    const relevantChunks =
      await this.ragDocumentContextService.getRelevantChunks(
        documentId,
        query,
        8,
      );

    if (relevantChunks.length === 0) {
      throw new BadRequestException(
        'This document has no indexed content available for node study notes.',
      );
    }

    const input = {
      documentTitle: document.title ?? 'Untitled document',
      languageName: this.getLanguageName(options.language),
      nodeLabel,
      nodeSummary: nodeSummary || 'No short summary was provided.',
      nodePath: pathLabels.length > 0 ? pathLabels.join(' > ') : nodeLabel,
      childLabels: childLabels.length > 0 ? childLabels.join(', ') : 'None',
      siblingLabels:
        siblingLabels.length > 0 ? siblingLabels.join(', ') : 'None',
      context: this.ragDocumentContextService.buildSummaryContext(
        relevantChunks,
      ),
    };

    let draft: MindMapNodeStudyNoteDraft;

    try {
      draft = await this.ragStructuredGenerationService.generate({
        input,
        prompt: this.mindMapNodeNotePrompt,
        fallbackPrompt: this.mindMapNodeNoteJsonFallbackPrompt,
        outputSchema: MIND_MAP_NODE_NOTE_OUTPUT_SCHEMA,
        schemaName: 'mind_map_node_study_note',
        operationLabel: 'Mind map node study note generation',
        coerce: (value) => this.coerceMindMapNodeStudyNoteDraft(value),
        parseRawResponse: (rawResponse) =>
          this.parseRawMindMapNodeStudyNoteDraft(rawResponse),
        logger: this.logger,
      });
    } catch (error) {
      this.logger.warn(
        `Mind map node study note AI generation failed; using source fallback: ${this.toErrorMessage(
          error,
        )}`,
      );
      draft = this.buildSourceDrivenNodeStudyNoteDraft(
        nodeLabel,
        nodeSummary,
        pathLabels,
        childLabels,
        siblingLabels,
        relevantChunks,
        options.language,
      );
    }

    const normalizedDraft = this.normalizeMindMapNodeStudyNoteDraft(
      draft,
      nodeLabel,
      nodeSummary,
      options.language,
    );

    return {
      label: nodeLabel,
      ...normalizedDraft,
      language: options.language,
      generatedAt: new Date().toISOString(),
      sources: this.ragDocumentContextService.buildSources(
        documentId,
        document.title ?? 'Untitled document',
        relevantChunks,
      ),
    };
  }

  private getLanguageName(language: SummaryLanguage): string {
    return language === 'vi' ? 'Vietnamese' : 'English';
  }

  private buildInstructionBlock(instruction?: string | null): string {
    if (!instruction) {
      return 'No additional user instruction. Build the most faithful, study-friendly mind map for the document.';
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

  private normalizeMindMapLabelList(values?: string[]): string[] {
    if (!Array.isArray(values)) {
      return [];
    }

    return values
      .map((value) => this.normalizeMindMapLabel(value))
      .filter(Boolean)
      .slice(0, 8);
  }

  private coerceMindMapNodeStudyNoteDraft(
    value: unknown,
  ): MindMapNodeStudyNoteDraft | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const candidate = value as Record<string, unknown>;
    const keyPoints = Array.isArray(candidate.keyPoints)
      ? candidate.keyPoints.filter(
          (point): point is string => typeof point === 'string',
        )
      : Array.isArray(candidate.key_points)
        ? candidate.key_points.filter(
            (point): point is string => typeof point === 'string',
          )
        : [];
    const draft = {
      overview:
        typeof candidate.overview === 'string' ? candidate.overview : '',
      explanation:
        typeof candidate.explanation === 'string'
          ? candidate.explanation
          : typeof candidate.detail === 'string'
            ? candidate.detail
            : '',
      keyPoints,
      studyFocus:
        typeof candidate.studyFocus === 'string'
          ? candidate.studyFocus
          : typeof candidate.study_focus === 'string'
            ? candidate.study_focus
            : '',
    };

    if (
      !this.normalizeMindMapText(draft.overview) &&
      !this.normalizeMindMapText(draft.explanation) &&
      draft.keyPoints.length === 0
    ) {
      return null;
    }

    return draft;
  }

  private parseRawMindMapNodeStudyNoteDraft(
    rawResponse: string,
  ): MindMapNodeStudyNoteDraft {
    const parsed = parseJsonWithRepair<unknown>(rawResponse);
    const draft = this.coerceMindMapNodeStudyNoteDraft(parsed);

    if (!draft) {
      throw new Error(
        'Mind map node study note generation returned an empty JSON payload.',
      );
    }

    return draft;
  }

  private normalizeMindMapNodeStudyNoteDraft(
    draft: MindMapNodeStudyNoteDraft,
    nodeLabel: string,
    nodeSummary: string,
    language: SummaryLanguage,
  ): Pick<
    MindMapNodeStudyNoteResponse,
    'overview' | 'explanation' | 'keyPoints' | 'studyFocus'
  > {
    const isVietnamese = language === 'vi';
    const overview =
      this.normalizeMindMapText(draft.overview) ||
      nodeSummary ||
      (isVietnamese
        ? `${nodeLabel} là một ý cần được đọc trong mạch tài liệu.`
        : `${nodeLabel} is an idea that should be read in the document context.`);
    const explanation =
      this.normalizeMindMapText(draft.explanation) ||
      this.buildSourceDrivenNodeSummary(nodeLabel, nodeSummary, isVietnamese);
    const keyPoints = this.dedupeMindMapDetails(
      draft.keyPoints
        .map((point) => this.normalizeMindMapText(point))
        .filter(Boolean),
    ).slice(0, 6);
    const studyFocus =
      this.normalizeMindMapText(draft.studyFocus) ||
      (isVietnamese
        ? `Khi ôn phần này, hãy tự trả lời: ${nodeLabel} là gì, vì sao xuất hiện trong tài liệu, và nó tác động như thế nào đến chủ đề chính.`
        : `When revising this node, answer what ${nodeLabel} means, why it appears in the document, and how it affects the main topic.`);

    return {
      overview: this.truncateMindMapSummary(overview, 420),
      explanation: this.truncateMindMapSummary(explanation, 900),
      keyPoints:
        keyPoints.length > 0
          ? keyPoints.map((point) => this.truncateMindMapSummary(point, 260))
          : [this.truncateMindMapSummary(overview, 260)],
      studyFocus: this.truncateMindMapSummary(studyFocus, 420),
    };
  }

  private buildStoredNodeStudyNoteDraft(
    nodeLabel: string,
    nodeSummary: string,
    children: Array<Pick<MindMapDraftNode, 'label' | 'summary'>>,
    isVietnamese: boolean,
  ): MindMapNodeStudyNoteDraft {
    const normalizedLabel = this.normalizeMindMapLabel(nodeLabel);
    const normalizedSummary = this.normalizeMindMapText(nodeSummary);
    const childPoints = children
      .map((child) => {
        const childLabel = this.normalizeMindMapLabel(child.label);
        const childSummary = this.normalizeMindMapText(child.summary);

        if (childLabel && childSummary && childLabel !== childSummary) {
          return `${childLabel}: ${childSummary}`;
        }

        return childSummary || childLabel;
      })
      .filter(Boolean)
      .slice(0, 4);
    const overview =
      normalizedSummary ||
      (isVietnamese
        ? `${normalizedLabel} là một ý chính trong sơ đồ tư duy.`
        : `${normalizedLabel} is a key idea in this mind map.`);
    const childContext =
      childPoints.length > 0
        ? isVietnamese
          ? `Các ý con cần xem cùng node này gồm: ${childPoints
              .map((point) => this.truncateMindMapSummary(point, 180))
              .join(' ')}`
          : `Related child ideas to review with this node include: ${childPoints
              .map((point) => this.truncateMindMapSummary(point, 180))
              .join(' ')}`
        : '';
    const explanation = [overview, childContext].filter(Boolean).join(' ');
    const keyPoints = this.dedupeMindMapDetails([
      ...this.extractMindMapDetails(normalizedSummary || overview, 4),
      ...childPoints,
    ]).slice(0, 6);
    const studyFocus = isVietnamese
      ? `Khi ôn "${normalizedLabel}", hãy nắm ý nghĩa chính, các ý con liên quan và vai trò của node này trong chủ đề tổng thể.`
      : `When reviewing "${normalizedLabel}", focus on its main meaning, related child ideas, and role in the overall topic.`;

    return {
      overview,
      explanation,
      keyPoints: keyPoints.length > 0 ? keyPoints : [overview],
      studyFocus,
    };
  }

  private buildSourceDrivenNodeStudyNoteDraft(
    nodeLabel: string,
    nodeSummary: string,
    pathLabels: string[],
    childLabels: string[],
    siblingLabels: string[],
    chunks: MindMapSourceChunk[],
    language: SummaryLanguage,
  ): MindMapNodeStudyNoteDraft {
    const isVietnamese = language === 'vi';
    const queryTerms = new Set(
      this.normalizeMindMapForMatch(
        [nodeLabel, nodeSummary, ...pathLabels, ...childLabels].join(' '),
      )
        .split(/\s+/)
        .filter((term) => term.length >= 3),
    );
    const evidenceSentences = this.dedupeMindMapDetails(
      chunks.flatMap((chunk) => this.extractMindMapSentences(chunk.chunkText, 4)),
    )
      .filter((sentence) => {
        const normalizedSentence = this.normalizeMindMapForMatch(sentence);
        return [...queryTerms].some((term) => normalizedSentence.includes(term));
      })
      .slice(0, 6);
    const fallbackSentences = this.dedupeMindMapDetails(
      chunks.flatMap((chunk) => this.extractMindMapSentences(chunk.chunkText, 2)),
    ).slice(0, 4);
    const sourcePoints =
      evidenceSentences.length > 0 ? evidenceSentences : fallbackSentences;
    const parentLabel = pathLabels.length >= 2 ? pathLabels.at(-2) : '';
    const overview =
      nodeSummary ||
      sourcePoints[0] ||
      (isVietnamese
        ? `${nodeLabel} là một ý được nhắc trong tài liệu.`
        : `${nodeLabel} is an idea mentioned in the document.`);
    const contextSentence =
      parentLabel && parentLabel !== nodeLabel
        ? isVietnamese
          ? `Trong sơ đồ, ý này nằm dưới nhánh ${parentLabel}, nên cần hiểu nó như một phần của chủ đề đó.`
          : `In the map, this idea sits under ${parentLabel}, so it should be understood as part of that topic.`
        : '';
    const limitationSentence =
      sourcePoints.length <= 1
        ? isVietnamese
          ? 'Tài liệu hiện chỉ cung cấp ít chi tiết trực tiếp cho node này; phần dưới đây ưu tiên các câu gần nhất trong nguồn thay vì suy đoán thêm.'
          : 'The document provides limited direct detail for this node; the note below prioritizes the nearest source evidence instead of guessing.'
        : '';
    const explanation = [overview, contextSentence, limitationSentence]
      .filter(Boolean)
      .join(' ');
    const keyPoints =
      sourcePoints.length > 0
        ? sourcePoints
        : siblingLabels.length > 0
          ? siblingLabels.map((label) =>
              isVietnamese
                ? `Kiểm tra mối liên hệ giữa ${nodeLabel} và ${label} trong tài liệu.`
                : `Check how ${nodeLabel} relates to ${label} in the document.`,
            )
          : [overview];
    const studyFocus = isVietnamese
      ? `Khi học ${nodeLabel}, hãy tìm ba lớp thông tin: khái niệm là gì, nguyên nhân hoặc bối cảnh nào tạo ra nó, và hệ quả của nó đối với chủ đề chính.`
      : `When studying ${nodeLabel}, look for three layers: what it means, what context or cause creates it, and what consequence it has for the main topic.`;

    return {
      overview,
      explanation,
      keyPoints,
      studyFocus,
    };
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
    mindMapState: MindMapLanguageCache | null,
    requestedSlot?: SummaryVersionSlot,
  ): SummaryVersionSlot | null {
    if (!mindMapState?.versions) {
      return null;
    }

    if (requestedSlot && mindMapState.versions[requestedSlot]) {
      return requestedSlot;
    }

    if (
      mindMapState.activeSlot &&
      mindMapState.versions[mindMapState.activeSlot]
    ) {
      return mindMapState.activeSlot;
    }

    if (mindMapState.versions.default) {
      return 'default';
    }

    if (mindMapState.versions.custom) {
      return 'custom';
    }

    return null;
  }

  private isMindMapArtifactCurrentAndSafe(
    artifact: MindMapArtifact | undefined,
    language: SummaryLanguage,
  ): boolean {
    return Boolean(
      artifact?.root &&
        artifact.summaryText &&
        artifact.version >= MIND_MAP_ARTIFACT_VERSION &&
        this.isMindMapArtifactLanguageSafe(artifact, language) &&
        this.isMindMapTreeDisplaySafe(artifact.root) &&
        this.isMindMapTreeStructurallyUseful(artifact.root) &&
        this.isMindMapTreeStudyNoteReady(artifact.root),
    );
  }

  private isMindMapArtifactLanguageSafe(
    artifact: MindMapArtifact,
    language: SummaryLanguage,
  ): boolean {
    const artifactText = [
      artifact.summaryText,
      this.collectMindMapNodeText(artifact.root),
    ].join(' ');

    if (this.hasMojibakeSignals(artifactText)) {
      return false;
    }

    return language !== 'en' || !this.hasVietnameseLanguageSignals(artifactText);
  }

  private collectMindMapNodeText(node: MindMapNode | null | undefined): string {
    if (!node) {
      return '';
    }

    return [
      node.label,
      node.summary,
      node.studyNote?.overview ?? '',
      node.studyNote?.explanation ?? '',
      node.studyNote?.studyFocus ?? '',
      ...(node.studyNote?.keyPoints ?? []),
      ...(Array.isArray(node.children)
        ? node.children.map((child) => this.collectMindMapNodeText(child))
        : []),
    ]
      .filter(Boolean)
      .join(' ');
  }

  private buildMindMapResponse(
    mindMapState: MindMapLanguageCache,
    selectedSlot: SummaryVersionSlot,
    cached: boolean,
  ): DocumentMindMapResponse {
    const selectedMindMap = mindMapState.versions?.[selectedSlot];

    if (!selectedMindMap) {
      throw new BadGatewayException(
        'Requested mind map version does not exist.',
      );
    }

    return {
      mindMap: selectedMindMap.root,
      summary: selectedMindMap.summaryText,
      language: selectedMindMap.summaryLanguage,
      generatedAt: selectedMindMap.generatedAt,
      cached,
      slot: selectedMindMap.slot,
      instruction: selectedMindMap.instruction,
      activeSlot: mindMapState.activeSlot ?? selectedSlot,
      versions: this.buildMindMapVersionResponses(mindMapState),
    };
  }

  private buildMindMapVersionResponses(
    mindMapState: MindMapLanguageCache,
  ): MindMapVersionResponse[] {
    const versions = mindMapState.versions ?? {};

    return (['default', 'custom'] as const)
      .map((slot) => {
        const mindMap = versions[slot];

        if (!mindMap) {
          return null;
        }

        return {
          ...mindMap,
          active: (mindMapState.activeSlot ?? 'default') === slot,
        } satisfies MindMapVersionResponse;
      })
      .filter((mindMap): mindMap is MindMapVersionResponse =>
        Boolean(mindMap),
      );
  }

  private async generateMindMapDraft(input: {
    documentTitle: string;
    context: string;
    languageName: string;
    instructionBlock: string;
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
        temperature: 0.35,
        maxOutputTokens: 16384,
        topP: 0.92,
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

  private async generateMindMapRepairDraft(input: {
    documentTitle: string;
    context: string;
    languageName: string;
    instructionBlock: string;
    draftJson: string;
    qualityFeedback: string;
  }): Promise<MindMapDraft> {
    const draft = await this.ragStructuredGenerationService.generate({
      input,
      prompt: this.mindMapRepairPrompt,
      fallbackPrompt: this.mindMapRepairPrompt,
      outputSchema: MIND_MAP_OUTPUT_SCHEMA,
      schemaName: 'document_mind_map_repair',
      operationLabel: 'Mind map repair generation',
      skipJsonSchema: true,
      skipFunctionCalling: true,
      modelOptions: {
        temperature: 0.18,
        maxOutputTokens: 16384,
        topP: 0.86,
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
    language: SummaryLanguage,
  ): string {
    const outlineHeader =
      language === 'vi'
        ? 'Yêu cầu tạo sơ đồ tư duy:'
        : 'Mind map generation requirements:';
    const excerptsHeader =
      language === 'vi'
        ? 'Đoạn trích đại diện từ tài liệu để AI đọc hiểu và tổng hợp:'
        : 'Representative document excerpts:';
    const generationRules =
      language === 'vi'
        ? [
            '- AI phải tự tổng hợp node thành khái niệm học tập rõ nghĩa.',
            '- Không dùng nguyên văn chunk, không dùng đoạn bị cắt, không dùng cụm bắt đầu giữa câu.',
            '- Label node phải là tiếng Việt có dấu, tự nhiên, ngắn gọn và đúng ngữ cảnh.',
          ].join('\n')
        : [
            '- AI must synthesize nodes into clear study concepts.',
            '- Do not copy raw chunks, truncated excerpts, or fragments that start mid-sentence.',
            '- Node labels must be natural, concise, and context-aware.',
          ].join('\n');
    const scaffoldHeader =
      'Source outline scaffold for AI rewriting. This is not final output:';
    const scaffoldRules = [
      '- Build the final tree from the source outline scaffold, not directly from raw chunks.',
      '- Treat each source group as a candidate top-level branch; merge groups only when they clearly describe the same concept.',
      '- Turn evidence lines into complete child nodes with polished labels and study-friendly summaries.',
      '- Rewrite all labels and summaries in the requested output language.',
      '- Do not expose words such as "source group", "evidence", "chunk", or "page" as node labels.',
      '- Do not copy raw excerpts verbatim; paraphrase them into clear academic language while preserving meaning.',
    ].join('\n');

    return [
      outlineHeader,
      generationRules,
      scaffoldRules,
      '',
      scaffoldHeader,
      this.buildMindMapSourceOutline(chunks),
      '',
      'Supporting evidence excerpts for meaning only. Do not copy these into node labels:',
      excerptsHeader,
      this.buildMindMapEvidenceContext(chunks),
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildMindMapSourceOutline(chunks: MindMapSourceChunk[]): string {
    const groups = this.buildMindMapSourceOutlineGroups(chunks);

    if (groups.length === 0) {
      return 'No reliable source outline could be extracted. Use the supporting evidence excerpts carefully.';
    }

    return groups
      .map((group, index) =>
        [
          `${index + 1}. Source group: ${group.heading}${group.pages ? ` (${group.pages})` : ''}`,
          ...group.evidence.map(
            (evidence, evidenceIndex) =>
              `   - Evidence to rewrite ${evidenceIndex + 1}: ${evidence}`,
          ),
        ].join('\n'),
      )
      .join('\n\n');
  }

  private buildMindMapSourceOutlineGroups(
    chunks: MindMapSourceChunk[],
  ): MindMapSourceOutlineGroup[] {
    const usefulChunks = chunks.filter((chunk) =>
      Boolean(this.normalizeMindMapText(chunk.chunkText)),
    );

    if (usefulChunks.length === 0) {
      return [];
    }

    const sectionGroups = this.groupMindMapChunksBySection(usefulChunks);

    if (sectionGroups.length >= 2) {
      return sectionGroups.slice(0, 8);
    }

    return this.groupMindMapChunksByWindow(usefulChunks).slice(0, 8);
  }

  private groupMindMapChunksBySection(
    chunks: MindMapSourceChunk[],
  ): MindMapSourceOutlineGroup[] {
    const groups = new Map<string, MindMapSourceChunk[]>();

    for (const chunk of chunks) {
      const sectionTitle = this.normalizeMindMapLabel(chunk.sectionTitle);

      if (!sectionTitle) {
        continue;
      }

      const currentChunks = groups.get(sectionTitle) ?? [];
      currentChunks.push(chunk);
      groups.set(sectionTitle, currentChunks);
    }

    return [...groups.entries()].map(([sectionTitle, sectionChunks], index) =>
      this.buildMindMapSourceOutlineGroup(
        sectionTitle || `Document section ${index + 1}`,
        sectionChunks,
        index,
      ),
    );
  }

  private groupMindMapChunksByWindow(
    chunks: MindMapSourceChunk[],
  ): MindMapSourceOutlineGroup[] {
    const targetGroupCount = Math.min(
      6,
      Math.max(1, Math.ceil(chunks.length / 3)),
    );
    const groupSize = Math.max(1, Math.ceil(chunks.length / targetGroupCount));
    const groups: MindMapSourceOutlineGroup[] = [];

    for (let index = 0; index < chunks.length; index += groupSize) {
      const groupChunks = chunks.slice(index, index + groupSize);
      const firstChunk = groupChunks[0];
      const heading =
        this.normalizeMindMapLabel(firstChunk?.sectionTitle) ||
        this.deriveFallbackNodeLabel(
          firstChunk?.chunkText ?? '',
          0,
          groups.length,
          false,
        ) ||
        `Document segment ${groups.length + 1}`;

      groups.push(
        this.buildMindMapSourceOutlineGroup(
          heading,
          groupChunks,
          groups.length,
        ),
      );
    }

    return groups;
  }

  private buildMindMapSourceOutlineGroup(
    heading: string,
    chunks: MindMapSourceChunk[],
    index = 0,
  ): MindMapSourceOutlineGroup {
    const evidence = chunks
      .map((chunk) => this.buildMindMapEvidencePoint(chunk))
      .filter(Boolean)
      .slice(0, 4);

    return {
      heading: this.normalizeMindMapLabel(heading) || `Source group ${index + 1}`,
      pages: this.formatMindMapSourcePages(chunks),
      evidence,
    };
  }

  private buildMindMapEvidenceContext(chunks: MindMapSourceChunk[]): string {
    return chunks
      .map((chunk, index) => {
        const evidence = this.buildMindMapEvidencePoint(chunk);

        if (!evidence) {
          return '';
        }

        const pageLabel =
          typeof chunk.pageNumber === 'number'
            ? `page ${chunk.pageNumber}`
            : 'page unknown';
        const sectionLabel = this.normalizeMindMapLabel(chunk.sectionTitle);

        return `Evidence ${index + 1}${sectionLabel ? `, ${sectionLabel}` : ''}, ${pageLabel}: ${evidence}`;
      })
      .filter(Boolean)
      .slice(0, 28)
      .join('\n');
  }

  private buildMindMapEvidencePoint(chunk: MindMapSourceChunk): string {
    const text = this.normalizeMindMapText(chunk.chunkText);

    if (!text) {
      return '';
    }

    const sentences = text
      .split(/(?<=[.!?])\s+|\n+/)
      .map((sentence) => this.normalizeMindMapText(sentence))
      .filter(Boolean);
    const evidence =
      sentences.length > 1 ? sentences.slice(0, 2).join(' ') : text;

    return this.truncateMindMapSummary(evidence, 300);
  }

  private formatMindMapSourcePages(chunks: MindMapSourceChunk[]): string {
    const pages = [
      ...new Set(
        chunks
          .map((chunk) => chunk.pageNumber)
          .filter((page): page is number => typeof page === 'number'),
      ),
    ].sort((left, right) => left - right);

    if (pages.length === 0) {
      return '';
    }

    if (pages.length === 1) {
      return `page ${pages[0]}`;
    }

    const firstPage = pages[0];
    const lastPage = pages[pages.length - 1];
    const isContiguous =
      lastPage - firstPage + 1 === pages.length &&
      pages.every((page, index) => page === firstPage + index);

    return isContiguous
      ? `pages ${firstPage}-${lastPage}`
      : `pages ${pages.join(', ')}`;
  }

  private buildMindMapSourceProfile(
    chunks: MindMapSourceChunk[],
  ): MindMapSourceProfile {
    const sourceWordCount = chunks.reduce(
      (total, chunk) => total + this.countMindMapWords(chunk.chunkText),
      0,
    );
    const meaningfulChunkCount = chunks.filter(
      (chunk) => this.countMindMapWords(chunk.chunkText) >= 10,
    ).length;
    const isBroadSource = sourceWordCount >= 80 || meaningfulChunkCount >= 3;
    const isDenseSource = sourceWordCount >= 400 || meaningfulChunkCount >= 8;

    if (!isBroadSource) {
      return {
        sourceWordCount,
        meaningfulChunkCount,
        minTopLevelBranches: 1,
        minTotalNodes: 1,
        requireNestedNode: false,
      };
    }

    return {
      sourceWordCount,
      meaningfulChunkCount,
      minTopLevelBranches: isDenseSource ? 3 : 2,
      minTotalNodes: isDenseSource ? 8 : 4,
      requireNestedNode: true,
    };
  }

  private async buildSummaryBackedMindMapDraft(
    documentId: string,
    ownerId: string,
    documentTitle: string,
    language: SummaryLanguage,
  ): Promise<MindMapDraft | null> {
    try {
      const summary = await this.ragSummaryService.generateSummary(
        documentId,
        ownerId,
        language,
        false,
      );

      return this.buildMindMapDraftFromSummary(
        summary,
        documentTitle,
        language,
      );
    } catch (summaryError) {
      this.logger.warn(
        `AI summary map fallback failed: ${this.toErrorMessage(summaryError)}`,
      );
      return null;
    }
  }

  private buildMindMapDraftFromSummary(
    summary: DocumentSummaryResponse,
    documentTitle: string,
    language: SummaryLanguage,
  ): MindMapDraft {
    const isVietnamese = language === 'vi';
    const narrativeBody =
      summary.format === 'narrative'
        ? this.normalizeMindMapText(summary.body)
        : '';
    const overview = this.normalizeMindMapText(summary.overview);
    const conclusion = this.normalizeMindMapText(summary.conclusion);
    const keyPoints = Array.isArray(summary.key_points)
      ? summary.key_points
          .map((point) => this.normalizeMindMapText(point))
          .filter(Boolean)
          .slice(0, 7)
      : [];
    const branchSources =
      keyPoints.length > 0
        ? keyPoints
        : this.extractMindMapDetails(narrativeBody || overview, 6);
    const branches = branchSources
      .map((point, index) =>
        this.buildSummaryBackedBranch(point, index, isVietnamese),
      )
      .filter((branch): branch is MindMapDraftNode => Boolean(branch));

    if (overview && branches.length < 7) {
      branches.unshift({
        label: isVietnamese ? 'Tổng quan tài liệu' : 'Document overview',
        summary: overview,
        children: [],
      });
    }

    if (conclusion && branches.length < 4) {
      branches.push({
        label: isVietnamese ? 'Kết luận học tập' : 'Study takeaway',
        summary: conclusion,
        children: [],
      });
    }

    return this.normalizeMindMapDraft(
      {
        title: this.normalizeText(summary.title) || documentTitle,
        summary:
          narrativeBody ||
          overview ||
          conclusion ||
          (isVietnamese
            ? 'Sơ đồ tư duy này được dựng từ bản tóm tắt AI của tài liệu.'
            : 'This mind map is built from the AI summary of the document.'),
        branches:
          branches.length > 0
            ? branches
            : this.buildMinimalMindMapDraft(documentTitle, language).branches,
      },
      documentTitle,
      this.getLanguageName(language),
    );
  }

  private buildSummaryBackedBranch(
    point: string,
    index: number,
    isVietnamese: boolean,
  ): MindMapDraftNode | null {
    const normalizedPoint = this.normalizeMindMapText(point);

    if (!normalizedPoint || this.isTrivialMindMapSourceText(normalizedPoint)) {
      return null;
    }

    const label = this.buildSummaryBackedConceptLabel(
      normalizedPoint,
      index,
      isVietnamese,
    );

    if (this.isWeakMindMapDisplayLabel(label)) {
      return null;
    }

    return {
      label,
      summary: normalizedPoint,
      children: [],
    };
  }

  private buildSummaryBackedConceptLabel(
    sourceText: string,
    index: number,
    isVietnamese: boolean,
  ): string {
    const normalizedSource = this.normalizeMindMapText(sourceText);
    const definitionLabel = this.extractDefinitionConceptLabel(
      normalizedSource,
      isVietnamese,
    );

    if (definitionLabel) {
      return definitionLabel;
    }

    const semanticLabel = this.polishSummaryBackedLabel(
      this.extractSemanticMindMapLabelSource(normalizedSource),
      isVietnamese,
    );

    if (
      semanticLabel &&
      !this.isWeakOrRawMindMapLabel(semanticLabel, normalizedSource)
    ) {
      return semanticLabel;
    }

    return isVietnamese ? `Ý chính ${index + 1}` : `Key idea ${index + 1}`;
  }

  private extractDefinitionConceptLabel(
    sourceText: string,
    isVietnamese: boolean,
  ): string {
    const normalizedSource = this.normalizeMindMapText(sourceText);
    const match = normalizedSource.match(
      /^(.{4,90}?)\s+(?:được hiểu là|duoc hieu la|được xem là|duoc xem la|là|la|bao gồm|bao gom|gồm|gom|trình bày|trinh bay|giải thích|giai thich|nhấn mạnh|nhan manh|đề cập|de cap|is|are|refers to|means|includes|explains|describes)(?:\s|$|[:;,.-])/i,
    );

    if (!match?.[1]) {
      return '';
    }

    const subject = this.polishSummaryBackedLabel(match[1], isVietnamese);

    if (!subject) {
      return '';
    }

    if (
      isVietnamese &&
      /(?:chủ nghĩa xã hội|chu nghia xa hoi|cnxh)/i.test(subject)
    ) {
      return 'Khái niệm chủ nghĩa xã hội';
    }

    return subject;
  }

  private polishSummaryBackedLabel(
    value: string,
    isVietnamese: boolean,
  ): string {
    let candidate = this.normalizeMindMapLabel(value)
      .replace(/^(?:một|mot|a|an)\s+/i, '')
      .replace(/\s+(?:được hiểu là|duoc hieu la|là|la)\s*$/i, '')
      .trim();

    if (!candidate) {
      return '';
    }

    if (
      isVietnamese &&
      /trào lưu.*giải phóng|trao luu.*giai phong/i.test(candidate)
    ) {
      return 'Tư tưởng giải phóng con người';
    }

    if (
      isVietnamese &&
      /khoa học.*sứ mệnh lịch sử|khoa hoc.*su menh lich su/i.test(candidate)
    ) {
      return 'Sứ mệnh lịch sử';
    }

    candidate = this.compactMindMapLabelWords(candidate, 6);

    return isVietnamese
      ? candidate.replace(/^(\p{Ll})/u, (match) =>
          match.toLocaleUpperCase('vi-VN'),
        )
      : candidate.replace(/^([a-z])/, (match) => match.toUpperCase());
  }

  private buildSummaryBackedChildren(
    sourceText: string,
    isVietnamese: boolean,
    depth: number,
  ): MindMapDraftNode[] {
    const normalizedSource = this.normalizeMindMapText(sourceText);

    return this.extractMindMapDetails(normalizedSource, 4)
      .filter((detail) => detail !== normalizedSource)
      .slice(0, 3)
      .map((detail, index) => {
        const label = this.deriveFallbackNodeLabel(
          detail,
          depth,
          index,
          isVietnamese,
        );

        return {
          label,
          summary: detail,
          children: [],
        };
      });
  }

  private buildMinimalMindMapDraft(
    documentTitle: string,
    language: SummaryLanguage,
  ): MindMapDraft {
    const isVietnamese = language === 'vi';

    return {
      title: documentTitle,
      summary: isVietnamese
        ? 'Hệ thống chưa có đủ nội dung ổn định để dựng sơ đồ tư duy chi tiết.'
        : 'The system does not yet have enough stable extracted content to build a detailed mind map.',
      branches: [
        {
          label: isVietnamese ? 'Nội dung tài liệu' : 'Document content',
          summary: isVietnamese
            ? 'Vui lòng thử tạo lại sau khi tài liệu được trích xuất nội dung đầy đủ hơn.'
            : 'Please regenerate after the document content has been extracted more completely.',
          children: [],
        },
      ],
    };
  }

  private sanitizeMindMapDraftForDisplay(
    draft: MindMapDraft,
    documentTitle: string,
    language: SummaryLanguage,
  ): MindMapDraft {
    const sanitizedBranches = draft.branches
      .map((branch, index) =>
        this.sanitizeMindMapDraftNode(branch, 0, index, language),
      )
      .filter((branch): branch is MindMapDraftNode => Boolean(branch));

    if (sanitizedBranches.length > 0) {
      return {
        ...draft,
        title: this.normalizeText(draft.title) || documentTitle,
        branches: sanitizedBranches,
      };
    }

    throw new BadGatewayException(
      'Mind map generation returned no display-safe branches.',
    );
  }

  private sanitizeMindMapDraftNode(
    node: MindMapDraftNode,
    depth: number,
    index: number,
    language: SummaryLanguage,
  ): MindMapDraftNode | null {
    const isVietnamese = language === 'vi';
    const label = this.normalizeMindMapLabel(node.label);
    const summary = this.normalizeMindMapText(node.summary);
    const children = (node.children || [])
      .map((child, childIndex) =>
        this.sanitizeMindMapDraftNode(child, depth + 1, childIndex, language),
      )
      .filter((child): child is MindMapDraftNode => Boolean(child));

    if (this.isWeakMindMapDisplayLabel(label)) {
      if (children.length > 0 && depth > 0) {
        return null;
      }

      if (this.isTrivialMindMapSourceText(summary)) {
        return null;
      }

      const replacementLabel = this.buildSummaryBackedConceptLabel(
        summary,
        index,
        isVietnamese,
      );

      if (this.isWeakMindMapDisplayLabel(replacementLabel)) {
        return null;
      }

      return {
        label: replacementLabel,
        summary,
        children,
        ...(node.studyNote ? { studyNote: node.studyNote } : {}),
      };
    }

    return {
      label,
      summary,
      children,
      ...(node.studyNote ? { studyNote: node.studyNote } : {}),
    };
  }

  private isMindMapTreeDisplaySafe(node: MindMapNode, isRoot = true): boolean {
    const normalizedLabel = this.normalizeMindMapLabel(node.label);

    if (!normalizedLabel) {
      return false;
    }

    if (!isRoot && this.isWeakMindMapDisplayLabel(normalizedLabel)) {
      return false;
    }

    return (node.children || []).every((child) =>
      this.isMindMapTreeDisplaySafe(child, false),
    );
  }

  private isMindMapTreeStudyNoteReady(node: MindMapNode): boolean {
    const note = node.studyNote;

    if (
      !note ||
      !this.normalizeMindMapText(note.overview) ||
      !this.normalizeMindMapText(note.explanation) ||
      !this.normalizeMindMapText(note.studyFocus) ||
      !Array.isArray(note.keyPoints) ||
      note.keyPoints.filter((point) => this.normalizeMindMapText(point))
        .length === 0
    ) {
      return false;
    }

    return (node.children || []).every((child) =>
      this.isMindMapTreeStudyNoteReady(child),
    );
  }

  private isMindMapTreeStructurallyUseful(root: MindMapNode): boolean {
    const children = root.children || [];
    const totalChildNodes = this.countMindMapDisplayNodes(children);

    if (children.length === 0) {
      return false;
    }

    if (children.length === 1 && totalChildNodes < 3) {
      return false;
    }

    return true;
  }

  private countMindMapDisplayNodes(nodes: MindMapNode[]): number {
    return nodes.reduce(
      (total, node) =>
        total + 1 + this.countMindMapDisplayNodes(node.children || []),
      0,
    );
  }

  private isWeakMindMapDisplayLabel(label: string): boolean {
    const normalizedLabel = this.normalizeMindMapLabel(label);
    const matchLabel = this.normalizeMindMapForMatch(normalizedLabel);
    const wordCount = this.countMindMapWords(normalizedLabel);

    if (!normalizedLabel) {
      return true;
    }

    if (normalizedLabel.length <= 2 || wordCount === 1) {
      return true;
    }

    if (
      new Set([
        'va',
        'c',
        'la',
        'cua',
        've',
        'voi',
        'de',
        'tu',
        'mot',
        'cac',
        'nhung',
        'and',
        'or',
        'of',
        'the',
        'to',
        'for',
        'in',
      ]).has(matchLabel)
    ) {
      return true;
    }

    return this.isWeakOrRawMindMapLabel(normalizedLabel, normalizedLabel);
  }

  private isTrivialMindMapSourceText(value: string): boolean {
    const normalizedText = this.normalizeMindMapText(value);
    const normalizedLabel = this.normalizeMindMapLabel(normalizedText);
    const matchLabel = this.normalizeMindMapForMatch(normalizedLabel);
    const wordCount = this.countMindMapWords(normalizedLabel);

    if (!normalizedLabel) {
      return true;
    }

    if (normalizedLabel.length <= 2 || wordCount <= 1) {
      return true;
    }

    return new Set([
      'va',
      'c',
      'la',
      'cua',
      've',
      'voi',
      'de',
      'tu',
      'mot',
      'cac',
      'nhung',
      'and',
      'or',
      'of',
      'the',
      'to',
      'for',
      'in',
    ]).has(matchLabel);
  }

  private buildSourceDrivenMindMapDraft(
    documentTitle: string,
    chunks: MindMapSourceChunk[],
    language: SummaryLanguage,
  ): MindMapDraft {
    const isVietnamese = language === 'vi';
    const branches = this.buildSourceDrivenMindMapBranches(
      chunks,
      isVietnamese,
    );
    const prominentLabels = branches
      .map((branch) => this.normalizeMindMapLabel(branch.label))
      .filter(Boolean)
      .slice(0, 4);
    const summary = isVietnamese
      ? [
          `Sơ đồ tư duy này tổ chức tài liệu thành ${branches.length} cụm ý chính.`,
          prominentLabels.length > 0
            ? `Các nhánh nổi bật gồm ${prominentLabels.join(', ')}.`
            : 'Mỗi nhánh tổng hợp một cụm khái niệm, luận điểm hoặc ví dụ tiêu biểu.',
          'Mỗi nhánh được dựng từ các đoạn trích có mật độ thông tin cao để giữ ý nghĩa học tập rõ ràng.',
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

    const sectionGroups = new Map<string, MindMapSourceChunk[]>();

    for (const chunk of chunks) {
      const sectionTitle = this.normalizeMindMapLabel(chunk.sectionTitle);

      if (!this.isMeaningfulMindMapHeading(sectionTitle)) {
        continue;
      }

      const key = sectionTitle.toLowerCase();
      const group = sectionGroups.get(key) ?? [];
      group.push(chunk);
      sectionGroups.set(key, group);
    }

    if (sectionGroups.size >= 2 && sectionGroups.size <= 8) {
      return Array.from(sectionGroups.values()).filter(
        (group) => group.length > 0,
      );
    }

    const desiredGroupCount = Math.min(
      6,
      Math.max(
        chunks.length >= 12 ? 4 : 2,
        Math.round(Math.sqrt(chunks.length)),
      ),
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
      group.flatMap((chunk) =>
        this.extractMindMapSentences(chunk.chunkText, 3),
      ),
    );
    const combinedText = this.normalizeMindMapText(
      group.map((chunk) => chunk.chunkText).join(' '),
    );
    const sectionTitle =
      group
        .map((chunk) => this.normalizeMindMapLabel(chunk.sectionTitle))
        .find((title) => this.isMeaningfulMindMapHeading(title)) ?? '';
    const rawBranchSummary =
      sentences[0] ||
      combinedText ||
      (isVietnamese
        ? 'Nhánh này tổng hợp một cụm ý chính của tài liệu.'
        : 'This branch groups one major idea from the document.');
    const childSentences = sentences
      .slice(1)
      .filter((sentence) => sentence !== rawBranchSummary)
      .slice(0, 4);
    const children =
      childSentences.length > 0
        ? childSentences.map((sentence, index) =>
            this.buildSourceDrivenChildNode(sentence, index, isVietnamese),
          )
        : this.extractMindMapClauses(rawBranchSummary, 4).map((clause, index) =>
            this.buildSourceDrivenChildNode(clause, index, isVietnamese),
          );
    const fallbackLabel = this.deriveFallbackNodeLabel(
      rawBranchSummary,
      0,
      groupIndex,
      isVietnamese,
    );
    const label =
      this.deriveSourceDrivenLabel(
        sectionTitle || rawBranchSummary,
        combinedText,
        fallbackLabel,
      ) || fallbackLabel;

    return {
      label,
      summary: this.buildSourceDrivenNodeSummary(
        label,
        rawBranchSummary,
        isVietnamese,
      ),
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

    const label =
      this.deriveSourceDrivenLabel(
        normalizedSentence,
        normalizedSentence,
        fallbackLabel,
      ) || fallbackLabel;

    return {
      label,
      summary: this.buildSourceDrivenNodeSummary(
        label,
        normalizedSentence,
        isVietnamese,
      ),
      children: subClauses.map((clause, clauseIndex) => {
        const childFallbackLabel = this.deriveFallbackNodeLabel(
          clause,
          2,
          clauseIndex,
          isVietnamese,
        );
        const childLabel =
          this.deriveSourceDrivenLabel(clause, clause, childFallbackLabel) ||
          childFallbackLabel;

        return {
          label: childLabel,
          summary: this.buildSourceDrivenNodeSummary(
            childLabel,
            clause,
            isVietnamese,
          ),
          children: [],
        };
      }),
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

    if (sentences.length === 1 && sentences[0].length > 100) {
      const clauses = this.extractMindMapClauses(sentences[0], maxItems);

      if (clauses.length > 1) {
        return clauses;
      }
    }

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
        .split(
          /\s*(?:;|:|\n+|•|\s[-–]\s|,\s*(?=(?:bao gồm|gồm|gắn với|thể hiện|đòi hỏi|nhằm|trong đó|đồng thời|vì vậy|do đó|including|includes|because|therefore)\b)|\s+(?:bao gồm|gồm|gắn với|thể hiện|đòi hỏi|nhằm|trong đó|đồng thời|vì vậy|do đó|including|includes|because|therefore)\s+)\s*/i,
        )
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
      const candidateLabel = this.extractSemanticMindMapLabelSource(candidate);

      if (
        candidateLabel &&
        !this.isWeakOrRawMindMapLabel(candidateLabel, candidate)
      ) {
        return candidateLabel;
      }
    }

    const normalizedFallbackLabel = this.normalizeMindMapLabel(fallbackLabel);

    if (
      normalizedFallbackLabel &&
      !this.isWeakOrRawMindMapLabel(normalizedFallbackLabel, fallbackText)
    ) {
      return normalizedFallbackLabel;
    }

    return '';
  }

  private buildSourceDrivenNodeSummary(
    label: string,
    sourceText: string,
    isVietnamese: boolean,
  ): string {
    const semanticLabel = this.normalizeMindMapLabel(label);
    const sourceSummary = this.buildCompactMindMapEvidenceSummary(sourceText);

    if (!semanticLabel && !sourceSummary) {
      return isVietnamese
        ? 'Ý này cần được đọc trong mạch tài liệu để hiểu đúng vai trò của nó.'
        : 'This idea should be read in the document context.';
    }

    if (!semanticLabel) {
      return sourceSummary;
    }

    if (!sourceSummary) {
      return isVietnamese
        ? `${semanticLabel} cần được hiểu cùng các ý lân cận trong tài liệu.`
        : `${semanticLabel} should be understood together with its surrounding ideas in the document.`;
    }

    return isVietnamese
      ? `${semanticLabel}: ${sourceSummary}`
      : `${semanticLabel}: ${sourceSummary}`;
  }

  private buildCompactMindMapEvidenceSummary(value: string): string {
    const normalizedValue = this.normalizeMindMapText(value);

    if (!normalizedValue) {
      return '';
    }

    const candidates = this.dedupeMindMapDetails([
      ...this.extractMindMapSentences(normalizedValue, 2),
      ...this.extractMindMapClauses(normalizedValue, 2),
      normalizedValue,
    ]);
    const cleanSentence =
      candidates
        .map((candidate) => this.stripWeakMindMapLeadIn(candidate))
        .find((candidate) => candidate.length >= 18) ||
      this.stripWeakMindMapLeadIn(normalizedValue);

    return this.truncateMindMapSummary(cleanSentence, 220).replace(
      /\s*(?:\.\.\.|…)\s*$/,
      '',
    );
  }

  private extractSemanticMindMapLabelSource(value: string): string {
    const strippedValue = this.stripWeakMindMapLeadIn(value)
      .replace(/^(?:chapter|section|part|chuong|phan|muc)\s+\d+[\s:.-]*/i, '')
      .trim();
    const normalizedValue = this.normalizeMindMapText(strippedValue);

    if (!normalizedValue) {
      return '';
    }

    const prefixBeforeColon = normalizedValue.match(/^([^:]{6,80}):\s+/)?.[1];

    if (prefixBeforeColon) {
      const prefixLabel = this.toCompactMindMapConceptLabel(prefixBeforeColon);

      if (prefixLabel) {
        return prefixLabel;
      }
    }

    const firstSentence =
      normalizedValue.split(/(?:\.\s+|!\s+|\?\s+|\n+)/)[0] || normalizedValue;
    const conceptLabel = this.toCompactMindMapConceptLabel(firstSentence);

    if (conceptLabel) {
      return conceptLabel;
    }

    return this.toCompactMindMapConceptLabel(normalizedValue);
  }

  private toCompactMindMapConceptLabel(value: string): string {
    let candidate = this.normalizeMindMapLabel(value)
      .replace(
        /^(?:this node focuses on|this node highlights|this branch groups|this idea focuses on|y nay tap trung vao|y nay nhan manh|noi dung nay tap trung vao|nhanh nay tong hop)\s+/i,
        '',
      )
      .replace(/^(?:chapter|section|part|chuong|phan|muc)\s+\d+[\s:.-]*/i, '')
      .replace(/\s+(?:va cac y lien quan|and related ideas).*$/i, '')
      .trim();

    if (!candidate) {
      return '';
    }

    const colonSplit = candidate.match(/^([^:]{4,80}):\s+/)?.[1];
    if (colonSplit) {
      candidate = colonSplit;
    }

    const commaParts = candidate.split(/\s*,\s+/);
    if (commaParts.length > 1 && this.countMindMapWords(candidate) > 5) {
      candidate = commaParts[0];
    }

    const splitCandidate = candidate.split(
      /\s+(?:là|la|được hiểu là|duoc hieu la|bao gồm|bao gom|gồm|gom|được|duoc|nhằm|nham|thể hiện|the hien|trình bày|trinh bay|giải thích|giai thich|phân tích|phan tich|để|de|khi|trong khi|is|are|includes|include|describes|explains|shows|because|when|where)\s+/i,
    );
    candidate = splitCandidate[0] ?? candidate;
    candidate = this.trimDanglingMindMapLabelStart(
      this.normalizeMindMapLabel(candidate),
    );

    if (!candidate) {
      return '';
    }

    return this.compactMindMapLabelWords(candidate, 10);
  }

  private trimDanglingMindMapLabelStart(value: string): string {
    const weakStartWords = new Set([
      'and',
      'or',
      'of',
      'the',
      'to',
      'for',
      'in',
      'with',
      'becomes',
      'become',
      'from',
      'va',
      'hoac',
      'cua',
      'la',
      'duoc',
      'nham',
      'gom',
      'bao',
      'trong',
      'voi',
      'de',
      'nen',
      'qua',
      'tu',
      'thanh',
    ]);
    const words = this.normalizeMindMapLabel(value)
      .split(/\s+/)
      .filter(Boolean);

    while (
      words.length > 3 &&
      weakStartWords.has(this.normalizeMindMapForMatch(words[0]))
    ) {
      words.shift();
    }

    return this.normalizeMindMapLabel(words.join(' '));
  }

  private normalizeMindMapForMatch(value: string): string {
    return this.normalizeMindMapLabel(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase();
  }

  private compactMindMapLabelWords(value: string, maxWords: number): string {
    const normalizedValue = this.normalizeMindMapLabel(value);
    const words = normalizedValue.split(/\s+/).filter(Boolean);

    if (words.length <= maxWords) {
      return normalizedValue;
    }

    const preferredBreakWords = new Set([
      'and',
      'or',
      'of',
      'the',
      'a',
      'an',
      'to',
      'for',
      'in',
      'on',
      'with',
      'va',
      'hoac',
      'cua',
      'cho',
      'trong',
      'voi',
    ]);
    let endIndex = maxWords;

    for (
      let index = Math.min(words.length - 1, maxWords);
      index >= 4;
      index -= 1
    ) {
      if (!preferredBreakWords.has(words[index - 1].toLowerCase())) {
        endIndex = index;
        break;
      }
    }

    return this.normalizeMindMapLabel(words.slice(0, endIndex).join(' '));
  }

  private countMindMapWords(value: string): number {
    return this.normalizeMindMapLabel(value).split(/\s+/).filter(Boolean)
      .length;
  }

  private isRawChunkLikeMindMapText(value: string): boolean {
    const normalizedValue = this.normalizeMindMapText(value);

    if (!normalizedValue) {
      return false;
    }

    const wordCount = this.countMindMapWords(normalizedValue);

    if (normalizedValue.length > 220 || wordCount > 32) {
      return true;
    }

    if (/(?:\.\.\.|â€¦)$/.test(normalizedValue)) {
      return true;
    }

    if (
      /(?:\bchunk\s*\d+\b|\bsource\s*chunk\b|\bpage\s*\d+\b)/i.test(
        normalizedValue,
      )
    ) {
      return true;
    }

    return false;
  }

  private isWeakOrRawMindMapLabel(label: string, summary: string): boolean {
    const normalizedLabel = this.normalizeMindMapLabel(label);
    const wordCount = this.countMindMapWords(normalizedLabel);
    const matchLabel = this.normalizeMindMapForMatch(normalizedLabel);
    const wordsForMatch = matchLabel.split(/\s+/).filter(Boolean);
    const lastWord = wordsForMatch.at(-1) ?? '';

    if (this.shouldRegenerateMindMapLabel(normalizedLabel, summary)) {
      return true;
    }

    if (!normalizedLabel) {
      return true;
    }

    if (normalizedLabel.length > 72 || wordCount > 12) {
      return true;
    }

    if (wordCount === 1 && normalizedLabel.length < 8) {
      return true;
    }

    if (
      /^(?:day|this|that|it|no|noi dung|y nay|tap trung)\b/.test(matchLabel)
    ) {
      return true;
    }

    if (/\b(?:tap trung vao|focuses on|highlights)\b/.test(matchLabel)) {
      return true;
    }

    if (
      [
        'cua',
        've',
        'voi',
        'giua',
        'trong',
        'de',
        'la',
        'phai',
        'nhieu',
        'of',
        'about',
        'with',
        'between',
        'to',
        'for',
        'must',
        'should',
      ].includes(lastWord)
    ) {
      return true;
    }

    if (lastWord.length === 1 && wordCount > 1) {
      return true;
    }

    if (
      /[.!?]/.test(normalizedLabel) ||
      /(?:\.\.\.|â€¦)/.test(normalizedLabel)
    ) {
      return true;
    }

    if (normalizedLabel.includes(',') && wordCount > 5) {
      return true;
    }

    if (
      /^(?:this node|this branch|this idea|source|chunk|noi dung nay|y nay|nhanh nay)\b/i.test(
        normalizedLabel,
      )
    ) {
      return true;
    }

    return false;
  }

  private stripWeakMindMapLeadIn(value: string): string {
    let normalizedValue = this.normalizeMindMapText(value);
    const weakLeadInPattern =
      /^(trong giai doan nay|o giai doan nay|giai doan nay|noi dung nay|y nay|ve mat nay|doi voi|theo do|noi cach khac|dong thoi|mat khac|truoc het|tiep theo|in this phase|during this period|at this stage|this stage|this node|this idea|overall|moreover|however|first|next)\s*,?\s*/i;

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
    sourceProfile: MindMapSourceProfile,
  ): boolean {
    const branches = Array.isArray(draft.branches) ? draft.branches : [];
    const allNodes = this.collectMindMapDraftNodes(branches);
    const allLabels = allNodes.map((node) =>
      this.normalizeMindMapLabel(node.label).toLowerCase(),
    );
    const uniqueLabels = new Set(allLabels.filter(Boolean));
    const weakLabelCount = allNodes.filter((node) =>
      this.isWeakOrRawMindMapLabel(node.label, node.summary),
    ).length;
    if (branches.length < 1) {
      return false;
    }

    if (branches.length < sourceProfile.minTopLevelBranches) {
      return false;
    }

    if (allNodes.length < sourceProfile.minTotalNodes) {
      return false;
    }

    if (
      sourceProfile.requireNestedNode &&
      !branches.some((branch) => (branch.children || []).length > 0)
    ) {
      return false;
    }

    if (weakLabelCount > 0) {
      return false;
    }

    if (
      uniqueLabels.size < Math.ceil(allLabels.filter(Boolean).length * 0.75)
    ) {
      return false;
    }

    return true;
  }

  private describeMindMapAcceptanceIssues(
    draft: MindMapDraft,
    sourceProfile: MindMapSourceProfile,
    language: SummaryLanguage,
  ): string {
    const issues = [
      this.isMindMapDraftHighQuality(draft, sourceProfile)
        ? ''
        : this.describeMindMapQualityIssues(draft, sourceProfile),
      this.describeMindMapLanguageIssue(draft, language),
    ].filter(Boolean);

    return issues.join(' ');
  }

  private describeMindMapLanguageIssue(
    draft: MindMapDraft,
    language: SummaryLanguage,
  ): string {
    if (language !== 'en') {
      return '';
    }

    const draftText = [
      draft.title,
      draft.summary,
      ...this.collectMindMapDraftNodes(draft.branches || []).flatMap((node) => [
        node.label,
        node.summary,
        node.studyNote?.overview ?? '',
        node.studyNote?.explanation ?? '',
        node.studyNote?.studyFocus ?? '',
        ...(node.studyNote?.keyPoints ?? []),
      ]),
    ].join(' ');

    return this.hasVietnameseLanguageSignals(draftText)
      ? 'The requested output language is English, but the draft contains Vietnamese text. Rewrite every title, label, summary, and study note in English while staying grounded in the context.'
      : '';
  }

  private hasVietnameseLanguageSignals(value: string): boolean {
    const normalizedValue = this.normalizeText(value).toLowerCase();
    const vietnameseDiacritics =
      normalizedValue.match(/[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/gi)
        ?.length ?? 0;
    const vietnameseWords =
      normalizedValue.match(
        /\b(?:và|của|là|trong|những|các|được|không|người|với|cho|một|này|đó|khi|nên|cần|tài liệu)\b/gi,
      )?.length ?? 0;
    const mojibakeSignals = this.countMojibakeSignals(normalizedValue);

    return (
      vietnameseDiacritics >= 8 ||
      vietnameseWords >= 4 ||
      mojibakeSignals >= 4
    );
  }

  private hasMojibakeSignals(value: string): boolean {
    return hasMojibakeText(value);
  }

  private countMojibakeSignals(value: string): number {
    return countMojibakeSignals(this.normalizeText(value));
  }

  private describeMindMapQualityIssues(
    draft: MindMapDraft,
    sourceProfile: MindMapSourceProfile,
  ): string {
    const branches = Array.isArray(draft.branches) ? draft.branches : [];
    const allNodes = this.collectMindMapDraftNodes(branches);
    const allLabels = allNodes.map((node) =>
      this.normalizeMindMapLabel(node.label),
    );
    const weakLabels = allNodes
      .filter((node) => this.isWeakOrRawMindMapLabel(node.label, node.summary))
      .map((node) => this.normalizeMindMapLabel(node.label))
      .filter(Boolean)
      .slice(0, 5);
    const uniqueLabelCount = new Set(
      allLabels.map((label) => label.toLowerCase()).filter(Boolean),
    ).size;
    const issues: string[] = [];

    if (branches.length < 1) {
      issues.push('No top-level branches were generated.');
    }

    if (branches.length < sourceProfile.minTopLevelBranches) {
      issues.push(
        `The source context is broad enough for at least ${sourceProfile.minTopLevelBranches} natural top-level branches, but only ${branches.length} were generated.`,
      );
    }

    if (allNodes.length < sourceProfile.minTotalNodes) {
      issues.push(
        `The mind map is too shallow for the available context (${sourceProfile.sourceWordCount} source words across ${sourceProfile.meaningfulChunkCount} meaningful chunks). Expand grounded ideas into more study nodes without inventing content.`,
      );
    }

    if (
      sourceProfile.requireNestedNode &&
      !branches.some((branch) => (branch.children || []).length > 0)
    ) {
      issues.push(
        'The source has multiple grounded ideas, but the map has no nested child nodes. Add children only where the context supports sub-ideas.',
      );
    }

    if (weakLabels.length > 0) {
      issues.push(
        `Weak or raw labels detected: ${weakLabels.join(', ')}. Rewrite them as short concept titles.`,
      );
    }

    if (uniqueLabelCount < Math.ceil(allLabels.filter(Boolean).length * 0.75)) {
      issues.push(
        'Too many duplicate or near-empty labels; make each node distinct.',
      );
    }

    return issues.length > 0
      ? issues.join(' ')
      : 'Mind map generation returned raw, shallow, or weak node labels.';
  }

  private stringifyMindMapDraftForRepair(draft: MindMapDraft | null): string {
    if (!draft) {
      return '{}';
    }

    const json = JSON.stringify(draft, null, 2);

    return json.length > 6000 ? `${json.slice(0, 6000)}\n...` : json;
  }

  private collectMindMapDraftNodes(
    nodes: MindMapDraftNode[],
  ): MindMapDraftNode[] {
    return nodes.flatMap((node) => [
      node,
      ...this.collectMindMapDraftNodes(node.children || []),
    ]);
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
    const studyNote =
      this.coerceMindMapNodeStudyNoteDraft(
        candidate.studyNote ?? candidate.study_note ?? candidate.note,
      ) ??
      (typeof candidate.explanation === 'string' ||
      typeof candidate.studyFocus === 'string' ||
      typeof candidate.study_focus === 'string' ||
      Array.isArray(candidate.keyPoints) ||
      Array.isArray(candidate.key_points)
        ? this.coerceMindMapNodeStudyNoteDraft(candidate)
        : null);

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
      ...(studyNote ? { studyNote } : {}),
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
        ? 'Sơ đồ tư duy này phản ánh phần nội dung đã được trích xuất từ tài liệu.'
        : 'This mind map reflects the document content that was successfully extracted.');
    const normalizedBranches = this.normalizeMindMapNodes(
      rawBranches,
      fallbackSummary,
      isVietnamese,
      0,
    );

    return {
      title: this.normalizeText(draft.title) || documentTitle,
      summary: fallbackSummary,
      branches: normalizedBranches,
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
            ? 'Nhánh này tóm lược một ý chính của tài liệu.'
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
        const initialSummary = this.resolveMindMapNodeSummary(
          normalizedLabel,
          baseSummary || normalizedChildren[0]?.summary || parentSummary,
          parentSummary,
          normalizedChildren[0]?.summary,
          isVietnamese,
        );
        const fallbackLabel = this.deriveFallbackNodeLabel(
          initialSummary,
          depth,
          index,
          isVietnamese,
        );
        const resolvedLabel =
          normalizedLabel &&
          !this.isWeakOrRawMindMapLabel(normalizedLabel, initialSummary)
            ? normalizedLabel
            : this.deriveSourceDrivenLabel(
                normalizedLabel,
                initialSummary || parentSummary,
                fallbackLabel,
              ) || fallbackLabel;
        const resolvedSummary = this.isRawChunkLikeMindMapText(initialSummary)
          ? this.buildSourceDrivenNodeSummary(
              resolvedLabel,
              initialSummary,
              isVietnamese,
            )
          : initialSummary;
        const studyNote = this.normalizeMindMapNodeStudyNoteDraft(
          node.studyNote ??
            this.buildStoredNodeStudyNoteDraft(
              resolvedLabel,
              resolvedSummary,
              normalizedChildren,
              isVietnamese,
            ),
          resolvedLabel,
          resolvedSummary,
          isVietnamese ? 'vi' : 'en',
        );

        return {
          label: resolvedLabel,
          summary: resolvedSummary,
          children: normalizedChildren,
          studyNote,
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

    const generatedChildren = detailCandidates.map((detail, index) => {
      const label = this.deriveFallbackNodeLabel(
        detail,
        depth + 1,
        index,
        isVietnamese,
      );

      return {
        label,
        summary: this.buildSourceDrivenNodeSummary(
          label,
          detail || normalizedSummary,
          isVietnamese,
        ),
        children: [],
      };
    });

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
        ? 'Ý này cần được đọc trong mạch nội dung của tài liệu.'
        : 'This idea should be read in the document context.';
    }

    if (!normalizedContext) {
      return isVietnamese
        ? `Ý này tập trung vào ${normalizedLabel}.`
        : `This node focuses on ${normalizedLabel}.`;
    }

    if (!normalizedLabel) {
      return normalizedContext;
    }

    return isVietnamese
      ? `Ý này nhấn mạnh ${normalizedLabel}. Trong tài liệu, nội dung này được đặt trong bối cảnh: ${normalizedContext}`
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
      return isVietnamese ? `Nhánh ${index + 1}` : `Branch ${index + 1}`;
    }

    if (depth === 1) {
      return isVietnamese ? `Mục ${index + 1}` : `Section ${index + 1}`;
    }

    return isVietnamese ? `Chi tiết ${index + 1}` : `Detail ${index + 1}`;
  }

  private createDraftLeafFromText(value: string): MindMapDraftNode {
    const normalizedValue = this.normalizeMindMapText(value);

    return {
      label: this.buildMindMapDetailLabel(normalizedValue),
      summary: normalizedValue,
      children: [],
    };
  }

  private buildMindMapFromDraft(
    draft: MindMapDraft,
    language: SummaryLanguage,
  ): MindMapNode {
    const children = draft.branches.map((branch, index) =>
      this.buildMindMapTreeNode(branch, `branch-${index + 1}`, 1, language),
    );
    const label = this.truncateMindMapLabel(draft.title, 72, 14);
    const summary = this.truncateMindMapSummary(draft.summary, 420);

    return this.createMindMapNode(
      'root',
      label,
      summary,
      'root',
      children,
      this.normalizeMindMapNodeStudyNoteDraft(
        this.buildStoredNodeStudyNoteDraft(
          label,
          summary,
          draft.branches,
          language === 'vi',
        ),
        label,
        summary,
        language,
      ),
    );
  }

  private buildMindMapTreeNode(
    node: MindMapDraftNode,
    id: string,
    depth: number,
    language: SummaryLanguage,
  ): MindMapNode {
    const children = node.children.map((child, index) =>
      this.buildMindMapTreeNode(
        child,
        `${id}-${index + 1}`,
        depth + 1,
        language,
      ),
    );
    const label = this.truncateMindMapLabel(
      node.label,
      depth === 1 ? 64 : 58,
      depth === 1 ? 12 : 10,
    );
    const summary = this.truncateMindMapSummary(
      node.summary,
      depth === 1 ? 320 : 260,
    );

    return this.createMindMapNode(
      id,
      label,
      summary,
      this.resolveMindMapNodeKind(depth),
      children,
      this.normalizeMindMapNodeStudyNoteDraft(
        node.studyNote ??
          this.buildStoredNodeStudyNoteDraft(
            label,
            summary,
            node.children,
            language === 'vi',
          ),
        label,
        summary,
        language,
      ),
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
    const branchHeader =
      language === 'vi' ? 'Các nhánh chính:' : 'Map branches:';
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
    studyNote?: MindMapNode['studyNote'],
  ): MindMapNode {
    return {
      id,
      label,
      summary,
      kind,
      children,
      ...(studyNote ? { studyNote } : {}),
    };
  }

  private buildMindMapInsightLabel(point: string): string {
    const labelSource = this.extractSemanticMindMapLabelSource(point);

    return this.truncateMindMapLabel(labelSource, 58);
  }

  private buildMindMapDetailLabel(value: string): string {
    const labelSource = this.extractSemanticMindMapLabelSource(value);

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

  private truncateMindMapLabel(
    value: string,
    maxLength = 44,
    maxWords = 12,
  ): string {
    const normalizedValue = this.compactMindMapLabelWords(value, maxWords);

    if (normalizedValue.length <= maxLength) {
      return normalizedValue;
    }

    const roughSlice = normalizedValue.slice(0, maxLength).trimEnd();
    const lastWordBoundary = roughSlice.lastIndexOf(' ');
    const safeSlice =
      lastWordBoundary > Math.floor(maxLength / 2)
        ? roughSlice.slice(0, lastWordBoundary)
        : roughSlice;

    return this.normalizeMindMapLabel(safeSlice);
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
    return repairMojibakeText(value).replace(/\s+/g, ' ').trim();
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
      .replace(/^[,;:.()[\]\-–]+\s*/, '')
      .replace(/\s*[,;:.()[\]\-–]+$/, '')
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

  private toErrorStack(error: unknown): string | undefined {
    if (error instanceof Error) {
      return error.stack;
    }

    return undefined;
  }

  private toMindMapGenerationException(
    error: unknown,
  ): BadGatewayException | ServiceUnavailableException {
    if (error instanceof ServiceUnavailableException) {
      return error;
    }

    if (error instanceof BadGatewayException) {
      return error;
    }

    const normalizedMessage = this.toErrorMessage(error).toLowerCase();

    if (
      normalizedMessage.includes('resource_exhausted') ||
      normalizedMessage.includes('quota exceeded') ||
      normalizedMessage.includes('429 too many requests')
    ) {
      return new ServiceUnavailableException(
        'Gemini API quota is exhausted. Please update the API key or billing/quota configuration, then try generating the mind map again.',
      );
    }

    if (
      normalizedMessage.includes('503') ||
      normalizedMessage.includes('service unavailable') ||
      normalizedMessage.includes('temporarily unavailable') ||
      normalizedMessage.includes('unavailable') ||
      normalizedMessage.includes('high demand') ||
      normalizedMessage.includes('overloaded') ||
      normalizedMessage.includes('try again later')
    ) {
      return new ServiceUnavailableException(
        'Gemini model is temporarily unavailable or under high demand. Please wait a bit and try generating the mind map again.',
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

    if (
      normalizedMessage.includes('too shallow') ||
      normalizedMessage.includes('top-level branches') ||
      normalizedMessage.includes('weak or raw labels') ||
      normalizedMessage.includes('no nested child nodes')
    ) {
      return new BadGatewayException(
        'Mind map generation returned a weak outline. Please regenerate with a clearer instruction or try again after the model fallback is available.',
      );
    }

    return new BadGatewayException(
      'Mind map generation failed. Please try again in a moment.',
    );
  }
}
