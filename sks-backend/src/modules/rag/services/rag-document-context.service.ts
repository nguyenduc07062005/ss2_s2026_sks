import { Injectable, NotFoundException } from '@nestjs/common';
import { Chunk } from 'src/database/entities/chunks.entity';
import { Document } from 'src/database/entities/document.entity';
import { ChunkRepository } from 'src/database/repositories/chunks.repository';
import { DocumentRepository } from 'src/database/repositories/document.repository';
import { repairMojibakeText } from 'src/common/utils/text-encoding';
import { RagSource } from '../types/rag.types';

const SOURCE_SNIPPET_LENGTH = 280;
const CONTEXT_SEARCH_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'the',
  'this',
  'to',
  'with',
  'la',
  'va',
  've',
  'voi',
  'cua',
  'cho',
  'cac',
  'nhung',
  'trong',
  'ngoai',
  'mot',
  'nay',
  'do',
]);

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

  async getRelevantChunks(
    documentId: string,
    query: string,
    maxChunks: number,
  ): Promise<RepresentativeChunk[]> {
    const orderedChunks = await this.chunkRepository.findByDocument(documentId);

    if (orderedChunks.length <= maxChunks) {
      return orderedChunks;
    }

    return this.selectRelevantChunks(orderedChunks, query, maxChunks);
  }

  buildSummaryContext(chunks: RepresentativeChunk[]): string {
    return chunks
      .map((chunk) => {
        const sectionTitle = this.normalizeContextText(chunk.sectionTitle);
        const location = [
          `Chunk ${chunk.chunkIndex}`,
          chunk.pageNumber ? `Page ${chunk.pageNumber}` : null,
          sectionTitle ? `Section ${sectionTitle}` : null,
        ]
          .filter(Boolean)
          .join(' | ');

        return `[${location}]\n${this.normalizeContextText(chunk.chunkText)}`;
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
      snippet: this.normalizeContextText(chunk.chunkText).slice(
        0,
        SOURCE_SNIPPET_LENGTH,
      ),
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

  private selectRelevantChunks(
    chunks: RepresentativeChunk[],
    query: string,
    maxChunks: number,
  ): RepresentativeChunk[] {
    const tokens = this.extractSearchTokens(query);
    const phrases = this.extractSearchPhrases(query);

    if (tokens.length === 0 && phrases.length === 0) {
      return this.selectRepresentativeChunks(chunks, maxChunks);
    }

    const scoredChunks = chunks
      .map((chunk, position) => ({
        chunk,
        position,
        score: this.scoreChunkRelevance(chunk, tokens, phrases),
      }))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return left.chunk.chunkIndex - right.chunk.chunkIndex;
      });

    if ((scoredChunks[0]?.score ?? 0) <= 0) {
      return this.selectRepresentativeChunks(chunks, maxChunks);
    }

    const selectedPositions = new Set<number>();

    for (const scoredChunk of scoredChunks) {
      if (selectedPositions.size >= maxChunks) {
        break;
      }

      selectedPositions.add(scoredChunk.position);

      for (const neighbor of [scoredChunk.position - 1, scoredChunk.position + 1]) {
        if (
          selectedPositions.size < maxChunks &&
          neighbor >= 0 &&
          neighbor < chunks.length
        ) {
          selectedPositions.add(neighbor);
        }
      }
    }

    return [...selectedPositions]
      .sort((left, right) => left - right)
      .map((position) => chunks[position])
      .filter((chunk): chunk is RepresentativeChunk => Boolean(chunk));
  }

  private scoreChunkRelevance(
    chunk: RepresentativeChunk,
    tokens: string[],
    phrases: string[],
  ): number {
    const normalizedText = this.normalizeForSearch(chunk.chunkText);
    const normalizedSection = this.normalizeForSearch(chunk.sectionTitle ?? '');
    const combinedText = `${normalizedSection} ${normalizedText}`.trim();
    let score = 0;

    for (const phrase of phrases) {
      if (phrase.length >= 8 && combinedText.includes(phrase)) {
        score += Math.min(phrase.split(/\s+/).length * 2, 12);
      }
    }

    for (const token of tokens) {
      if (normalizedSection.includes(token)) {
        score += 4;
      }

      if (normalizedText.includes(token)) {
        score += 1;
      }
    }

    return score;
  }

  private extractSearchTokens(value: string): string[] {
    const normalizedValue = this.normalizeForSearch(value);
    const seen = new Set<string>();

    return normalizedValue
      .split(/\s+/)
      .filter((token) => token.length >= 3)
      .filter((token) => !CONTEXT_SEARCH_STOPWORDS.has(token))
      .filter((token) => {
        if (seen.has(token)) {
          return false;
        }

        seen.add(token);
        return true;
      })
      .slice(0, 32);
  }

  private extractSearchPhrases(value: string): string[] {
    const seen = new Set<string>();

    return value
      .split(/[\n>,;|]+/)
      .map((phrase) => this.normalizeForSearch(phrase))
      .filter((phrase) => phrase.length >= 8)
      .filter((phrase) => phrase.split(/\s+/).length >= 2)
      .filter((phrase) => {
        if (seen.has(phrase)) {
          return false;
        }

        seen.add(phrase);
        return true;
      })
      .slice(0, 12);
  }

  private normalizeForSearch(value: string | null | undefined): string {
    return this.normalizeContextText(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeContextText(value: string | null | undefined): string {
    return repairMojibakeText(value)
      .replace(/\u0000/g, '')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }
}
