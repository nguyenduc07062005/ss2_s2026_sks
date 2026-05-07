import { Injectable, NotFoundException } from '@nestjs/common';
import { Chunk } from 'src/database/entities/chunks.entity';
import { Document } from 'src/database/entities/document.entity';
import { ChunkRepository } from 'src/database/repositories/chunks.repository';
import { DocumentRepository } from 'src/database/repositories/document.repository';
import { normalizeForSearch } from 'src/common/utils/text-normalization.util';
import { repairMojibakeText } from 'src/common/utils/text-encoding';
import { RagSource } from '../types/rag.types';
import { SOURCE_SNIPPET_LENGTH, CONTEXT_SEARCH_STOPWORDS } from '../constants';

type RepresentativeChunk = Pick<
  Chunk,
  'chunkIndex' | 'chunkText' | 'pageNumber' | 'sectionTitle'
>;

const MIN_MEANINGFUL_CHUNK_LENGTH = 80;
const SECTION_START_LIMIT = 18;

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
    const orderedChunks = await this.getCleanOrderedChunks(documentId);

    return this.selectStructureAwareRepresentativeChunks(
      orderedChunks,
      maxChunks,
    );
  }

  async getRelevantChunks(
    documentId: string,
    query: string,
    maxChunks: number,
  ): Promise<RepresentativeChunk[]> {
    const orderedChunks = await this.getCleanOrderedChunks(documentId);

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
      score: null,
    }));
  }

  private async getCleanOrderedChunks(
    documentId: string,
  ): Promise<RepresentativeChunk[]> {
    const chunks = await this.chunkRepository.findByDocument(documentId);

    return chunks
      .map((chunk) => ({
        chunkIndex: chunk.chunkIndex,
        chunkText: this.normalizeContextText(chunk.chunkText),
        pageNumber: chunk.pageNumber,
        sectionTitle: this.normalizeContextText(chunk.sectionTitle),
      }))
      .filter((chunk) => this.isMeaningfulContextChunk(chunk))
      .sort((left, right) => left.chunkIndex - right.chunkIndex);
  }

  private isMeaningfulContextChunk(chunk: RepresentativeChunk): boolean {
    const text = this.normalizeContextText(chunk.chunkText);
    const sectionTitle = this.normalizeContextText(chunk.sectionTitle);

    if (!text) {
      return false;
    }

    if (this.looksLikeLowValueNoise(text)) {
      return false;
    }

    if (text.length >= MIN_MEANINGFUL_CHUNK_LENGTH) {
      return true;
    }

    return Boolean(sectionTitle && text.length >= 30);
  }

  private looksLikeLowValueNoise(value: string): boolean {
    const text = this.normalizeContextText(value);

    if (!text) {
      return true;
    }

    const alphaNumericChars = text.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
    const totalChars = text.length;
    const alphaNumericRatio = alphaNumericChars / Math.max(totalChars, 1);

    if (totalChars < 20) {
      return true;
    }

    if (alphaNumericRatio < 0.45) {
      return true;
    }

    const repeatedSymbols = text.match(/[._=\-–—]{5,}/g);
    if (repeatedSymbols && repeatedSymbols.length >= 2) {
      return true;
    }

    return false;
  }

  private selectSectionStartChunks(
    chunks: RepresentativeChunk[],
  ): RepresentativeChunk[] {
    const selected: RepresentativeChunk[] = [];
    let previousSection = '';

    for (const chunk of chunks) {
      const currentSection = this.normalizeSectionKey(chunk.sectionTitle);

      if (!currentSection) {
        continue;
      }

      if (currentSection !== previousSection) {
        selected.push(chunk);
        previousSection = currentSection;
      }

      if (selected.length >= SECTION_START_LIMIT) {
        break;
      }
    }

    return selected;
  }

  private selectStructureAwareRepresentativeChunks(
    chunks: RepresentativeChunk[],
    maxChunks: number,
  ): RepresentativeChunk[] {
    if (maxChunks <= 0) {
      return [];
    }

    if (chunks.length <= maxChunks) {
      return chunks;
    }

    const selected = new Map<number, RepresentativeChunk>();

    const headCount = Math.min(6, maxChunks);
    for (const chunk of chunks.slice(0, headCount)) {
      selected.set(chunk.chunkIndex, chunk);
    }

    for (const chunk of this.selectSectionStartChunks(chunks)) {
      if (selected.size >= maxChunks) {
        break;
      }

      selected.set(chunk.chunkIndex, chunk);
    }

    if (selected.size < maxChunks) {
      const remainingCount = maxChunks - selected.size;
      const distributedChunks = this.selectEvenlyFromSortedChunks(
        chunks,
        remainingCount,
      );

      for (const chunk of distributedChunks) {
        if (selected.size >= maxChunks) {
          break;
        }

        selected.set(chunk.chunkIndex, chunk);
      }
    }

    return this.sortChunksByIndex([...selected.values()]);
  }

  private selectEvenlyFromSortedChunks(
    chunks: RepresentativeChunk[],
    maxChunks: number,
  ): RepresentativeChunk[] {
    if (maxChunks <= 0) {
      return [];
    }

    if (chunks.length <= maxChunks) {
      return chunks;
    }

    if (maxChunks === 1) {
      return [chunks[0]].filter((chunk): chunk is RepresentativeChunk =>
        Boolean(chunk),
      );
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

    if (maxChunks <= 0) {
      return [];
    }

    if (tokens.length === 0 && phrases.length === 0) {
      return this.selectStructureAwareRepresentativeChunks(chunks, maxChunks);
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
      return this.selectStructureAwareRepresentativeChunks(chunks, maxChunks);
    }

    const selectedPositions = new Set<number>();

    for (const scoredChunk of scoredChunks) {
      if (selectedPositions.size >= maxChunks) {
        break;
      }

      selectedPositions.add(scoredChunk.position);

      for (const neighbor of [
        scoredChunk.position - 1,
        scoredChunk.position + 1,
      ]) {
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
    const normalizedText = normalizeForSearch(chunk.chunkText);
    const normalizedSection = normalizeForSearch(chunk.sectionTitle ?? '');
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

  private sortChunksByIndex(
    chunks: RepresentativeChunk[],
  ): RepresentativeChunk[] {
    return [...chunks].sort(
      (left, right) => left.chunkIndex - right.chunkIndex,
    );
  }

  private normalizeSectionKey(value: string | null | undefined): string {
    return normalizeForSearch(this.normalizeContextText(value));
  }

  private extractSearchTokens(value: string): string[] {
    const normalizedValue = normalizeForSearch(value);
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
      .map((phrase) => normalizeForSearch(phrase))
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

  private normalizeContextText(value: string | null | undefined): string {
    return repairMojibakeText(value)
      .split('\u0000')
      .join('')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }
}
