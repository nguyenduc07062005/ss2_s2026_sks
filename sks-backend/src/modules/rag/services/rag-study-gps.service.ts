import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';
import { StudyGpsDayChatMessage as StudyGpsDayChatMessageEntity } from 'src/database/entities/study-gps-day-chat-message.entity';
import { StudyGpsPlan } from 'src/database/entities/study-gps-plan.entity';
import { StudyGpsDayChatMessageRepository } from 'src/database/repositories/study-gps-day-chat-message.repository';
import { StudyGpsPlanRepository } from 'src/database/repositories/study-gps-plan.repository';
import { UserDocumentRepository } from 'src/database/repositories/user-document.repository';
import {
  StudyGpsDailyRouteDay,
  StudyGpsDayChatHistoryItem,
  StudyGpsDayChatMessage,
  StudyGpsDayChatResponse,
  StudyGpsDocumentRef,
  StudyGpsGoal,
  StudyGpsLevel,
  StudyGpsPlanContent,
  StudyGpsPlanResponse,
  SummaryLanguage,
} from '../types/rag.types';
import { GenerateStudyGpsDayChatDto } from '../dtos/generate-study-gps-day-chat.dto';
import { GenerateStudyGpsDto } from '../dtos/generate-study-gps.dto';
import { parseJsonWithRepair } from '../utils/llm-json';
import { RagDocumentContextService } from './rag-document-context.service';
import { RagIndexingService } from './rag-indexing.service';
import { RagQuestionAnsweringService } from './rag-question-answering.service';
import { RagStructuredGenerationService } from './rag-structured-generation.service';

const STUDY_GPS_CHUNKS_PER_DOCUMENT = 7;
const STUDY_GPS_CONTEXT_SNIPPET_LENGTH = 900;
const RECENT_STUDY_GPS_DAY_CHAT_MESSAGES = 10;
const MAX_STUDY_GPS_DAY_CHAT_MESSAGES = 40;

const STUDY_GPS_PROMPT = [
  'You are SKS Study GPS, an academic learning-route assistant.',
  'Your job is to turn selected uploaded documents into a day-by-day study roadmap.',
  'Use ONLY the provided document context. Do not invent facts, chapters, deadlines, or concepts that are not grounded in the selected documents.',
  'Do not create a generic calendar. Create a practical roadmap with one card per study day.',
  'Write all text in {languageName}.',
  'If the language is Vietnamese, write natural Vietnamese with full diacritics. Never write unaccented Vietnamese.',
  'Write for a student, not a developer. Never mention internal retrieval terms such as chunk, vector, embedding, raw context, source chunk, or document id.',
  'Use learner-facing wording: topic, concept, section, review block, practice task, weak area.',
  'Never tell the learner to read "Study part", "selected section", "source chunk", "chunk", "reference", or numbered excerpts. Convert document context into meaningful concepts and complete learning tasks.',
  'Task wording must name the concept to study, not the retrieval location.',
  'Keep every daily goal and task short enough to fit in a UI roadmap card.',
  '',
  'Learner profile:',
  '- Goal: {goalLabel}',
  '- Current level: {levelLabel}',
  '- Days left: {daysLeft}',
  '- Hours per day: {hoursPerDay}',
  '',
  'Planning rules:',
  '- Prioritize prerequisite, foundational, or high-yield material first.',
  '- Adapt depth to the learner level. A weak learner needs more foundation and recall. A good learner can move faster into synthesis and practice.',
  '- For exam goal, emphasize recall, key concepts, likely connections, and review blocks.',
  '- For presentation goal, emphasize story flow, key claims, examples, and speaking preparation.',
  '- For understand lesson goal, emphasize conceptual order, definitions, mechanisms, and checkpoints.',
  '- Keep the route realistic for the available time.',
  '- Create exactly {daysLeft} dailyRoute items, numbered from 1 to {daysLeft}.',
  '- Explain briefly why each step matters.',
  '- Keep tasks content-focused. Name the concept, argument, relation, or practice target for the day.',
  '- Avoid generic study-method tasks such as read carefully, summarize into a notebook, ask yourself a question, check your understanding, or spend time studying.',
  '- Do not write Vietnamese task patterns that only tell the learner to read materials, copy definitions into notes, or invent self-check questions.',
  '',
  'Selected document context:',
  '{context}',
].join('\n');

