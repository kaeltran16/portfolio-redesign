import { describe, expect, it } from 'vitest';
import { canPin, fillFraction, pinProgress, revealProgress, stepAt } from './scene';

describe('stepAt', () => {
  it.each([
    [0, 3, 1],
    [0.3333, 3, 1],
    [1 / 3, 3, 2],
    [2 / 3, 3, 3],
    [1, 3, 3],
    [-0.5, 3, 1],
    [1.5, 3, 3],
    [0.2499, 4, 1],
    [0.25, 4, 2],
    [0.75, 4, 4],
    [1, 4, 4],
    [0.5, 1, 1],
    [NaN, 3, 1],
  ])('progress %s over %s steps is step %s', (progress, steps, expected) => {
    expect(stepAt(progress, steps)).toBe(expected);
  });
});

describe('pinProgress', () => {
  it.each([
    [0, 3600, 900, 0],
    [100, 3600, 900, 0],
    [-1350, 3600, 900, 0.5],
    [-2700, 3600, 900, 1],
    [-5000, 3600, 900, 1],
    [-10, 800, 900, 1],
    [10, 800, 900, 0],
  ])('top %s, height %s, viewport %s is %s', (top, height, viewport, expected) => {
    expect(pinProgress(top, height, viewport)).toBe(expected);
  });
});

describe('revealProgress', () => {
  it.each([
    [800, 1000, 0],
    [900, 1000, 0],
    [500, 1000, 0.5],
    [200, 1000, 1],
    [0, 1000, 1],
  ])('centre %s in viewport %s is %s', (centre, viewport, expected) => {
    expect(revealProgress(centre, viewport)).toBeCloseTo(expected);
  });
});

describe('fillFraction', () => {
  it.each([
    [100, 200, 50, 0],
    [100, 200, 200, 0.5],
    [100, 200, 400, 1],
  ])('top %s, height %s, line %s is %s', (top, height, line, expected) => {
    expect(fillFraction(top, height, line)).toBe(expected);
  });

  it('treats an empty box as filled once the line passes it', () => {
    expect(fillFraction(100, 0, 50)).toBe(0);
    expect(fillFraction(100, 0, 100)).toBe(1);
  });
});

describe('canPin', () => {
  it.each([
    [1440, 900, 700, true],
    [1039, 900, 700, false],
    [1040, 900, 900, true],
    [1440, 600, 700, false],
  ])('width %s, height %s, content %s is %s', (width, height, content, expected) => {
    expect(canPin(width, height, content)).toBe(expected);
  });
});
