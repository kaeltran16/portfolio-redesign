// scroll-to-step math for the home scenes and the experience timeline; no dom, so it is unit tested

export const PIN_MIN_WIDTH = 1040;
// unpinned scenes play while the visual's centre moves from 80% to 20% of the viewport height
export const REVEAL_START = 0.8;
export const REVEAL_END = 0.2;
export const READING_LINE = 0.6;

// NaN counts as 0 so a not-yet-measured row reads as the first step
function clamp01(value: number): number {
  return Number.isNaN(value) ? 0 : Math.min(1, Math.max(0, value));
}

export function stepAt(progress: number, steps: number): number {
  return Math.min(steps, Math.floor(clamp01(progress) * steps) + 1);
}

// 0 until the row's top reaches the viewport top, 1 once its bottom reaches the viewport bottom
export function pinProgress(top: number, height: number, viewport: number): number {
  if (height <= viewport) return top <= 0 ? 1 : 0;
  return clamp01(-top / (height - viewport));
}

export function revealProgress(centre: number, viewport: number): number {
  return clamp01((REVEAL_START * viewport - centre) / ((REVEAL_START - REVEAL_END) * viewport));
}

// share of the box that is above `line`
export function fillFraction(top: number, height: number, line: number): number {
  if (height <= 0) return line < top ? 0 : 1;
  return clamp01((line - top) / height);
}

export function canPin(width: number, height: number, content: number): boolean {
  return width >= PIN_MIN_WIDTH && content <= height;
}