const STUDY_GPS_JSON_FALLBACK_PROMPT = [
  'You are SKS Study GPS, an academic learning-route assistant.',
  'Use ONLY the selected document context. Return ONLY valid JSON.',
  'Write all text in {languageName}.',
  'If the language is Vietnamese, write natural Vietnamese with full diacritics. Never write unaccented Vietnamese.',
  'Write for a student. Never mention chunk, vector, embedding, raw context, source chunk, or document id in user-facing text.',
  'Use topic/section/concept/task language instead of retrieval-system language.',
  'Never write "Study part", "selected section", "source chunk", "chunk", "reference", or numbered excerpt in user-facing text.',
  'Name the concept or action directly instead of pointing to a retrieved part.',
  'Avoid generic study-method tasks such as read carefully, summarize into a notebook, ask yourself a question, check your understanding, or spend time studying.',
  'Do not write Vietnamese task patterns that only tell the learner to read materials, copy definitions into notes, or invent self-check questions.',
  '',
  'Learner profile:',
  '- Goal: {goalLabel}',
  '- Current level: {levelLabel}',
  '- Days left: {daysLeft}',
  '- Hours per day: {hoursPerDay}',
  '- Create exactly {daysLeft} days in dailyRoute.',
  '',
  'Return JSON using this exact structure:',
  '{{',
  '  "dailyRoute": [',
  '    {{',
  '      "day": 1,',
  '      "goal": "daily learning goal",',
  '      "tasks": ["actionable learning task 1", "actionable learning task 2"]',
  '    }}',
  '  ]',
  '}}',
  '',
  'Selected document context:',
  '{context}',
].join('\n');

const STUDY_GPS_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    dailyRoute: {
      type: 'array',
      minItems: 1,
      maxItems: 30,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          day: { type: 'number' },
          goal: { type: 'string' },
          tasks: {
            type: 'array',
            minItems: 1,
            maxItems: 6,
            items: { type: 'string' },
          },
        },
        required: ['day', 'goal', 'tasks'],
      },
    },
  },
  required: ['dailyRoute'],
} as const;

type StudyGpsSourceChunk = {
  chunkIndex: number;
  chunkText: string;
  pageNumber: number | null;
  sectionTitle: string | null;
};

type StudyGpsSourceDocument = StudyGpsDocumentRef & {
  chunks: StudyGpsSourceChunk[];
};

@Injectable()
export class RagStudyGpsService {
  private readonly logger = new Logger(RagStudyGpsService.name);
  private readonly studyGpsPrompt =
    PromptTemplate.fromTemplate(STUDY_GPS_PROMPT);
  private readonly studyGpsFallbackPrompt = PromptTemplate.fromTemplate(
    STUDY_GPS_JSON_FALLBACK_PROMPT,
  );

  constructor(
    private readonly ragIndexingService: RagIndexingService,
    private readonly ragDocumentContextService: RagDocumentContextService,
    private readonly ragQuestionAnsweringService: RagQuestionAnsweringService,
    private readonly ragStructuredGenerationService: RagStructuredGenerationService,
    private readonly userDocumentRepository: UserDocumentRepository,
    private readonly studyGpsPlanRepository: StudyGpsPlanRepository,
    private readonly studyGpsDayChatMessageRepository: StudyGpsDayChatMessageRepository,
  ) {}

  async getActivePlan(ownerId: string): Promise<StudyGpsPlanResponse | null> {
    const activePlan = await this.studyGpsPlanRepository.findByUserId(ownerId);
    return activePlan ? this.toPlanResponse(activePlan) : null;
  }

  async clearActivePlan(ownerId: string): Promise<boolean> {
    return this.studyGpsPlanRepository.clearByUserId(ownerId);
  }

