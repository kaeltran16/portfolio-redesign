import { describe, expect, it } from 'vitest';
import { isPageChange } from './transition';

const home = new URL('https://example.com/');
const arc = new URL('https://example.com/projects/arc/');

describe('isPageChange', () => {
  it.each([
    ['home to a case page', home, arc, true],
    ['a case page to a home section', arc, new URL('https://example.com/#about'), true],
    ['an html file', home, new URL('https://example.com/old.html'), true],
    ['a section on the same page', home, new URL('https://example.com/#experience'), false],
    ['the same page with a query', arc, new URL('https://example.com/projects/arc/?x=1'), false],
    ['the cv download', home, new URL('https://example.com/cv.pdf'), false],
    ['another site', home, new URL('https://github.com/kaeltran16'), false],
  ])('%s', (_, here, to, expected) => {
    expect(isPageChange(to, here)).toBe(expected);
  });
});
