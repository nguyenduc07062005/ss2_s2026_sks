export const SUMMARY_LANGUAGES = ['vi', 'en'] as const;

export type SummaryLanguage = (typeof SUMMARY_LANGUAGES)[number];

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
};

export type DocumentSummaryResponse = StructuredDocumentSummary & {
  language: SummaryLanguage;
  generatedAt: string;
  sources: RagSource[];
  cached: boolean;
};

export type SummaryArtifact = StructuredDocumentSummary & {
  language: SummaryLanguage;
  generatedAt: string;
  sources: RagSource[];
  version?: number;
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
  summaryByLanguage?: Partial<Record<SummaryLanguage, SummaryArtifact>>;
  mindMapByLanguage?: Partial<Record<SummaryLanguage, MindMapArtifact>>;
  diagram?: DiagramArtifact;
};

export type IndexingResult = {
  documentId: string;
  indexedChunks: number;
  totalChunks: number;
};
