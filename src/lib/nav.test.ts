import { describe, expect, it } from 'vitest';
import { currentSection } from './nav';

describe('currentSection', () => {
  it.each([
    ['above the first section', [900, 3000, 4000], false, -1],
    ['first section just short of the line', [136, 3000, 4000], false, -1],
    ['first section on the line', [135, 3000, 4000], false, 0],
    ['inside the first section', [-2000, 1000, 2000], false, 0],
    ['second section past the line', [-3000, 100, 1200], false, 1],
    ['every section past the line', [-3000, -1000, 0], false, 2],
    ['at the end before the last reaches the line', [-3000, -1000, 500], true, 2],
    ['no sections', [], false, -1],
  ])('%s', (_, tops, atEnd, expected) => {
    expect(currentSection(tops, 900, atEnd)).toBe(expected);
  });
});
