export const SUMMARY_LANGUAGES = ['vi', 'en'] as const;
export const SUMMARY_VERSION_SLOTS = ['default', 'custom'] as const;
export const SUMMARY_FORMATS = ['structured', 'narrative'] as const;
export const STUDY_GPS_GOALS = [
  'exam',
  'presentation',
  'understand_lesson',
] as const;
export const STUDY_GPS_LEVELS = ['weak', 'average', 'good'] as const;

export type SummaryLanguage = (typeof SUMMARY_LANGUAGES)[number];
export type SummaryVersionSlot = (typeof SUMMARY_VERSION_SLOTS)[number];
export type SummaryFormat = (typeof SUMMARY_FORMATS)[number];
export type StudyGpsGoal = (typeof STUDY_GPS_GOALS)[number];
export type StudyGpsLevel = (typeof STUDY_GPS_LEVELS)[number];

export type RagSource = {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  pageNumber: number | null;
  snippet: string;
  score: number;
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

export type MindMapNodeKind =
  | 'root'
  | 'overview'
  | 'cluster'
  | 'insight'
  | 'detail'
  | 'takeaway';

export type MindMapNodeStudyNote = {
  overview: string;
  explanation: string;
  keyPoints: string[];
  studyFocus: string;
};

export type MindMapNode = {
  id: string;
  label: string;
  summary: string;
  kind: MindMapNodeKind;
  children: MindMapNode[];
  studyNote?: MindMapNodeStudyNote | null;
};

export type MindMapArtifact = {
  root: MindMapNode;
  summaryText: string;
  generatedAt: string;
  summaryLanguage: SummaryLanguage;
  version: number;
  slot: SummaryVersionSlot;
  instruction?: string | null;
  sources: RagSource[];
};

export type MindMapVersionResponse = MindMapArtifact & {
  active: boolean;
};

export type MindMapLanguageCache = {
  activeSlot?: SummaryVersionSlot;
  versions?: Partial<Record<SummaryVersionSlot, MindMapArtifact>>;
};

export type DocumentMindMapResponse = {
  mindMap: MindMapNode;
  summary: string;
  language: SummaryLanguage;
  generatedAt: string;
  cached: boolean;
  slot: SummaryVersionSlot;
  instruction?: string | null;
  activeSlot: SummaryVersionSlot;
  versions: MindMapVersionResponse[];
};

export type MindMapNodeStudyNoteResponse = MindMapNodeStudyNote & {
  label: string;
  language: SummaryLanguage;
  generatedAt: string;
  sources: RagSource[];
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

export type DiagramArtifact = {
  mermaid: string;
  summaryText: string;
  generatedAt: string;
  summaryLanguage: SummaryLanguage;
};

export type DocumentArtifactCache = {
  summary?: {
    text: string;
    sources: RagSource[];
    generatedAt: string;
  };
  summaryByLanguage?: Partial<
    Record<SummaryLanguage, SummaryLanguageCache | SummaryArtifact>
  >;
  mindMapByLanguage?: Partial<
    Record<SummaryLanguage, MindMapLanguageCache | MindMapArtifact>
  >;
  diagram?: DiagramArtifact;
};

export type IndexingResult = {
  documentId: string;
  indexedChunks: number;
  totalChunks: number;
};
