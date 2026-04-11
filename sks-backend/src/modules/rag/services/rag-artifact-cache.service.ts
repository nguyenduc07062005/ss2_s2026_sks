import { Injectable } from '@nestjs/common';
import { Document } from 'src/database/entities/document.entity';
import { DocumentRepository } from 'src/database/repositories/document.repository';
import {
  DiagramArtifact,
  DocumentArtifactCache,
  MindMapArtifact,
  SummaryArtifact,
  SummaryLanguage,
} from '../types/rag.types';

@Injectable()
export class RagArtifactCacheService {
  constructor(private readonly documentRepository: DocumentRepository) {}

  getSummary(
    document: Document,
    language: SummaryLanguage,
  ): SummaryArtifact | null {
    return (
      this.getArtifactCache(document).summaryByLanguage?.[language] ?? null
    );
  }

  async saveSummary(
    document: Document,
    summary: SummaryArtifact,
  ): Promise<void> {
    await this.saveArtifactCache(document, {
      summaryByLanguage: {
        [summary.language]: summary,
      },
    });
  }

  getMindMap(
    document: Document,
    language: SummaryLanguage,
  ): MindMapArtifact | null {
    return (
      this.getArtifactCache(document).mindMapByLanguage?.[language] ?? null
    );
  }

  async saveMindMap(
    document: Document,
    mindMap: MindMapArtifact,
  ): Promise<void> {
    await this.saveArtifactCache(document, {
      mindMapByLanguage: {
        [mindMap.summaryLanguage]: mindMap,
      },
    });
  }

  getDiagram(document: Document): DiagramArtifact | null {
    return this.getArtifactCache(document).diagram ?? null;
  }

  async saveDiagram(
    document: Document,
    diagram: DiagramArtifact,
  ): Promise<void> {
    await this.saveArtifactCache(document, { diagram });
  }

  private getArtifactCache(document: Document): DocumentArtifactCache {
    const rawExtraAttributes = document.extraAttributes;

    if (
      !rawExtraAttributes ||
      typeof rawExtraAttributes !== 'object' ||
      Array.isArray(rawExtraAttributes)
    ) {
      return {};
    }

    const normalizedExtraAttributes = rawExtraAttributes as Record<
      string,
      unknown
    >;
    const artifactCache = normalizedExtraAttributes.aiArtifacts;

    if (
      artifactCache &&
      typeof artifactCache === 'object' &&
      !Array.isArray(artifactCache)
    ) {
      return artifactCache as DocumentArtifactCache;
    }

    return {};
  }

  private async saveArtifactCache(
    document: Document,
    patch: Partial<DocumentArtifactCache>,
  ): Promise<void> {
    const baseExtraAttributes =
      document.extraAttributes &&
      typeof document.extraAttributes === 'object' &&
      !Array.isArray(document.extraAttributes)
        ? document.extraAttributes
        : {};
    const currentArtifacts = this.getArtifactCache(document);
    const nextArtifacts: DocumentArtifactCache = {
      ...currentArtifacts,
      ...patch,
      summaryByLanguage: {
        ...(currentArtifacts.summaryByLanguage ?? {}),
        ...(patch.summaryByLanguage ?? {}),
      },
      mindMapByLanguage: {
        ...(currentArtifacts.mindMapByLanguage ?? {}),
        ...(patch.mindMapByLanguage ?? {}),
      },
    };
    const nextExtraAttributes: Document['extraAttributes'] = {
      ...baseExtraAttributes,
      aiArtifacts: nextArtifacts,
    };

    document.extraAttributes = nextExtraAttributes;
    await this.documentRepository.getRepository().update(document.id, {
      extraAttributes: nextExtraAttributes,
    });
  }
}
