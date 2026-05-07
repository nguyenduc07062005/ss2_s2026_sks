import { DataSource } from 'typeorm';

export type RawRow = Record<string, unknown>;

export async function runRawQuery(
  dataSource: DataSource,
  sql: string,
  params: unknown[],
): Promise<RawRow[]> {
  const result = (await dataSource.query(sql, params)) as unknown;

  if (!Array.isArray(result)) {
    return [];
  }

  return result.filter((row): row is RawRow => isRawRow(row));
}

export function isRawRow(value: unknown): value is RawRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readRequiredString(row: RawRow, key: string): string {
  const value = row[key];

  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  throw new Error(`Expected string value for ${key}`);
}

export function readString(row: RawRow, key: string, fallback = ''): string {
  const value = row[key];

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return fallback;
}

export function readNullableString(row: RawRow, key: string): string | null {
  const value = row[key];

  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    return trimmedValue ? trimmedValue : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

export function readNumber(row: RawRow, key: string, fallback = 0): number {
  const value = row[key];

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

export function readNullableNumber(row: RawRow, key: string): number | null {
  const value = row[key];

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}
