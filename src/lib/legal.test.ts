import { describe, expect, it } from 'vitest';
import { ageOn, donorAgeProblem, donorBirthDateRange } from './legal';
import { donorAgeProblem as apiRule } from '../../server/src/utils/legal';

// 03:00 on 18 October 2026 in India, still 17 October in UTC
const NOW = new Date('2026-10-17T21:30:00Z');

describe('donor age (NBTC: 18 to 65)', () => {
  it('counts birthdays in India time', () => {
    expect(ageOn('2008-10-18', NOW)).toBe(18);
    expect(ageOn('2008-10-19', NOW)).toBe(17);
    expect(ageOn('2026-02-30', NOW)).toBeNull();
  });

  it('says what is wrong', () => {
    expect(donorAgeProblem('', NOW)).toBe('Enter your date of birth.');
    expect(donorAgeProblem('2026-02-30', NOW)).toBe('Enter a real date of birth.');
    expect(donorAgeProblem('2010-01-01', NOW)).toMatch(/at least 18/);
    expect(donorAgeProblem('1960-01-01', NOW)).toMatch(/at most 65/);
    expect(donorAgeProblem('1990-05-05', NOW)).toBeNull();
  });

  it('gives the same answer as the API for every birth date around both limits', () => {
    const day = Date.UTC(1960, 9, 1);
    for (let i = 0; i < 60; i++) {
      for (const base of [day, Date.UTC(2008, 9, 1)]) {
        const dob = new Date(base + i * 86400000).toISOString().slice(0, 10);
        expect(donorAgeProblem(dob, NOW), dob).toBe(apiRule(dob, NOW));
      }
    }
  });

  it('limits the date picker to the birth dates that pass', () => {
    expect(donorBirthDateRange(NOW)).toEqual({ min: '1960-10-19', max: '2008-10-18' });
    // On 29 February: someone born on 1 March 1962 is 65 until tomorrow
    expect(donorBirthDateRange(new Date('2028-02-29T06:00:00Z'))).toEqual({ min: '1962-03-01', max: '2010-02-28' });
    const { min, max } = donorBirthDateRange(NOW);
    expect(donorAgeProblem(min, NOW)).toBeNull();
    expect(donorAgeProblem(max, NOW)).toBeNull();
  });
});