  async generateStudyGpsPlan(
    ownerId: string,
    dto: GenerateStudyGpsDto,
  ): Promise<StudyGpsPlanResponse> {
    const documentIds = this.normalizeDocumentIds(dto.documentIds);
    const sourceDocuments = await this.loadSourceDocuments(
      ownerId,
      documentIds,
    );
    const language = dto.language ?? 'en';
    const input = {
      goalLabel: this.getGoalLabel(dto.goal),
      levelLabel: this.getLevelLabel(dto.level),
      daysLeft: String(dto.daysLeft),
      hoursPerDay: String(dto.hoursPerDay),
      languageName: this.getLanguageName(language),
      context: this.buildStudyGpsContext(sourceDocuments),
    };
    let plan: StudyGpsPlanContent;

    try {
      const generatedPlan = await this.ragStructuredGenerationService.generate({
        input,
        prompt: this.studyGpsPrompt,
        fallbackPrompt: this.studyGpsFallbackPrompt,
        outputSchema: STUDY_GPS_OUTPUT_SCHEMA,
        schemaName: 'study_gps_plan',
        operationLabel: 'Study GPS generation',
        modelOptions: {
          temperature: 0.25,
          maxOutputTokens: 3000,
          topP: 0.9,
        },
        coerce: (value) => this.coerceStudyGpsPlan(value),
        parseRawResponse: (rawResponse) =>
          this.parseRawStudyGpsPlan(rawResponse),
        logger: this.logger,
      });
      plan = this.normalizeStudyGpsPlan(generatedPlan, sourceDocuments, dto);
    } catch (generationError) {
      this.logger.warn(
        `Study GPS generation used deterministic fallback: ${this.toErrorMessage(
          generationError,
        )}`,
      );
      plan = this.buildFallbackStudyGpsPlan(sourceDocuments, dto);
    }

    const savedPlan = await this.studyGpsPlanRepository.saveActivePlan(
      ownerId,
      {
        goal: dto.goal,
        level: dto.level,
        language,
        daysLeft: dto.daysLeft,
        hoursPerDay: dto.hoursPerDay,
        documents: sourceDocuments.map(({ id, title }) => ({ id, title })),
        plan,
        generatedAt: new Date(),
      },
    );

    return this.toPlanResponse(savedPlan);
  }

  async generateStudyGpsDayChat(
    ownerId: string,
    dto: GenerateStudyGpsDayChatDto,
  ): Promise<StudyGpsDayChatResponse> {
    const context = await this.resolveStudyGpsDayChatContext(
      ownerId,
      dto.day,
    );
    const previousMessages =
      await this.studyGpsDayChatMessageRepository.findRecentByPlanAndDay(
        ownerId,
        context.activePlan.id,
        dto.day,
        RECENT_STUDY_GPS_DAY_CHAT_MESSAGES,
      );
    const answer = await this.ragQuestionAnsweringService.answerStudyGpsDay(
      ownerId,
      dto.message,
      {
        documentIds: context.documentIds,
        scopeLabel: `Study GPS Day ${dto.day}`,
        studyContext: context.studyContext,
        recentMessages: this.toConversationTurns(previousMessages),
      },
    );
    const userMessage =
      await this.studyGpsDayChatMessageRepository.createMessage({
        userId: ownerId,
        planId: context.activePlan.id,
        day: dto.day,
        role: 'user',
        content: dto.message.trim(),
      });
    const assistantMessage =
      await this.studyGpsDayChatMessageRepository.createMessage({
        userId: ownerId,
        planId: context.activePlan.id,
        day: dto.day,
        role: 'assistant',
        content: answer.answer,
        sources: answer.sources,
      });

    await this.trimStudyGpsDayChatHistory(
      ownerId,
      context.activePlan.id,
      dto.day,
    );

    return {
      day: dto.day,
      goal: context.dayGoal,
      tasks: context.dayTasks,
      items: [
        this.toDayChatHistoryItem(userMessage),
        this.toDayChatHistoryItem(assistantMessage),
      ],
    };
  }

