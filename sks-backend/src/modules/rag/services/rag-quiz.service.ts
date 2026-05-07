import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PromptTemplate } from '@langchain/core/prompts';
import { Document } from 'src/database/entities/document.entity';
import { QuizChatHistory } from 'src/database/entities/quiz-chat-history.entity';
import { QuizChatHistoryRepository } from 'src/database/repositories/quiz-chat-history.repository';
import {
  DocumentQuizResponse,
  QuizChatHistoryItem,
  QuizDifficulty,
  QuizOption,
  QuizQuestion,
  QuizQuestionType,
  SummaryLanguage,
} from '../types/rag.types';
import { GenerateQuizDto } from '../dtos/generate-quiz.dto';
import { RagDocumentContextService } from './rag-document-context.service';
import { RagIndexingService } from './rag-indexing.service';
import { RagQuestionAnsweringService } from './rag-question-answering.service';
import { RagStructuredGenerationService } from './rag-structured-generation.service';
import { extractJsonCandidate, parseJsonWithRepair } from '../utils/llm-json';
import {
  getLanguageName,
  normalizeConversationText,
  toErrorMessage,
  toErrorStack,
  truncateConversationText,
} from '../shared-rag.util';
import {
  MAX_QUIZ_CHAT_HISTORY_ITEMS,
  QUIZ_CHUNKS_PER_DOCUMENT,
  RECENT_QUIZ_CHAT_TURNS,
} from '../constants';

type QuizGenerationInput = GenerateQuizDto & {
  ownerId: string;
};

type RawQuizResponse = {
  questions?: unknown[];
};

const QUIZ_PROMPT_TEMPLATE = [
  'You are a careful academic quiz writer inside a study document workspace.',
  'Create a quiz using ONLY the provided document context.',
  'Do not use outside knowledge. Do not invent unsupported facts.',
  'Default output language: {languageName}. Write every question, option, and explanation in that language.',
  'Difficulty: {difficulty}.',
  'Question type: {questionTypeLabel}.',
  'Required number of questions: {questionCount}.',
  '',
  'Quality rules:',
  '- Test meaningful concepts, definitions, comparisons, procedures, causes, effects, examples, or conclusions from the documents.',
  '- Avoid vague questions such as "what is discussed in the document".',
  '- Make each question answerable from the context.',
  '- Keep explanations source-grounded and concise.',
  '- For multiple_choice, return exactly 4 options.',
  '- For true_false, return exactly 2 options: True and False in the requested language.',
  '- sourceSnippet must be a short source excerpt or faithful paraphrase from the context.',
  '- Do not use Markdown fences, comments, trailing commas, or unquoted object keys.',
  '',
  'Return ONLY valid JSON with this exact structure:',
  '{{',
  '  "questions": [',
  '    {{',
  '      "id": "q1",',
  '      "type": "{questionType}",',
  '      "difficulty": "{difficulty}",',
  '      "question": "question text",',
  '      "options": [{{ "id": "A", "text": "option text" }}],',
  '      "correctOptionId": "A",',
  '      "explanation": "why this answer is correct and why likely distractors are wrong",',
  '      "sourceSnippet": "short grounding from the document"',
  '    }}',
  '  ]',
  '}}',
  '',
  'Selected documents:',
  '{documentList}',
  '',
  'Context:',
  '{context}',
].join('\n');

const QUIZ_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['multiple_choice', 'true_false'] },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
          question: { type: 'string' },
          options: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                text: { type: 'string' },
              },
              required: ['id', 'text'],
            },
          },
          correctOptionId: { type: 'string' },
          explanation: { type: 'string' },
          sourceSnippet: { type: 'string' },
        },
        required: [
          'id',
          'type',
          'difficulty',
          'question',
          'options',
          'correctOptionId',
          'explanation',
          'sourceSnippet',
        ],
      },
    },
  },
  required: ['questions'],
} as const;

@Injectable()
export class RagQuizService {
  private readonly logger = new Logger(RagQuizService.name);
  private readonly quizPrompt =
    PromptTemplate.fromTemplate(QUIZ_PROMPT_TEMPLATE);

  constructor(
    private readonly ragDocumentContextService: RagDocumentContextService,
    private readonly ragIndexingService: RagIndexingService,
    private readonly ragStructuredGenerationService: RagStructuredGenerationService,
    private readonly ragQuestionAnsweringService: RagQuestionAnsweringService,
    private readonly quizChatHistoryRepository: QuizChatHistoryRepository,
  ) {}

