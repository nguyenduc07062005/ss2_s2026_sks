import { Injectable, NotFoundException } from '@nestjs/common';
import { Chunk } from 'src/database/entities/chunks.entity';
import { Document } from 'src/database/entities/document.entity';
import { ChunkRepository } from 'src/database/repositories/chunks.repository';
import { DocumentRepository } from 'src/database/repositories/document.repository';
import { RagSource } from '../types/rag.types';

const SOURCE_SNIPPET_LENGTH = 280;

type RepresentativeChunk = Pick<
  Chunk,
  'chunkIndex' | 'chunkText' | 'pageNumber' | 'sectionTitle'
>;

@Injectable()
export class RagDocumentContextService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly chunkRepository: ChunkRepository,
  ) {}

  async ensureOwnedDocument(
    documentId: string,
    ownerId: string,
  ): Promise<Document> {
    const document = await this.documentRepository.findByIdAndOwner(
      documentId,
      ownerId,
    );

    if (!document) {
      throw new NotFoundException('Document not found or not owned by user');
    }

    return document;
  }

  async getRepresentativeChunks(
    documentId: string,
    maxChunks: number,
  ): Promise<RepresentativeChunk[]> {
    const orderedChunks = await this.chunkRepository.findByDocument(documentId);
    return this.selectRepresentativeChunks(orderedChunks, maxChunks);
  }

  buildSummaryContext(chunks: RepresentativeChunk[]): string {
    return chunks
      .map((chunk) => {
        const location = [
          `Chunk ${chunk.chunkIndex}`,
          chunk.pageNumber ? `Page ${chunk.pageNumber}` : null,
          chunk.sectionTitle ? `Section ${chunk.sectionTitle}` : null,
        ]
          .filter(Boolean)
          .join(' | ');

        return `[${location}]\n${chunk.chunkText}`;
      })
      .join('\n\n');
  }

  buildSources(
    documentId: string,
    documentName: string,
    chunks: RepresentativeChunk[],
  ): RagSource[] {
    return chunks.map((chunk) => ({
      documentId,
      documentName,
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber,
      snippet: chunk.chunkText.slice(0, SOURCE_SNIPPET_LENGTH),
      score: 1,
    }));
  }

  private selectRepresentativeChunks(
    chunks: RepresentativeChunk[],
    maxChunks: number,
  ): RepresentativeChunk[] {
    if (chunks.length <= maxChunks) {
      return chunks;
    }

    const selectedIndices = new Set<number>();
    const step = (chunks.length - 1) / (maxChunks - 1);

    for (let index = 0; index < maxChunks; index += 1) {
      selectedIndices.add(Math.round(index * step));
    }

    return [...selectedIndices]
      .sort((left, right) => left - right)
      .map((index) => chunks[index])
      .filter((chunk): chunk is RepresentativeChunk => Boolean(chunk));
  }
}
