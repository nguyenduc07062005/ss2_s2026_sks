export const SUMMARY_LANGUAGES = ['vi', 'en'] as const;
export const SUMMARY_VERSION_SLOTS = ['default', 'custom'] as const;
export const SUMMARY_FORMATS = ['structured', 'narrative'] as const;

export type SummaryLanguage = (typeof SUMMARY_LANGUAGES)[number];
export type SummaryVersionSlot = (typeof SUMMARY_VERSION_SLOTS)[number];
export type SummaryFormat = (typeof SUMMARY_FORMATS)[number];

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

export type MindMapNode = {
  id: string;
  label: string;
  summary: string;
  kind: MindMapNodeKind;
  children: MindMapNode[];
};

export type MindMapArtifact = {
  root: MindMapNode;
  summaryText: string;
  generatedAt: string;
  summaryLanguage: SummaryLanguage;
  version: number;
};

export type DocumentMindMapResponse = {
  mindMap: MindMapNode;
  summary: string;
  language: SummaryLanguage;
  generatedAt: string;
  cached: boolean;
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
  mindMapByLanguage?: Partial<Record<SummaryLanguage, MindMapArtifact>>;
  diagram?: DiagramArtifact;
};

export type IndexingResult = {
  documentId: string;
  indexedChunks: number;
  totalChunks: number;
};
