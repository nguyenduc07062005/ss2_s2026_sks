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
  diagram?: DiagramArtifact;
};

export type IndexingResult = {
  documentId: string;
  indexedChunks: number;
  totalChunks: number;
};
