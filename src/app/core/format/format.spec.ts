import { formatSle, isoDate, maskTail } from './format';

describe('formatters', () => {
  it('formats money as "SLE 1,200.00"', () => {
    expect(formatSle(1200)).toBe('SLE 1,200.00');
    expect(formatSle(24840.5)).toBe('SLE 24,840.50');
    expect(formatSle(-240)).toBe('-SLE 240.00');
    expect(formatSle(null)).toBe('—');
  });

  it('masks local values but passes API-masked ones through', () => {
    expect(maskTail('352099001761481')).toBe('•••••••••••1481');
    expect(maskTail('***********3809')).toBe('***********3809');
    expect(maskTail('+232 ** *** 3456')).toBe('+232 ** *** 3456');
  });

  it('formats date-only values as YYYY-MM-DD', () => {
    expect(isoDate(new Date(2026, 10, 3))).toBe('2026-11-03');
  });
});
