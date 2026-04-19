import { jsonrepair } from 'jsonrepair';

export const extractJsonCandidate = (rawResponse: string): string => {
  const trimmedResponse = rawResponse.trim();
  const fencedMatch = trimmedResponse.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fencedMatch?.[1]?.trim()) {
    return fencedMatch[1].trim();
  }

  const objectStart = trimmedResponse.indexOf('{');
  const arrayStart = trimmedResponse.indexOf('[');
  const hasObject = objectStart >= 0;
  const hasArray = arrayStart >= 0;

  if (!hasObject && !hasArray) {
    return trimmedResponse;
  }

  const prefersObject =
    hasObject && (!hasArray || objectStart <= arrayStart);
  const startIndex = prefersObject ? objectStart : arrayStart;
  const openChar = prefersObject ? '{' : '[';
  const closeChar = prefersObject ? '}' : ']';
  const balancedSlice = extractBalancedSlice(
    trimmedResponse,
    startIndex,
    openChar,
    closeChar,
  );

  if (balancedSlice) {
    return balancedSlice;
  }

  const lastCloseIndex = trimmedResponse.lastIndexOf(closeChar);

  if (lastCloseIndex > startIndex) {
    return trimmedResponse.slice(startIndex, lastCloseIndex + 1).trim();
  }

  return trimmedResponse.slice(startIndex).trim();
};

export const parseJsonWithRepair = <T>(rawResponse: string): T => {
  const candidate = extractJsonCandidate(rawResponse);

  try {
    return JSON.parse(candidate) as T;
  } catch {
    const repaired = jsonrepair(candidate);
    return JSON.parse(repaired) as T;
  }
};

const extractBalancedSlice = (
  value: string,
  startIndex: number,
  openChar: string,
  closeChar: string,
): string | null => {
  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = startIndex; index < value.length; index += 1) {
    const currentChar = value[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (currentChar === '\\') {
        isEscaped = true;
        continue;
      }

      if (currentChar === '"') {
        inString = false;
      }

      continue;
    }

    if (currentChar === '"') {
      inString = true;
      continue;
    }

    if (currentChar === openChar) {
      depth += 1;
      continue;
    }

    if (currentChar === closeChar) {
      depth -= 1;

      if (depth === 0) {
        return value.slice(startIndex, index + 1).trim();
      }
    }
  }

  return null;
};
