import {
  normalizeComparisonText,
  normalizeForSearch,
} from './text-normalization.util';

describe('text normalization utilities', () => {
  it('normalizes Vietnamese diacritics and d-stroke for search', () => {
    expect(normalizeForSearch('Đường dẫn dữ liệu')).toBe('duong dan du lieu');
  });

  it('keeps comparison text accent-insensitive for Vietnamese queries', () => {
    expect(normalizeComparisonText('Chủ đề Đồ án')).toBe('chu de do an');
  });
});
