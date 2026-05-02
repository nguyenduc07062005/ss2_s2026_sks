const WIN_1252_REVERSE_BYTES = new Map<string, number>([
  ['\u20ac', 0x80],
  ['\u201a', 0x82],
  ['\u0192', 0x83],
  ['\u201e', 0x84],
  ['\u2026', 0x85],
  ['\u2020', 0x86],
  ['\u2021', 0x87],
  ['\u02c6', 0x88],
  ['\u2030', 0x89],
  ['\u0160', 0x8a],
  ['\u2039', 0x8b],
  ['\u0152', 0x8c],
  ['\u017d', 0x8e],
  ['\u2018', 0x91],
  ['\u2019', 0x92],
  ['\u201c', 0x93],
  ['\u201d', 0x94],
  ['\u2022', 0x95],
  ['\u2013', 0x96],
  ['\u2014', 0x97],
  ['\u02dc', 0x98],
  ['\u2122', 0x99],
  ['\u0161', 0x9a],
  ['\u203a', 0x9b],
  ['\u0153', 0x9c],
  ['\u017e', 0x9e],
  ['\u0178', 0x9f],
]);

export function repairMojibakeText(value: string | null | undefined): string {
  let current = value ?? '';

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const currentScore = countMojibakeSignals(current);

    if (currentScore === 0) {
      break;
    }

    const decoded = decodeSingleByteMojibakeAsUtf8(current, false);

    if (decoded && countMojibakeSignals(decoded) < currentScore) {
      current = decoded;
      continue;
    }

    const lossyDecoded = decodeSingleByteMojibakeAsUtf8(current, true);
    const sanitizedLossyDecoded = stripResidualMojibakeArtifacts(lossyDecoded);

    if (
      sanitizedLossyDecoded &&
      sanitizedLossyDecoded !== current &&
      countMojibakeSignals(sanitizedLossyDecoded) < currentScore
    ) {
      current = sanitizedLossyDecoded;
      continue;
    }

    break;
  }

  return stripResidualMojibakeArtifacts(current);
}

export function hasMojibakeText(
  value: string | null | undefined,
  threshold = 2,
): boolean {
  return countMojibakeSignals(value ?? '') >= threshold;
}

export function countMojibakeSignals(value: string): number {
  return (
    value.match(
      /(?:\u00c3|\u00c2|\u00c4|\u00c6|\u00e1[\u00ba\u00bb]|\u00e2\u20ac|\ufffd|[\u0080-\u009f])/gu,
    )?.length ?? 0
  );
}

function decodeSingleByteMojibakeAsUtf8(
  value: string,
  allowReplacement: boolean,
): string | null {
  const bytes: number[] = [];

  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;

    if (codePoint <= 0xff) {
      bytes.push(codePoint);
      continue;
    }

    const win1252Byte = WIN_1252_REVERSE_BYTES.get(char);

    if (typeof win1252Byte === 'number') {
      bytes.push(win1252Byte);
      continue;
    }

    return null;
  }

  const decoded = Buffer.from(bytes).toString('utf8');

  if (!allowReplacement && decoded.includes('\ufffd')) {
    return null;
  }

  return decoded;
}

function stripResidualMojibakeArtifacts(
  value: string | null | undefined,
): string {
  if (!value) {
    return '';
  }

  return value
    .replace(/\ufffd+/g, ' ')
    .replace(/(?:^|\s)[\u00c2\u00c3\u00c4\u00c6](?=\s|$)/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
