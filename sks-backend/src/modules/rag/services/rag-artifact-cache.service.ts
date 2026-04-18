import { Injectable } from '@nestjs/common';
import { Document } from 'src/database/entities/document.entity';
import { UserDocument } from 'src/database/entities/user-document.entity';
import { DocumentRepository } from 'src/database/repositories/document.repository';
import { UserDocumentRepository } from 'src/database/repositories/user-document.repository';
import {
  DiagramArtifact,
  DocumentArtifactCache,
  MindMapArtifact,
  RagSource,
  SummaryArtifact,
  SummaryFormat,
  SummaryLanguage,
  SummaryLanguageCache,
  SummaryVersionSlot,
  SUMMARY_FORMATS,
  SUMMARY_LANGUAGES,
  SUMMARY_VERSION_SLOTS,
} from '../types/rag.types';

type ArtifactOwner =
  | Pick<Document, 'extraAttributes'>
  | Pick<UserDocument, 'extraAttributes'>
  | null
  | undefined;

@Injectable()
export class RagArtifactCacheService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly userDocumentRepository: UserDocumentRepository,
  ) {}

  getSummaryState(
    userDocument: UserDocument,
    language: SummaryLanguage,
    fallbackDocument?: Document,
  ): SummaryLanguageCache | null {
    const userSummaryState = this.getNormalizedSummaryState(
      this.getArtifactCache(userDocument).summaryByLanguage?.[language],
      language,
    );
    const fallbackSummaryState = this.getNormalizedSummaryState(
      this.getArtifactCache(fallbackDocument).summaryByLanguage?.[language],
      language,
    );

    return this.mergeSummaryStates(fallbackSummaryState, userSummaryState);
  }

  async saveSummary(
    userDocument: UserDocument,
    summary: SummaryArtifact,
    fallbackDocument?: Document,
  ): Promise<void> {
    const currentSummaryState =
      this.getSummaryState(userDocument, summary.language, fallbackDocument) ??
      null;
    const nextSummaryState: SummaryLanguageCache = {
      activeSlot: summary.slot,
      versions: {
        ...(currentSummaryState?.versions ?? {}),
        [summary.slot]: summary,
      },
    };

    await this.saveUserDocumentArtifactCache(userDocument, {
      summaryByLanguage: {
        [summary.language]: nextSummaryState,
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
    await this.saveDocumentArtifactCache(document, {
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
    await this.saveDocumentArtifactCache(document, { diagram });
  }

  private getArtifactCache(owner: ArtifactOwner): DocumentArtifactCache {
    const rawExtraAttributes = owner?.extraAttributes;

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

  private async saveDocumentArtifactCache(
    document: Document,
    patch: Partial<DocumentArtifactCache>,
  ): Promise<void> {
    const nextExtraAttributes = this.buildNextExtraAttributes(
      document.extraAttributes,
      this.getArtifactCache(document),
      patch,
    );

    document.extraAttributes = nextExtraAttributes;
    await this.documentRepository.getRepository().update(document.id, {
      extraAttributes: nextExtraAttributes,
    });
  }

  private async saveUserDocumentArtifactCache(
    userDocument: UserDocument,
    patch: Partial<DocumentArtifactCache>,
  ): Promise<void> {
    const nextExtraAttributes = this.buildNextExtraAttributes(
      userDocument.extraAttributes,
      this.getArtifactCache(userDocument),
      patch,
    );

    userDocument.extraAttributes = nextExtraAttributes;
    await this.userDocumentRepository.getRepository().update(userDocument.id, {
      extraAttributes: nextExtraAttributes,
    });
  }

  private buildNextExtraAttributes(
    currentExtraAttributes: Record<string, any> | null | undefined,
    currentArtifacts: DocumentArtifactCache,
    patch: Partial<DocumentArtifactCache>,
  ): Record<string, any> {
    const baseExtraAttributes =
      currentExtraAttributes &&
      typeof currentExtraAttributes === 'object' &&
      !Array.isArray(currentExtraAttributes)
        ? currentExtraAttributes
        : {};
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

    return {
      ...baseExtraAttributes,
      aiArtifacts: nextArtifacts,
    };
  }

  private getNormalizedSummaryState(
    value: unknown,
    language: SummaryLanguage,
  ): SummaryLanguageCache | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const candidate = value as Record<string, unknown>;
    const rawVersions =
      candidate.versions &&
      typeof candidate.versions === 'object' &&
      !Array.isArray(candidate.versions)
        ? (candidate.versions as Record<string, unknown>)
        : null;

    const defaultVersion = this.coerceSummaryArtifact(
      rawVersions?.default ?? value,
      language,
      'default',
    );
    const customVersion = this.coerceSummaryArtifact(
      rawVersions?.custom,
      language,
      'custom',
    );

    if (!defaultVersion && !customVersion) {
      return null;
    }

    const versions: SummaryLanguageCache['versions'] = {};

    if (defaultVersion) {
      versions.default = defaultVersion;
    }

    if (customVersion) {
      versions.custom = customVersion;
    }

    return {
      activeSlot: this.resolveActiveSlot(candidate.activeSlot, versions),
      versions,
    };
  }

  private mergeSummaryStates(
    baseState: SummaryLanguageCache | null,
    overrideState: SummaryLanguageCache | null,
  ): SummaryLanguageCache | null {
    const versions: SummaryLanguageCache['versions'] = {
      ...(baseState?.versions ?? {}),
      ...(overrideState?.versions ?? {}),
    };

    if (!versions.default && !versions.custom) {
      return null;
    }

    return {
      activeSlot: this.resolveActiveSlot(
        overrideState?.activeSlot ?? baseState?.activeSlot,
        versions,
      ),
      versions,
    };
  }

  private coerceSummaryArtifact(
    value: unknown,
    fallbackLanguage: SummaryLanguage,
    fallbackSlot: SummaryVersionSlot,
  ): SummaryArtifact | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const candidate = value as Record<string, unknown>;
    const title =
      typeof candidate.title === 'string' ? candidate.title.trim() : '';
    const overview =
      typeof candidate.overview === 'string' ? candidate.overview.trim() : '';
    const conclusion =
      typeof candidate.conclusion === 'string'
        ? candidate.conclusion.trim()
        : '';
    const format = this.isSummaryFormat(candidate.format)
      ? candidate.format
      : 'structured';
    const body =
      typeof candidate.body === 'string' ? candidate.body.trim() : '';
    const keyPoints = Array.isArray(candidate.key_points)
      ? candidate.key_points.filter(
          (point): point is string => typeof point === 'string',
        )
      : [];

    if (!title && !overview && !conclusion && !body && keyPoints.length === 0) {
      return null;
    }

    return {
      title,
      overview,
      key_points: keyPoints,
      conclusion,
      format,
      body: body || null,
      language: this.isSummaryLanguage(candidate.language)
        ? candidate.language
        : fallbackLanguage,
      generatedAt:
        typeof candidate.generatedAt === 'string' && candidate.generatedAt
          ? candidate.generatedAt
          : new Date().toISOString(),
      sources: this.coerceSources(candidate.sources),
      version:
        typeof candidate.version === 'number' ? candidate.version : undefined,
      slot: this.isSummarySlot(candidate.slot) ? candidate.slot : fallbackSlot,
      instruction:
        typeof candidate.instruction === 'string'
          ? candidate.instruction
          : null,
    };
  }

  private coerceSources(value: unknown): RagSource[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return null;
        }

        const candidate = item as Record<string, unknown>;

        if (
          typeof candidate.documentId !== 'string' ||
          typeof candidate.documentName !== 'string' ||
          typeof candidate.chunkIndex !== 'number' ||
          typeof candidate.snippet !== 'string' ||
          typeof candidate.score !== 'number'
        ) {
          return null;
        }

        return {
          documentId: candidate.documentId,
          documentName: candidate.documentName,
          chunkIndex: candidate.chunkIndex,
          pageNumber:
            typeof candidate.pageNumber === 'number'
              ? candidate.pageNumber
              : null,
          snippet: candidate.snippet,
          score: candidate.score,
        } satisfies RagSource;
      })
      .filter((item): item is RagSource => Boolean(item));
  }

  private resolveActiveSlot(
    rawActiveSlot: unknown,
    versions: SummaryLanguageCache['versions'],
  ): SummaryVersionSlot {
    if (this.isSummarySlot(rawActiveSlot) && versions?.[rawActiveSlot]) {
      return rawActiveSlot;
    }

    if (versions?.custom) {
      return 'custom';
    }

    return 'default';
  }

  private isSummaryLanguage(value: unknown): value is SummaryLanguage {
    return (
      typeof value === 'string' &&
      (SUMMARY_LANGUAGES as readonly string[]).includes(value)
    );
  }

  private isSummarySlot(value: unknown): value is SummaryVersionSlot {
    return (
      typeof value === 'string' &&
      (SUMMARY_VERSION_SLOTS as readonly string[]).includes(value)
    );
  }

  private isSummaryFormat(value: unknown): value is SummaryFormat {
    return (
      typeof value === 'string' &&
      (SUMMARY_FORMATS as readonly string[]).includes(value)
    );
  }
}