  async generateQuiz(
    input: QuizGenerationInput,
  ): Promise<DocumentQuizResponse> {
    const documentIds = this.normalizeDocumentIds(input.documentIds);
    const documents = await this.ensureDocumentsReady(
      documentIds,
      input.ownerId,
    );
    const documentChunks = await Promise.all(
      documents.map(async (document) => ({
        document,
        chunks: await this.ragDocumentContextService.getRepresentativeChunks(
          document.id,
          QUIZ_CHUNKS_PER_DOCUMENT,
        ),
      })),
    );
    const context = documentChunks
      .map(({ document, chunks }) =>
        [
          `Document: ${this.getDocumentTitle(document)}`,
          this.ragDocumentContextService.buildSummaryContext(chunks),
        ]
          .filter(Boolean)
          .join('\n'),
      )
      .join('\n\n');

    if (!context.trim()) {
      throw new BadRequestException(
        'Selected documents have no indexed content available for quiz generation.',
      );
    }

    let rawQuiz: RawQuizResponse;

    try {
      rawQuiz = await this.ragStructuredGenerationService.generate({
        input: {
          languageName: getLanguageName(input.language),
          difficulty: input.difficulty,
          questionType: input.questionType,
          questionTypeLabel: this.getQuestionTypeLabel(input.questionType),
          questionCount: String(input.questionCount),
          documentList: documents
            .map(
              (document, index) =>
                `${index + 1}. ${this.getDocumentTitle(document)}`,
            )
            .join('\n'),
          context,
        },
        prompt: this.quizPrompt,
        fallbackPrompt: this.quizPrompt,
        outputSchema: QUIZ_OUTPUT_SCHEMA,
        schemaName: 'document_quiz',
        operationLabel: 'Quiz generation',
        modelOptions: {
          temperature: 0.25,
          maxOutputTokens: 8192,
          topP: 0.85,
        },
        coerce: (value) => this.coerceRawQuiz(value),
        parseRawResponse: (rawResponse) =>
          this.parseRawQuizResponse(rawResponse),
        logger: this.logger,
      });
    } catch (error) {
      this.logger.error('Quiz generation failed.', toErrorStack(error));
      throw this.toQuizGenerationException(error);
    }

    const questions = this.normalizeQuestions(rawQuiz, input);

    if (questions.length === 0) {
      throw new BadGatewayException(
        'AI could not generate a usable quiz from these documents.',
      );
    }

    const sources = documentChunks.flatMap(({ document, chunks }) =>
      this.ragDocumentContextService.buildSources(
        document.id,
        this.getDocumentTitle(document),
        chunks,
      ),
    );

    await this.clearQuizChatHistoryForNewQuiz(input.ownerId);

    return {
      quizId: this.createQuizId(),
      language: input.language,
      difficulty: input.difficulty,
      questionType: input.questionType,
      questionCount: questions.length,
      generatedAt: new Date().toISOString(),
      documents: documents.map((document) => ({
        id: document.id,
        title: this.getDocumentTitle(document),
      })),
      questions,
      sources,
    };
  }

  async sendQuizChatMessage(
    ownerId: string,
    documentIds: string[],
    question: string,
  ): Promise<{ historyItem: QuizChatHistoryItem }> {
    const normalizedQuestion = normalizeConversationText(question);

    if (!normalizedQuestion) {
      throw new BadRequestException('Message is required');
    }

    const normalizedDocumentIds = this.normalizeDocumentIds(documentIds);
    const documents = await Promise.all(
      normalizedDocumentIds.map((documentId) =>
        this.ragDocumentContextService.ensureOwnedDocument(documentId, ownerId),
      ),
    );
    const recentHistory = await this.quizChatHistoryRepository.findRecentByUser(
      ownerId,
      RECENT_QUIZ_CHAT_TURNS,
    );
    const response = await this.ragQuestionAnsweringService.answerStudyGpsDay(
      ownerId,
      normalizedQuestion,
      {
        documentIds: normalizedDocumentIds,
        scopeLabel: `Quiz review: ${documents
          .map((document) => this.getDocumentTitle(document))
          .join(', ')}`,
        studyContext:
          'The learner is reviewing an AI-generated quiz from the selected documents. Explain answers clearly and keep the response grounded in the document excerpts.',
        recentMessages: this.toRecentMessages(recentHistory),
      },
    );
    const entry = await this.quizChatHistoryRepository.create({
      user: { id: ownerId },
      documentIds: normalizedDocumentIds,
      question: normalizedQuestion,
      answer: response.answer,
      sources: response.sources,
    });

    await this.quizChatHistoryRepository.trimToLatestByUser(
      ownerId,
      MAX_QUIZ_CHAT_HISTORY_ITEMS,
    );

    return {
      historyItem: this.toQuizChatHistoryItem(entry),
    };
  }

