// scroll-to-step math for the home scenes and the experience timeline; no dom, so it is unit tested

// global.css stacks rows at max-width: 1040px, so pinning starts just above it
export const STACK_MAX_WIDTH = 1040;
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

// scroll positions over which a row's progress runs 0 -> 1; the same maths as pinProgress and revealProgress
export type Span = { start: number; end: number };

export function pinSpan(top: number, height: number, viewport: number, scroll: number): Span {
  const start = scroll + top;
  return { start, end: start + Math.max(0, height - viewport) };
}

export function revealSpan(centre: number, viewport: number, scroll: number): Span {
  return {
    start: scroll + centre - REVEAL_START * viewport,
    end: scroll + centre - REVEAL_END * viewport,
  };
}

// global.css: @media (max-width: 696px), (max-height: 696px)
export const COMPACT_MAX = 696;
export const CLOUD_COUNT = 6000;
export const COMPACT_CLOUD_COUNT = 1500;

export type CloudMode = { count: number; push: boolean; live: boolean };

export function cloudMode(width: number, height: number, reduceMotion: boolean): CloudMode {
  const compact = width <= COMPACT_MAX || height <= COMPACT_MAX;
  const live = !reduceMotion;
  return { count: compact ? COMPACT_CLOUD_COUNT : CLOUD_COUNT, push: live && !compact, live };
}

// shape index 0 is the sphere, then one per row step in page order, then settle
export function trackAnchors(rows: (Span & { steps: number })[], settleAt: number): number[] {
  const anchors = [0];
  for (const { start, end, steps } of rows) {
    for (let k = 1; k <= steps; k++) anchors.push(start + ((k - 0.5) / steps) * (end - start));
  }
  anchors.push(settleAt);
  for (let i = 1; i < anchors.length; i++) anchors[i] = Math.max(anchors[i], anchors[i - 1]);
  return anchors;
}

// integer = exactly one shape, fraction = a morph toward the next
export function cloudCursor(scroll: number, anchors: number[]): number {
  const last = anchors.length - 1;
  if (last < 1 || scroll < anchors[0]) return 0;
  if (scroll >= anchors[last]) return last;
  let i = 0;
  while (anchors[i + 1] <= scroll) i++;
  return i + (scroll - anchors[i]) / (anchors[i + 1] - anchors[i]);
}

export function canPin(width: number, height: number, content: number): boolean {
  return width > STACK_MAX_WIDTH && content <= height;
}
