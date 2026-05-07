export const SUMMARY_LANGUAGES = ['vi', 'en'] as const;
export const SUMMARY_VERSION_SLOTS = ['default', 'custom'] as const;
export const SUMMARY_FORMATS = ['structured', 'narrative'] as const;
export const STUDY_GPS_GOALS = [
  'exam',
  'presentation',
  'understand_lesson',
] as const;
export const STUDY_GPS_LEVELS = ['weak', 'average', 'good'] as const;
export const QUIZ_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export const QUIZ_QUESTION_TYPES = ['multiple_choice', 'true_false'] as const;
export const QUIZ_QUESTION_COUNTS = [5, 10, 15] as const;

export type SummaryLanguage = (typeof SUMMARY_LANGUAGES)[number];
export type SummaryVersionSlot = (typeof SUMMARY_VERSION_SLOTS)[number];
export type SummaryFormat = (typeof SUMMARY_FORMATS)[number];
export type StudyGpsGoal = (typeof STUDY_GPS_GOALS)[number];
export type StudyGpsLevel = (typeof STUDY_GPS_LEVELS)[number];
export type QuizDifficulty = (typeof QUIZ_DIFFICULTIES)[number];
export type QuizQuestionType = (typeof QUIZ_QUESTION_TYPES)[number];
export type QuizQuestionCount = (typeof QUIZ_QUESTION_COUNTS)[number];

export type RagSource = {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  pageNumber: number | null;
  snippet: string;
  score: number | null;
};

export type AskHistoryItem = {
  id: string;
  question: string;
  answer: string;
  sources: RagSource[];
  createdAt: string;
};

export type RagAnswerResponse = {
  answer: string;
  sources: RagSource[];
};

export type StructuredDocumentSummary = {
  title: string;
  overview: string;
  key_points: string[];
  conclusion: string;
  format?: SummaryFormat;
  body?: string | null;
};

export type DocumentSummaryResponse = StructuredDocumentSummary & {
  language: SummaryLanguage;
  generatedAt: string;
  sources: RagSource[];
  cached: boolean;
  slot: SummaryVersionSlot;
  instruction?: string | null;
  activeSlot: SummaryVersionSlot;
  versions: SummaryVersionResponse[];
};

export type SummaryArtifact = StructuredDocumentSummary & {
  language: SummaryLanguage;
  generatedAt: string;
  sources: RagSource[];
  version?: number;
  slot: SummaryVersionSlot;
  instruction?: string | null;
};

export type SummaryVersionResponse = SummaryArtifact & {
  active: boolean;
};

export type SummaryLanguageCache = {
  activeSlot?: SummaryVersionSlot;
  versions?: Partial<Record<SummaryVersionSlot, SummaryArtifact>>;
};

export type QuizOption = {
  id: string;
  text: string;
};

export type QuizQuestion = {
  id: string;
  type: QuizQuestionType;
  difficulty: QuizDifficulty;
  question: string;
  options: QuizOption[];
  correctOptionId: string;
  explanation: string;
  sourceSnippet: string;
};

export type QuizDocumentRef = {
  id: string;
  title: string;
};

export type DocumentQuizResponse = {
  quizId: string;
  language: SummaryLanguage;
  difficulty: QuizDifficulty;
  questionType: QuizQuestionType;
  questionCount: number;
  generatedAt: string;
  documents: QuizDocumentRef[];
  questions: QuizQuestion[];
  sources: RagSource[];
};

export type QuizChatHistoryItem = {
  id: string;
  documentIds: string[];
  question: string;
  answer: string;
  sources: RagSource[];
  createdAt: string;
};

export type StudyGpsDocumentRef = {
  id: string;
  title: string;
};

export type StudyGpsDailyRouteDay = {
  day: number;
  goal: string;
  tasks: string[];
};

export type StudyGpsPlanContent = {
  dailyRoute: StudyGpsDailyRouteDay[];
};

export type StudyGpsDayChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type StudyGpsDayChatHistoryItem = StudyGpsDayChatMessage & {
  id: string;
  sources: RagSource[];
  createdAt: string;
};

export type StudyGpsDayChatResponse = {
  day: number;
  goal: string;
  tasks: string[];
  items: StudyGpsDayChatHistoryItem[];
};

export type StudyGpsPlanResponse = {
  id: string;
  goal: StudyGpsGoal;
  level: StudyGpsLevel;
  language: SummaryLanguage;
  daysLeft: number;
  hoursPerDay: number;
  documents: StudyGpsDocumentRef[];
  plan: StudyGpsPlanContent;
  generatedAt: string;
  updatedAt: string;
};

export type StoredRagArtifact<TPayload = unknown> = {
  key: string;
  artifactType: 'summary' | 'study_gps';
  language: SummaryLanguage;
  mode: string;
  documentId: string;
  contentHash: string;
  instructionHash: string;
  artifactVersion: number;
  generatedAt: string;
  payload: TPayload;
};

export type DocumentArtifactCache = {
  artifactsByKey?: Record<string, StoredRagArtifact>;
  activeArtifactKeys?: Record<string, string>;
  summary?: {
    text: string;
    sources: RagSource[];
    generatedAt: string;
  };
  summaryByLanguage?: Partial<
    Record<SummaryLanguage, SummaryLanguageCache | SummaryArtifact>
  >;
};

export type IndexingResult = {
  documentId: string;
  indexedChunks: number;
  totalChunks: number;
};