  async startStudyGpsDayChat(
    ownerId: string,
    day: number,
  ): Promise<StudyGpsDayChatResponse> {
    const context = await this.resolveStudyGpsDayChatContext(ownerId, day);
    const existingMessages =
      await this.studyGpsDayChatMessageRepository.findByPlanAndDay(
        ownerId,
        context.activePlan.id,
        day,
      );

    if (existingMessages.length > 0) {
      return {
        day,
        goal: context.dayGoal,
        tasks: context.dayTasks,
        items: existingMessages.map((message) =>
          this.toDayChatHistoryItem(message),
        ),
      };
    }

    const openingQuestion = [
      'Start this Study GPS day chat.',
      'Write the first assistant message in English.',
      'Mention today\'s focus naturally and invite the learner to send the first topic, question, or confusing point.',
      'Do not reuse the old fixed opener that lists review, explanation, practice, and outline options.',
      'Do not list generic options. Keep it short and conversational.',
    ].join(' ');
    const answer = await this.ragQuestionAnsweringService.answerStudyGpsDay(
      ownerId,
      openingQuestion,
      {
        documentIds: context.documentIds,
        scopeLabel: `Study GPS Day ${day}`,
        studyContext: context.studyContext,
        recentMessages: [],
      },
    );
    const assistantMessage =
      await this.studyGpsDayChatMessageRepository.createMessage({
        userId: ownerId,
        planId: context.activePlan.id,
        day,
        role: 'assistant',
        content: answer.answer,
        sources: answer.sources,
      });

    return {
      day,
      goal: context.dayGoal,
      tasks: context.dayTasks,
      items: [this.toDayChatHistoryItem(assistantMessage)],
    };
  }

  async getStudyGpsDayChatHistory(
    ownerId: string,
    day: number,
  ): Promise<StudyGpsDayChatResponse> {
    const context = await this.resolveStudyGpsDayChatContext(ownerId, day);
    await this.trimStudyGpsDayChatHistory(ownerId, context.activePlan.id, day);
    const messages =
      await this.studyGpsDayChatMessageRepository.findByPlanAndDay(
        ownerId,
        context.activePlan.id,
        day,
      );

    return {
      day,
      goal: context.dayGoal,
      tasks: context.dayTasks,
      items: messages.map((message) => this.toDayChatHistoryItem(message)),
    };
  }

  async clearStudyGpsDayChatHistory(
    ownerId: string,
    day: number,
  ): Promise<number> {
    const context = await this.resolveStudyGpsDayChatContext(ownerId, day);

    return this.studyGpsDayChatMessageRepository.clearByPlanAndDay(
      ownerId,
      context.activePlan.id,
      day,
    );
  }

  private async resolveStudyGpsDayChatContext(
    ownerId: string,
    day: number,
  ): Promise<{
    activePlan: StudyGpsPlan;
    dayGoal: string;
    dayTasks: string[];
    documentIds: string[];
    studyContext: string;
  }> {
    const activePlan = await this.studyGpsPlanRepository.findByUserId(ownerId);

    if (!activePlan) {
      throw new BadRequestException('Generate a Study GPS route first.');
    }

    const dailyRoute = this.coerceArray(activePlan.plan?.dailyRoute)
      .map((item) => this.coerceDailyRouteDay(item))
      .filter((item): item is StudyGpsDailyRouteDay => Boolean(item));
    const routeDay = dailyRoute.find((item) => item.day === day);

    if (!routeDay) {
      throw new BadRequestException(
        `Day ${day} is not available in the active Study GPS route.`,
      );
    }

    const dayGoal = this.normalizePlanText(routeDay.goal) || `Day ${day}`;
    const dayTasks = this.normalizeStringArray(routeDay.tasks, [], 8).filter(
      (task) => !this.isGenericStudyTask(task),
    );
    const documentIds = activePlan.documents.map((document) => document.id);
    const studyContext = this.buildStudyGpsDayChatContext({
      day,
      dayGoal,
      dayTasks,
      language: activePlan.language,
      goal: activePlan.goal,
      level: activePlan.level,
      hoursPerDay: activePlan.hoursPerDay,
    });

    return {
      activePlan,
      dayGoal,
      dayTasks,
      documentIds,
      studyContext,
    };
  }

