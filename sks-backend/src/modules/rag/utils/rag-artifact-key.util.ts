import { createHash } from 'crypto';

import type { SummaryLanguage } from '../types/rag.types';

export type RagArtifactType = 'summary' | 'study_gps';

export type RagArtifactMode =
  | 'default'
  | 'custom'
  | 'document_strict'
  | 'document_assisted'
  | 'general_chat';

export type RagArtifactCacheKeyInput = {
  artifactType: RagArtifactType;
  documentId: string;
  contentHash: string | null | undefined;
  language: SummaryLanguage;
  mode: RagArtifactMode;
  instruction?: string | null;
  artifactVersion: number;
  extra?: Record<string, string | number | boolean | null | undefined>;
};

export type RagArtifactCacheKey = {
  artifactType: RagArtifactType;
  documentId: string;
  contentHash: string;
  language: SummaryLanguage;
  mode: RagArtifactMode;
  instructionHash: string;
  artifactVersion: number;
  key: string;
};

export function hashArtifactInstruction(instruction?: string | null): string {
  const normalizedInstruction = (instruction ?? '')
    .replace(/\r\n/g, '\n')
    .trim();
  return createHash('sha256').update(normalizedInstruction).digest('hex');
}

export function buildArtifactCacheKey(
  input: RagArtifactCacheKeyInput,
): RagArtifactCacheKey {
  const contentHash =
    input.contentHash?.trim() || `document:${input.documentId}`;
  const instructionHash = hashArtifactInstruction(input.instruction);
  const keyPayload = [
    input.artifactType,
    input.documentId,
    contentHash,
    input.language,
    input.mode,
    instructionHash,
    String(input.artifactVersion),
    stableStringify(input.extra ?? {}),
  ].join('|');

  return {
    artifactType: input.artifactType,
    documentId: input.documentId,
    contentHash,
    language: input.language,
    mode: input.mode,
    instructionHash,
    artifactVersion: input.artifactVersion,
    key: createHash('sha256').update(keyPayload).digest('hex'),
  };
}

function stableStringify(
  value: Record<string, string | number | boolean | null | undefined>,
): string {
  return JSON.stringify(
    Object.keys(value)
      .sort()
      .reduce<Record<string, string | number | boolean | null | undefined>>(
        (accumulator, key) => {
          accumulator[key] = value[key];
          return accumulator;
        },
        {},
      ),
  );
}