  async getQuizChatHistory(ownerId: string): Promise<QuizChatHistoryItem[]> {
    const entries = await this.quizChatHistoryRepository.findRecentByUser(
      ownerId,
      MAX_QUIZ_CHAT_HISTORY_ITEMS,
    );

    return entries.reverse().map((entry) => this.toQuizChatHistoryItem(entry));
  }

  async clearQuizChatHistory(ownerId: string): Promise<number> {
    return this.quizChatHistoryRepository.clearByUser(ownerId);
  }

  private async clearQuizChatHistoryForNewQuiz(ownerId: string): Promise<void> {
    try {
      await this.quizChatHistoryRepository.clearByUser(ownerId);
    } catch (error) {
      this.logger.warn(
        `Unable to clear quiz chat history after generating a new quiz: ${toErrorMessage(error)}`,
      );
    }
  }

  private async ensureDocumentsReady(
    documentIds: string[],
    ownerId: string,
  ): Promise<Document[]> {
    const documents: Document[] = [];

    for (const documentId of documentIds) {
      const document = await this.ragDocumentContextService.ensureOwnedDocument(
        documentId,
        ownerId,
      );
      await this.ragIndexingService.ensureDocumentIndexed(documentId);
      documents.push(document);
    }

    return documents;
  }

  private normalizeDocumentIds(documentIds: string[]): string[] {
    const normalizedIds = [...new Set((documentIds ?? []).filter(Boolean))];

    if (normalizedIds.length === 0) {
      throw new BadRequestException('Select at least one document.');
    }

    return normalizedIds;
  }

  private coerceRawQuiz(value: unknown): RawQuizResponse {
    if (!value || typeof value !== 'object') {
      return { questions: [] };
    }

    const candidate = value as RawQuizResponse;
    return {
      questions: Array.isArray(candidate.questions) ? candidate.questions : [],
    };
  }

  private parseRawQuizResponse(rawResponse: string): RawQuizResponse {
    try {
      return this.coerceRawQuiz(
        parseJsonWithRepair<RawQuizResponse>(rawResponse),
      );
    } catch (error) {
      this.logger.warn(
        `Quiz JSON parsing failed; attempting to recover complete questions: ${toErrorMessage(
          error,
        )}`,
      );

      const questions = this.extractCompleteQuestionObjects(rawResponse);

      if (questions.length > 0) {
        return { questions };
      }

      throw error;
    }
  }

  private extractCompleteQuestionObjects(rawResponse: string): unknown[] {
    const candidate = extractJsonCandidate(rawResponse);
    const questionsMatch = /"questions"\s*:/i.exec(candidate);

    if (!questionsMatch) {
      return [];
    }

    const arrayStartIndex = candidate.indexOf('[', questionsMatch.index);

    if (arrayStartIndex < 0) {
      return [];
    }

    const questions: unknown[] = [];

    for (
      let index = arrayStartIndex + 1;
      index < candidate.length;
      index += 1
    ) {
      if (candidate[index] !== '{') {
        continue;
      }

      const objectSlice = this.extractBalancedObject(candidate, index);

      if (!objectSlice) {
        continue;
      }

      try {
        questions.push(parseJsonWithRepair<unknown>(objectSlice));
      } catch {
        // Skip malformed objects and keep any complete questions around them.
      }

      index += objectSlice.length - 1;
    }

    return questions;
  }

  private extractBalancedObject(
    value: string,
    startIndex: number,
  ): string | null {
    let depth = 0;
    let inString = false;
    let isEscaped = false;

    for (let index = startIndex; index < value.length; index += 1) {
      const currentChar = value[index];

      if (inString) {
        if (isEscaped) {
          isEscaped = false;
          continue;
        }

        if (currentChar === '\\') {
          isEscaped = true;
          continue;
        }

        if (currentChar === '"') {
          inString = false;
        }

        continue;
      }

      if (currentChar === '"') {
        inString = true;
        continue;
      }

      if (currentChar === '{') {
        depth += 1;
        continue;
      }

      if (currentChar === '}') {
        depth -= 1;

        if (depth === 0) {
          return value.slice(startIndex, index + 1).trim();
        }
      }
    }

    return null;
  }

  private normalizeQuestions(
    rawQuiz: RawQuizResponse,
    input: GenerateQuizDto,
  ): QuizQuestion[] {
    return (rawQuiz.questions ?? [])
      .map((question, index) =>
        this.normalizeQuestion(
          question,
          index,
          input.questionType,
          input.difficulty,
          input.language,
        ),
      )
      .filter((question): question is QuizQuestion => Boolean(question))
      .slice(0, input.questionCount);
  }

  private normalizeQuestion(
    value: unknown,
    index: number,
    expectedType: QuizQuestionType,
    expectedDifficulty: QuizDifficulty,
    language: SummaryLanguage,
  ): QuizQuestion | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Record<string, unknown>;
    const question = normalizeConversationText(candidate.question);
    const explanation = normalizeConversationText(candidate.explanation);
    const sourceSnippet = normalizeConversationText(candidate.sourceSnippet);