  private toConversationTurns(
    messages: StudyGpsDayChatMessageEntity[],
  ): StudyGpsDayChatMessage[] {
    return [...messages]
      .reverse()
      .map((message) => ({
        role: message.role,
        content: message.content,
      }))
      .filter((message) => message.content.trim());
  }

  private toDayChatHistoryItem(
    message: StudyGpsDayChatMessageEntity,
  ): StudyGpsDayChatHistoryItem {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      sources: message.sources ?? [],
      createdAt: message.createdAt.toISOString(),
    };
  }

  private async trimStudyGpsDayChatHistory(
    ownerId: string,
    planId: string,
    day: number,
  ): Promise<void> {
    try {
      await this.studyGpsDayChatMessageRepository.trimToLatestByPlanAndDay(
        ownerId,
        planId,
        day,
        MAX_STUDY_GPS_DAY_CHAT_MESSAGES,
      );
    } catch (error) {
      this.logger.warn(
        `Study GPS day chat trim failed for day ${day}: ${this.toErrorMessage(
          error,
        )}`,
      );
    }
  }

  private normalizeDocumentIds(documentIds: string[]): string[] {
    const normalizedDocumentIds = [...new Set(documentIds.filter(Boolean))];

    if (normalizedDocumentIds.length === 0) {
      throw new BadRequestException('Select at least one document.');
    }

    return normalizedDocumentIds;
  }

  private async loadSourceDocuments(
    ownerId: string,
    documentIds: string[],
    maxChunks = STUDY_GPS_CHUNKS_PER_DOCUMENT,
  ): Promise<StudyGpsSourceDocument[]> {
    const sourceDocuments: StudyGpsSourceDocument[] = [];

    for (const documentId of documentIds) {
      const userDocument =
        await this.userDocumentRepository.findByUserAndDocument(
          ownerId,
          documentId,
        );

      if (!userDocument?.document) {
        throw new NotFoundException('Document not found or not owned by user');
      }

      await this.ragIndexingService.ensureDocumentIndexed(documentId);

      const chunks =
        await this.ragDocumentContextService.getRepresentativeChunks(
          documentId,
          maxChunks,
        );

      if (chunks.length === 0) {
        throw new BadRequestException(
          `Document "${userDocument.documentName || userDocument.document.title}" has no indexed content for Study GPS.`,
        );
      }

      sourceDocuments.push({
        id: documentId,
        title:
          this.normalizeText(userDocument.documentName) ||
          this.normalizeText(userDocument.document.title) ||
          'Untitled document',
        chunks,
      });
    }

    return sourceDocuments;
  }

  private buildStudyGpsContext(documents: StudyGpsSourceDocument[]): string {
    return documents
      .map((document, documentIndex) => {
        const chunkContext = document.chunks
          .map((chunk, chunkIndex) => {
            const location = [
              `Excerpt ${chunkIndex + 1}`,
              chunk.pageNumber ? `Page ${chunk.pageNumber}` : null,
              chunk.sectionTitle ? `Section ${chunk.sectionTitle}` : null,
            ]
              .filter(Boolean)
              .join(' | ');

            return `[${location}]\n${this.truncateText(
              chunk.chunkText,
              STUDY_GPS_CONTEXT_SNIPPET_LENGTH,
            )}`;
          })
          .join('\n\n');

        return [
          `Document ${documentIndex + 1}`,
          `Document ID: ${document.id}`,
          `Title: ${document.title}`,
          chunkContext,
        ].join('\n');
      })
      .join('\n\n---\n\n');
  }

  private buildStudyGpsDayChatContext(options: {
    day: number;
    dayGoal: string;
    dayTasks: string[];
    language: SummaryLanguage;
    goal: StudyGpsGoal;
    level: StudyGpsLevel;
    hoursPerDay: number;
  }): string {
    return [
      'You are helping the learner inside Study GPS day chat.',
      'This is not a fixed generated lesson. Respond to the learner message and guide the session conversationally.',
      'Use the selected documents when they are relevant. If the retrieved document context is weak, say so naturally and ask what part the learner wants to clarify.',
      'Do not mention internal retrieval terms such as chunk, vector, embedding, raw context, source chunk, or document id.',
      'For the first assistant opener, write in English.',
      'For learner messages, reply in the same language as the learner message.',
      '',
      'Study GPS route context:',
      `- Day: ${options.day}`,
      `- Day goal: ${options.dayGoal}`,
      `- Roadmap tasks: ${options.dayTasks.join('; ') || 'No tasks listed'}`,
      `- Overall goal: ${this.getGoalLabel(options.goal)}`,
      `- Current level: ${this.getLevelLabel(options.level)}`,
      `- Planned time today: ${options.hoursPerDay} hour(s)`,
      '',
      'Answer style:',
      '- Start from the learner message, not from a prewritten day detail.',
      '- Explain concepts clearly when the learner asks for knowledge.',
      '- Avoid generic study-method advice unless the learner asks how to study.',
      '- Keep the answer useful for studying today.',
    ].join('\n');
  }

  private parseRawStudyGpsPlan(rawResponse: string): StudyGpsPlanContent {
    const parsed = parseJsonWithRepair<unknown>(rawResponse);
    const plan = this.coerceStudyGpsPlan(parsed);

    if (!plan) {
      throw new Error('Study GPS generation returned an empty JSON payload.');
    }

    return plan;
  }

  private coerceStudyGpsPlan(value: unknown): StudyGpsPlanContent | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const candidate = value as Record<string, unknown>;
    const plan: StudyGpsPlanContent = {
      dailyRoute: this.coerceArray(candidate.dailyRoute)
        .map((item) => this.coerceDailyRouteDay(item))
        .filter((item): item is StudyGpsDailyRouteDay => Boolean(item)),
    };

    if (plan.dailyRoute.length === 0) {
      return null;
    }

    return plan;
  }

  private coerceDailyRouteDay(value: unknown): StudyGpsDailyRouteDay | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const candidate = value as Record<string, unknown>;

    return {
      day: this.coerceNumber(candidate.day),
      goal: this.coerceString(candidate.goal),
      tasks: this.coerceStringArray(candidate.tasks),
    };
  }

  private normalizeStudyGpsPlan(
    plan: StudyGpsPlanContent,
    documents: StudyGpsSourceDocument[],
    dto: GenerateStudyGpsDto,
  ): StudyGpsPlanContent {
    const fallbackPlan = this.buildFallbackStudyGpsPlan(documents, dto);
    const dailyRoute = this.normalizeDailyRoute(
      plan.dailyRoute,
      fallbackPlan.dailyRoute,
      dto.daysLeft,
    );

    return {
      dailyRoute,
    };
  }

  private normalizeDailyRoute(
    dailyRoute: StudyGpsDailyRouteDay[],
    fallback: StudyGpsDailyRouteDay[],
    daysLeft: number,
  ): StudyGpsDailyRouteDay[] {
    const sourceRoute = dailyRoute.length > 0 ? dailyRoute : fallback;
    const normalizedRoute = sourceRoute
      .slice(0, daysLeft)
      .map((day, index) => {
        const tasks = this.normalizeStringArray(
          day.tasks,
          fallback[index]?.tasks ?? [],
          6,
        ).filter((task) => !this.isGenericStudyTask(task));

        return {
          day: index + 1,
          goal: this.normalizePlanText(day.goal) || fallback[index]?.goal,
          tasks,
        };
      });

    if (normalizedRoute.length >= daysLeft) {
      return normalizedRoute;
    }

    return [
      ...normalizedRoute,
      ...fallback.slice(normalizedRoute.length, daysLeft),
    ];
  }

  private buildFallbackStudyGpsPlan(
    documents: StudyGpsSourceDocument[],
    dto: GenerateStudyGpsDto,
  ): StudyGpsPlanContent {
    return {
      dailyRoute: this.buildFallbackDailyRoute(documents, dto),
    };
  }

  private buildFallbackDailyRoute(
    documents: StudyGpsSourceDocument[],
    dto: GenerateStudyGpsDto,
  ): StudyGpsDailyRouteDay[] {
    const isVietnamese = dto.language === 'vi';

    return Array.from({ length: dto.daysLeft }, (_, index) => {
      const document = documents[index % documents.length];
      const isLastDay = index === dto.daysLeft - 1;

      return {
        day: index + 1,
        goal: isLastDay
          ? isVietnamese
            ? 'Tổng ôn và kiểm tra lại lỗ hổng'
            : 'Review and close remaining gaps'
          : isVietnamese
            ? `Học trọng tâm: ${document.title}`
            : `Main focus: ${document.title}`,
        tasks: isLastDay
          ? isVietnamese
            ? [
                'Ôn lại các ý chính đã ghi.',
                'Kiểm tra các phần còn yếu hoặc chưa giải thích được.',
                'Tóm tắt lộ trình bằng ngôn ngữ của bạn.',
              ]
            : [
                'Review the strongest notes',
                'Check weak areas',
                'Summarize the route in your own words',
              ]
          : isVietnamese
            ? [
                `Đọc ${document.title} để nắm nội dung chính.`,
                'Ghi lại ý chính, ví dụ và câu hỏi còn chưa rõ.',
                'Liên kết nội dung vừa học với mục tiêu học tập hiện tại.',
              ]
            : [
                `Study ${document.title}`,
                'Capture key ideas and examples',
                'Connect the material to the learning goal',
              ],
      };
    });
  }

  private toPlanResponse(plan: {
    id: string;
    goal: StudyGpsGoal;
    level: StudyGpsLevel;
    language: SummaryLanguage;
    daysLeft: number;
    hoursPerDay: number;
    documents: StudyGpsDocumentRef[];
    plan: StudyGpsPlanContent;
    generatedAt: Date;
    updatedAt: Date;
  }): StudyGpsPlanResponse {
    return {
      id: plan.id,
      goal: plan.goal,
      level: plan.level,
      language: plan.language,
      daysLeft: plan.daysLeft,
      hoursPerDay: plan.hoursPerDay,
      documents: plan.documents,
      plan: {
        dailyRoute: this.coerceArray(plan.plan?.dailyRoute)
          .map((item) => this.coerceDailyRouteDay(item))
          .filter((item): item is StudyGpsDailyRouteDay => Boolean(item)),
      },
      generatedAt: plan.generatedAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };
  }

  private getLanguageName(language: SummaryLanguage): string {
    return language === 'vi' ? 'Vietnamese' : 'English';
  }

  private getGoalLabel(goal: StudyGpsGoal): string {
    const labels: Record<StudyGpsGoal, string> = {
      exam: 'Exam preparation',
      presentation: 'Presentation preparation',
      understand_lesson: 'Understand the lesson',
    };

    return labels[goal];
  }

  private getLevelLabel(level: StudyGpsLevel): string {
    const labels: Record<StudyGpsLevel, string> = {
      weak: 'Weak foundation',
      average: 'Average foundation',
      good: 'Good foundation',
    };

    return labels[level];
  }

  private coerceString(value: unknown): string {
    return typeof value === 'string' ? this.normalizeText(value) : '';
  }

  private coerceNumber(value: unknown): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private coerceArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private coerceStringArray(value: unknown): string[] {
    return this.coerceArray(value)
      .map((item) => this.coerceString(item))
      .filter(Boolean);
  }

  private normalizeStringArray(
    value: string[],
    fallback: string[],
    maxItems: number,
  ): string[] {
    const normalized = value
      .map((item) => this.normalizePlanText(item))
      .filter(Boolean)
      .slice(0, maxItems);

    return normalized.length > 0 ? normalized : fallback.slice(0, maxItems);
  }

  private normalizeText(value: string | null | undefined): string {
    return (value ?? '').replace(/\s+/g, ' ').trim();
  }

  private isGenericStudyTask(value: string): boolean {
    const normalizedValue = this.normalizeText(value).toLowerCase();

    if (!normalizedValue) {
      return true;
    }

    return [
      /đọc\s+kỹ\s+tài\s+liệu/i,
      /tóm\s+tắt.*sổ\s+tay/i,
      /tự\s+đặt\s+câu\s+hỏi/i,
      /kiểm\s+tra\s+sự\s+hiểu\s+biết/i,
      /read\s+carefully/i,
      /summari[sz]e.*notebook/i,
      /ask\s+yourself/i,
      /check\s+your\s+understanding/i,
      /spend\s+\d*\s*hours?/i,
    ].some((pattern) => pattern.test(normalizedValue));
  }

  private normalizePlanText(value: string | null | undefined): string {
    const normalizedValue = this.normalizeText(value);

    if (!normalizedValue) {
      return '';
    }

    const learnerFacingValue = normalizedValue
      .replace(/\b(document|doc)\s*id\s*:?\s*[\w-]+/gi, '')
      .replace(
        /\b(?:study\s+)?(?:part|section|excerpt|reference)?\s*\d+\s+(?:trong|in|from)\s+['"][^'"]+\.(?:pdf|docx?|pptx?|txt)['"]\s*(?:để\s*)?/gi,
        '',
      )
      .replace(
        /\b(?:trong|theo|in|from)\s+(?:tài\s+liệu\s+của\s+)?['"][^'"]+\.(?:pdf|docx?|pptx?|txt)['"]\s*(?:để\s*)?/gi,
        '',
      )
      .replace(
        /\b(?:tài\s+liệu\s+của|file|document)\s+['"][^'"]+\.(?:pdf|docx?|pptx?|txt)['"]/gi,
        'tài liệu',
      )
      .replace(
        /\s+(?:in|from|inside|within|trong|theo)\s+['"]?\bStudy\s+parts?\s*\d+\b['"]?/gi,
        '',
      )
      .replace(/['"]?\bStudy\s+parts?\s*\d+\b['"]?/gi, 'tài liệu')
      .replace(/\bStudy\s+parts?\b/gi, 'tài liệu')
      .replace(/\bselected\s+sections?\b/gi, 'tài liệu')
      .replace(/\b(?:excerpt|reference)\s*#?\d+\b/gi, 'tài liệu')
      .replace(/\bsource\s+chunks?\s*#?\d*\b/gi, 'tài liệu')
      .replace(/\bchunks?\s*#?\d+\b/gi, 'tài liệu')
      .replace(/\brelevant\s+parts?\b/gi, 'tài liệu')
      .replace(/\bchunks?\b/gi, 'tài liệu')
      .replace(/\bembeddings?\b/gi, '')
      .replace(/\bvectors?\b/gi, '')
      .replace(/\braw\s+context\b/gi, 'tài liệu')
      .replace(/\bretrieval\b/gi, 'reading')
      .replace(/\btài liệu\s+và\s+tài liệu\b/gi, 'tài liệu')
      .replace(/\btài liệu\s*,\s*tài liệu\b/gi, 'tài liệu')
      .replace(/^Đọc\s+(?:kỹ\s+)?tài liệu\s+và\s+/i, '')
      .replace(/^Đọc\s+tài liệu\s+để\s+/i, '')
      .replace(/^Nghiên cứu\s+tài liệu\s+(?:để\s+)?/i, '')
      .replace(/^Phân tích\s+tài liệu\s+về\s+/i, 'Phân tích ')
      .replace(/^và\s+/i, '')
      .replace(/^and\s+/i, '');

    return this.normalizeText(
      this.normalizeLoosePunctuation(learnerFacingValue),
    );
  }

  private normalizeLoosePunctuation(value: string): string {
    return value
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/([.!?])\s*[,;:]+/g, '$1')
      .replace(/[,;:]+\s*([.!?])/g, '$1')
      .replace(/([,;:])\s*([,;:])+/g, '$1')
      .replace(/(^|\s)[,;:]+(?=\s|$)/g, '$1')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private truncateText(value: string, maxLength: number): string {
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

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
