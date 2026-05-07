import pgvector from 'pgvector';
import { SummaryLanguage, SummaryVersionSlot } from './types/rag.types';

export function getLanguageName(language: SummaryLanguage): string {
  return language === 'vi' ? 'Vietnamese' : 'English';
}

export function normalizeInstruction(
  instruction?: string | null,
): string | null {
  if (!instruction) {
    return null;
  }

  const normalizedInstruction = instruction.replace(/\r\n/g, '\n').trim();
  return normalizedInstruction ? normalizedInstruction : null;
}

export function normalizeSlot(
  slot?: SummaryVersionSlot,
): SummaryVersionSlot | undefined {
  if (slot === 'custom' || slot === 'default') {
    return slot;
  }

  return undefined;
}

export function resolveSelectedSlot(
  activeSlot: SummaryVersionSlot | undefined,
  versions: Partial<Record<SummaryVersionSlot, unknown>> | undefined,
  requestedSlot?: SummaryVersionSlot,
): SummaryVersionSlot | null {
  if (!versions) {
    return null;
  }

  if (requestedSlot && versions[requestedSlot]) {
    return requestedSlot;
  }

  if (activeSlot && versions[activeSlot]) {
    return activeSlot;
  }

  if (versions.default) {
    return 'default';
  }

  if (versions.custom) {
    return 'custom';
  }

  return null;
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function toErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }

  return undefined;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }

  const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const sizeIndex = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${parseFloat((bytes / 1024 ** sizeIndex).toFixed(2))} ${units[sizeIndex]}`;
}

export function toVectorSql(embedding: number[]): string {
  return pgvector.toSql(embedding) as string;
}

export function buildInstructionBlock(instruction?: string | null): string {
  if (!instruction) {
    return 'No additional user instruction.';
  }

  return instruction;
}

export function normalizeConversationText(value: unknown): string {
  const rawValue =
    typeof value === 'string'
      ? value
      : typeof value === 'number' ||
          typeof value === 'boolean' ||
          typeof value === 'bigint'
        ? String(value)
        : '';

  return rawValue.replace(/\s+/g, ' ').trim();
}

export function truncateConversationText(
  value: unknown,
  maxLength = 280,
): string {
  const normalizedValue = normalizeConversationText(value);

  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  const roughSlice = normalizedValue.slice(0, maxLength).trimEnd();
  const lastWordBoundary = roughSlice.lastIndexOf(' ');
  const safeSlice =
    lastWordBoundary > Math.floor(maxLength / 2)
      ? roughSlice.slice(0, lastWordBoundary)
      : roughSlice;

  return `${safeSlice}...`;
}