    if (!question) {
      return null;
    }

    const options = this.normalizeOptions(
      candidate.options,
      expectedType,
      language,
    );
    const correctOptionId = this.normalizeCorrectOptionId(
      candidate.correctOptionId,
      options,
    );

    if (!correctOptionId) {
      return null;
    }

    return {
      id: normalizeConversationText(candidate.id) || `q${index + 1}`,
      type: expectedType,
      difficulty: expectedDifficulty,
      question,
      options,
      correctOptionId,
      explanation:
        explanation ||
        'The correct answer is supported by the selected document context.',
      sourceSnippet,
    };
  }

  private normalizeOptions(
    value: unknown,
    questionType: QuizQuestionType,
    language: SummaryLanguage,
  ): QuizOption[] {
    if (questionType === 'true_false') {
      return [
        { id: 'A', text: language === 'vi' ? 'Đúng' : 'True' },
        { id: 'B', text: language === 'vi' ? 'Sai' : 'False' },
      ];
    }

    if (!Array.isArray(value)) {
      return [];
    }

    const options = value
      .map((option, index) => this.normalizeOption(option, index))
      .filter((option): option is QuizOption => Boolean(option))
      .slice(0, 4);

    return options.length === 4 ? options : [];
  }

  private normalizeOption(value: unknown, index: number): QuizOption | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Record<string, unknown>;
    const text = normalizeConversationText(candidate.text);

    if (!text) {
      return null;
    }

    return {
      id: this.normalizeOptionId(candidate.id, index),
      text,
    };
  }

  private normalizeCorrectOptionId(
    value: unknown,
    options: QuizOption[],
  ): string | null {
    const normalizedValue = normalizeConversationText(value).toUpperCase();

    if (options.some((option) => option.id === normalizedValue)) {
      return normalizedValue;
    }

    const semanticValue = normalizedValue
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (options.length === 2) {
      if (['TRUE', 'DUNG', 'CORRECT'].includes(semanticValue)) {
        return options[0]?.id ?? null;
      }

      if (['FALSE', 'SAI', 'INCORRECT'].includes(semanticValue)) {
        return options[1]?.id ?? null;
      }
    }

    const matchedOption = options.find(
      (option) =>
        option.text.toUpperCase() === normalizedValue ||
        option.text.toUpperCase().startsWith(`${normalizedValue}.`),
    );

    return matchedOption?.id ?? null;
  }

  private normalizeOptionId(value: unknown, index: number): string {
    const normalizedValue = normalizeConversationText(value)
      .replace(/[^a-z0-9]/gi, '')
      .toUpperCase();

    if (normalizedValue) {
      return normalizedValue.slice(0, 3);
    }

    return String.fromCharCode(65 + index);
  }

  private getQuestionTypeLabel(questionType: QuizQuestionType): string {
    return questionType === 'true_false' ? 'True / False' : 'Multiple Choice';
  }

  private getDocumentTitle(document: Document): string {
    return document.title || 'Untitled document';
  }

  private createQuizId(): string {
    return `quiz-${randomUUID()}`;
  }

  private toQuizGenerationException(
    error: unknown,
  ): BadGatewayException | ServiceUnavailableException {
    const normalizedMessage = toErrorMessage(error).toLowerCase();

    if (
      normalizedMessage.includes('resource_exhausted') ||
      normalizedMessage.includes('quota exceeded') ||
      normalizedMessage.includes('429 too many requests')
    ) {
      return new ServiceUnavailableException(
        'LLM quota is exhausted. Please check the backend LLM key or quota configuration, then try generating the quiz again.',
      );
    }

    if (
      normalizedMessage.includes('model') &&
      normalizedMessage.includes('not found')
    ) {
      return new ServiceUnavailableException(
        'The configured LLM model is unavailable. Please check the backend model configuration and try again.',
      );
    }

    return new BadGatewayException(
      'Quiz generation failed because the AI returned an unusable response. Please try again in a moment.',
    );
  }

  private toRecentMessages(entries: QuizChatHistory[]) {
    return [...entries].reverse().flatMap((entry) => [
      {
        role: 'user' as const,
        content: entry.question,
      },
      {
        role: 'assistant' as const,
        content: truncateConversationText(entry.answer),
      },
    ]);
  }

  private toQuizChatHistoryItem(entry: QuizChatHistory): QuizChatHistoryItem {
    return {
      id: entry.id,
      documentIds: entry.documentIds ?? [],
      question: entry.question,
      answer: entry.answer,
      sources: entry.sources ?? [],
      createdAt: entry.createdAt.toISOString(),
    };
  }
}
