// which nav section is current; no dom, so it is unit tested

// a section is current once its top has passed this share of the window height
export const CURRENT_LINE = 0.4;

// index of the current section given each section's top in document order, or -1 above the first. at the page's end
// the last one is current, since a short footer never reaches the line
export function currentSection(tops: number[], viewport: number, atEnd: boolean): number {
  if (atEnd) return tops.length - 1;
  return tops.findLastIndex(top => top <= CURRENT_LINE * viewport);
}
