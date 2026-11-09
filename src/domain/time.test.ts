import { describe, expect, it } from 'vitest';
import { formatDetail, formatList, parseKstLocal, toKstLocal } from './time';

describe('한국 시간', () => {
  it('datetime-local 값을 호스트 시간대와 무관하게 KST로 해석한다', () => {
    expect(parseKstLocal('2026-11-08T21:40')).toBe('2026-11-08T12:40:00.000Z');
    expect(parseKstLocal('2026-02-30T10:00')).toBeNull();
    expect(parseKstLocal('')).toBeNull();
    expect(toKstLocal('2026-11-08T12:40:00.000Z')).toBe('2026-11-08T21:40');
  });
  it('상세·목록 형식', () => {
    const now = '2026-11-09T00:00:00.000Z';
    expect(formatDetail('2026-11-08T12:40:00.000Z', now)).toBe('11월 8일(일) 21:40');
    expect(formatList('2026-11-08T12:40:00.000Z', now)).toBe('11월 8일 21:40');
    expect(formatList('2025-11-08T12:40:00.000Z', now)).toBe('2025년 11월 8일 21:40');
  });
});
