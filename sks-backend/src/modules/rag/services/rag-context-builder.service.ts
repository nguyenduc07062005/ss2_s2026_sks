import { Injectable } from '@nestjs/common';

import { RagDocumentContextService } from './rag-document-context.service';

export type RepresentativeChunk = {
  chunkIndex: number;
  chunkText: string;
  pageNumber: number | null;
  sectionTitle: string | null;
};

export type RagBuiltContext<
  TMeta extends Record<string, unknown> = Record<string, unknown>,
> = {
  text: string;
  chunks: RepresentativeChunk[];
  meta: TMeta;
};

export type StudyGpsLearningStructure = {
  documents: Array<{
    id: string;
    title: string;
    sections: string[];
    concepts: string[];
  }>;
};

export type QaEvidenceQuality = 'none' | 'weak' | 'usable';

const SUMMARY_MAX_CHUNKS = 18;
const STUDY_GPS_MAX_CHUNKS_PER_DOCUMENT = 10;
const QA_DEFAULT_CHUNKS = 8;
const MAX_STUDY_GPS_SECTIONS = 12;
const MAX_STUDY_GPS_CONCEPTS = 16;

@Injectable()
export class RagContextBuilderService {
  constructor(
    private readonly ragDocumentContextService: RagDocumentContextService,
  ) {}

  async buildSummaryContext(documentId: string): Promise<RagBuiltContext> {
    const chunks = await this.ragDocumentContextService.getRepresentativeChunks(
      documentId,
      SUMMARY_MAX_CHUNKS,
    );

    return {
      text: this.ragDocumentContextService.buildSummaryContext(chunks),
      chunks,
      meta: {},
    };
  }

  async buildStudyGpsContext(
    documents: Array<{ id: string; title: string }>,
  ): Promise<
    RagBuiltContext<{ learningStructure: StudyGpsLearningStructure }>
  > {
    const allChunks: RepresentativeChunk[] = [];
    const learningStructure: StudyGpsLearningStructure = {
      documents: [],
    };
    const documentSections: string[] = [];
    const excerptSections: string[] = [];

    for (const document of documents) {
      const chunks =
        await this.ragDocumentContextService.getRepresentativeChunks(
          document.id,
          STUDY_GPS_MAX_CHUNKS_PER_DOCUMENT,
        );
      const sections = this.extractSections(chunks);
      const concepts = this.extractConcepts(chunks, sections);

      allChunks.push(...chunks);
      learningStructure.documents.push({
        id: document.id,
        title: document.title,
        sections,
        concepts,
      });
      documentSections.push(
        [
          `- ${document.title}`,
          sections.length > 0 ? `  Sections: ${sections.join(', ')}` : null,
          concepts.length > 0 ? `  Concepts: ${concepts.join(', ')}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      );
      excerptSections.push(
        `Document: ${document.title}\n${this.ragDocumentContextService.buildSummaryContext(
          chunks,
        )}`,
      );
    }

    return {
      text: [
        'Learning structure:',
        documentSections.join('\n'),
        '',
        'Important excerpts:',
        excerptSections.join('\n\n'),
      ]
        .join('\n')
        .trim(),
      chunks: allChunks,
      meta: {
        learningStructure,
      },
    };
  }

  async buildQaContext(input: {
    ownerId: string;
    question: string;
    documentId?: string;
    documentIds?: string[];
    limit?: number;
  }): Promise<RagBuiltContext<{ evidenceQuality: QaEvidenceQuality }>> {
    const documentIds = this.resolveQaDocumentIds(input);

    if (documentIds.length === 0) {
      return {
        text: '',
        chunks: [],
        meta: { evidenceQuality: 'none' },
      };
    }

    const chunks: RepresentativeChunk[] = [];
    const maxChunks = Math.max(input.limit ?? QA_DEFAULT_CHUNKS, 1);

    for (const documentId of documentIds) {
      await this.ragDocumentContextService.ensureOwnedDocument(
        documentId,
        input.ownerId,
      );
      chunks.push(
        ...(await this.ragDocumentContextService.getRelevantChunks(
          documentId,
          input.question,
          maxChunks,
        )),
      );
    }

    return {
      text: this.ragDocumentContextService.buildSummaryContext(chunks),
      chunks,
      meta: {
        evidenceQuality: this.resolveEvidenceQuality(chunks),
      },
    };
  }

  private resolveQaDocumentIds(input: {
    documentId?: string;
    documentIds?: string[];
  }): string[] {
    const ids = [input.documentId, ...(input.documentIds ?? [])]
      .filter((id): id is string => typeof id === 'string')
      .map((id) => id.trim())
      .filter(Boolean);

    return [...new Set(ids)];
  }

  private resolveEvidenceQuality(
    chunks: RepresentativeChunk[],
  ): QaEvidenceQuality {
    if (chunks.length === 0) {
      return 'none';
    }

    const sourceWordCount = this.countWords(
      chunks.map((chunk) => chunk.chunkText).join(' '),
    );

    if (chunks.length < 2 || sourceWordCount < 30) {
      return 'weak';
    }

    return 'usable';
  }

  private extractSections(chunks: RepresentativeChunk[]): string[] {
    return this.uniqueNonEmpty(
      chunks.map((chunk) => chunk.sectionTitle),
      MAX_STUDY_GPS_SECTIONS,
    );
  }

  private extractConcepts(
    chunks: RepresentativeChunk[],
    sections: string[],
  ): string[] {
    const candidates = [
      ...sections,
      ...chunks.flatMap((chunk) => this.extractConceptCandidates(chunk)),
    ];

    return this.uniqueNonEmpty(candidates, MAX_STUDY_GPS_CONCEPTS);
  }

  private extractConceptCandidates(chunk: RepresentativeChunk): string[] {
    return chunk.chunkText
      .split(/[.!?;:]/)
      .map((segment) => segment.trim())
      .filter((segment) => this.countWords(segment) >= 2)
      .map((segment) => segment.split(/\s+/).slice(0, 6).join(' '))
      .slice(0, 2);
  }

  private uniqueNonEmpty(
    values: Array<string | null | undefined>,
    limit: number,
  ): string[] {
    const seen = new Set<string>();
    const results: string[] = [];

    for (const value of values) {
      const normalizedValue = this.normalizeText(value);
      const key = normalizedValue.toLowerCase();

      if (!normalizedValue || seen.has(key)) {
        continue;
      }

      seen.add(key);
      results.push(normalizedValue);

      if (results.length >= limit) {
        break;
      }
    }

    return results;
  }

  private countWords(value: string): number {
    return value.split(/\s+/).filter(Boolean).length;
  }

  private normalizeText(value: string | null | undefined): string {
    return (value ?? '').replace(/\s+/g, ' ').trim();
  }
}
