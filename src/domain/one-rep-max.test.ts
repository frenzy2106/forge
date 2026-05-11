import { describe, it, expect } from 'vitest';
import { estimate1RM } from './one-rep-max';

// Epley e1RM = W * (1 + R/30).
// Plan 01-04 / research SUMMARY R2: Epley chosen for trend consistency. Cap at
// reps 30 (formula degrades sharply at very high reps). Reps must be a positive
// integer; weight must be non-negative.

describe('estimate1RM (Epley)', () => {
  it('matches formula at common rep counts', () => {
    // 40 * (1 + 8/30) = 40 * 38/30 = 1520/30 = 50.6667
    expect(estimate1RM(40, 8)).toBeCloseTo(50.6667, 3);
    // 100 * (1 + 1/30) = 100 * 31/30 = 103.3333
    expect(estimate1RM(100, 1)).toBeCloseTo(103.3333, 3);
    // 60 * (1 + 5/30) = 60 * 35/30 = 70
    expect(estimate1RM(60, 5)).toBeCloseTo(70, 3);
  });

  it('returns 0 for 0 weight (degenerate but valid)', () => {
    expect(estimate1RM(0, 5)).toBe(0);
  });

  it('throws on reps < 1', () => {
    expect(() => estimate1RM(40, 0)).toThrow();
    expect(() => estimate1RM(40, -1)).toThrow();
  });

  it('throws on reps > 30', () => {
    expect(() => estimate1RM(40, 31)).toThrow();
    expect(() => estimate1RM(40, 100)).toThrow();
  });

  it('throws on non-integer reps', () => {
    expect(() => estimate1RM(40, 5.5)).toThrow();
  });

  it('throws on negative weight', () => {
    expect(() => estimate1RM(-1, 5)).toThrow();
  });
});
