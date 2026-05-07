import { repairMojibakeText } from './text-encoding';

export function normalizeText(value: string | null | undefined): string {
  return repairMojibakeText(value).replace(/\s+/g, ' ').trim();
}

export function normalizeForSearch(value: string | null | undefined): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeComparisonText(value: string): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeSearchText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/[^\S\r\n]+/g, ' ')
    .trim();
}

export function truncateText(value: string, maxLength: number): string {
  const normalizedValue = normalizeText(value);

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

export function countWords(value: string): number {
  return normalizeText(value).split(/\s+/).filter(Boolean).length;
}
