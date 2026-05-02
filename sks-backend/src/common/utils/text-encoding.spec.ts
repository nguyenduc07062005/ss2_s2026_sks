import {
  countMojibakeSignals,
  hasMojibakeText,
  repairMojibakeText,
} from './text-encoding';

describe('text encoding utilities', () => {
  it('repairs common Vietnamese UTF-8 mojibake', () => {
    const repaired = repairMojibakeText(
      'Ng\u00e1\u00bb\u00af c\u00e1\u00ba\u00a3nh tr\u00c3\u00adch xu\u00e1\u00ba\u00a5t.',
    );

    expect(repaired).toBe('Ngữ cảnh trích xuất.');
    expect(hasMojibakeText(repaired)).toBe(false);
  });

  it('strips residual broken mojibake bytes when the source lost characters', () => {
    const repaired = repairMojibakeText(
      'Ng\u00e1\u00bb\u00af c\u00e1\u00ba\u00a3nh tr\u00c3\u00adch xu\u00e1\u00ba\u00a5t t\u00e1\u00bb\u00ab t\u00c3 i li\u00e1\u00bb\u2021u ch\u00c6\u00b0a \u00c4\u2018\u00e1\u00bb\u00a7 r\u00c3\u00b5 \u00c4\u2018\u00e1\u00bb\u0192 r\u00c3\u00bat ra to\u00c3 n b\u00e1\u00bb\u2122 \u00c3\u00bd ch\u00c3\u00adnh.',
    );

    expect(repaired).toContain('Ngữ cảnh trích xuất');
    expect(repaired).toContain('liệu chưa đủ rõ');
    expect(countMojibakeSignals(repaired)).toBe(0);
  });

  it('does not treat valid Vietnamese diacritics as mojibake', () => {
    const text = 'Mã hóa dữ liệu cần cân bằng giữa tốc độ và độ an toàn.';

    expect(repairMojibakeText(text)).toBe(text);
    expect(countMojibakeSignals(text)).toBe(0);
  });
});
