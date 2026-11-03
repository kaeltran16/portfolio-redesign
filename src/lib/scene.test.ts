import { describe, expect, it } from 'vitest';
import {
  CLOUD_COUNT,
  COMPACT_CLOUD_COUNT,
  canPin,
  cloudCursor,
  cloudMode,
  fillFraction,
  pinProgress,
  pinSpan,
  revealProgress,
  revealSpan,
  stepAt,
  trackAnchors,
} from './scene';

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

describe('cloudMode', () => {
  it('draws the full live cloud on a roomy desktop', () => {
    expect(cloudMode(1440, 900, false)).toEqual({ count: CLOUD_COUNT, push: true, live: true });
    expect(cloudMode(697, 697, false)).toEqual({ count: CLOUD_COUNT, push: true, live: true });
  });

  it.each([
    [390, 844],
    [1440, 650],
    [696, 900],
  ])('uses the compact cloud at %sx%s', (width, height) => {
    expect(cloudMode(width, height, false)).toEqual({ count: COMPACT_CLOUD_COUNT, push: false, live: true });
  });

  it.each([
    [1440, 900, CLOUD_COUNT],
    [390, 844, COMPACT_CLOUD_COUNT],
  ])('is still and has no push under reduced motion at %sx%s', (width, height, count) => {
    expect(cloudMode(width, height, true)).toEqual({ count, push: false, live: false });
  });
});

describe('pinSpan', () => {
  const scrolls = [0, 300, 1350, 2700, 5000];

  it.each([
    [500, 3600, 900],
    [-200, 3600, 900],
    [100, 800, 900],
    [-100, 800, 900],
    [0, 900, 900],
  ])('agrees with pinProgress for top %s, height %s, viewport %s', (top, height, viewport) => {
    const scroll = 1000;
    const { start, end } = pinSpan(top, height, viewport, scroll);
    for (const s of scrolls) {
      const moved = pinProgress(top - (s - scroll), height, viewport);
      const fromSpan = end === start ? (s >= start ? 1 : 0) : Math.min(1, Math.max(0, (s - start) / (end - start)));
      expect(fromSpan).toBeCloseTo(moved);
    }
  });

  it('collapses to one scroll position when the row fits the viewport', () => {
    const { start, end } = pinSpan(100, 800, 900, 1000);
    expect(start).toBe(1100);
    expect(end).toBe(1100);
  });

  it('runs over height minus viewport of scroll', () => {
    expect(pinSpan(500, 3600, 900, 1000)).toEqual({ start: 1500, end: 4200 });
  });
});

describe('revealSpan', () => {
  it.each([
    [800, 1000],
    [500, 1000],
    [100, 1000],
  ])('agrees with revealProgress for centre %s, viewport %s', (centre, viewport) => {
    const scroll = 700;
    const { start, end } = revealSpan(centre, viewport, scroll);
    for (const s of [0, 400, 700, 1000, 1500, 3000]) {
      const moved = revealProgress(centre - (s - scroll), viewport);
      const fromSpan = Math.min(1, Math.max(0, (s - start) / (end - start)));
      expect(fromSpan).toBeCloseTo(moved);
    }
  });
});

describe('trackAnchors', () => {
  const rows = [
    { start: 1000, end: 2000, steps: 4 },
    { start: 3000, end: 3600, steps: 3 },
  ];

  it('has sphere, every step and settle, from 0 to settleAt', () => {
    const anchors = trackAnchors(rows, 5000);
    expect(anchors).toHaveLength(2 + 4 + 3);
    expect(anchors[0]).toBe(0);
    expect(anchors[anchors.length - 1]).toBe(5000);
  });

  it('places step k at the middle of its share of the row span', () => {
    const anchors = trackAnchors(rows, 5000);
    for (let k = 1; k <= 4; k++) expect(anchors[k]).toBeCloseTo(1000 + ((k - 0.5) / 4) * 1000);
    for (let k = 1; k <= 3; k++) expect(anchors[4 + k]).toBeCloseTo(3000 + ((k - 0.5) / 3) * 600);
  });

  it('never decreases when rows overlap or settle is early', () => {
    const anchors = trackAnchors(
      [
        { start: 1000, end: 2000, steps: 2 },
        { start: 1200, end: 1800, steps: 2 },
      ],
      500,
    );
    for (let i = 1; i < anchors.length; i++) expect(anchors[i]).toBeGreaterThanOrEqual(anchors[i - 1]);
  });
});

describe('cloudCursor', () => {
  const anchors = [0, 100, 300, 300, 700];

  it('returns the index at each distinct anchor', () => {
    expect(cloudCursor(0, anchors)).toBe(0);
    expect(cloudCursor(100, anchors)).toBe(1);
    expect(cloudCursor(700, anchors)).toBe(4);
  });

  it('is fractional between distinct anchors', () => {
    expect(cloudCursor(50, anchors)).toBeCloseTo(0.5);
    expect(cloudCursor(200, anchors)).toBeCloseTo(1.5);
    expect(cloudCursor(500, anchors)).toBeCloseTo(3.5);
  });

  it('clamps outside the track', () => {
    expect(cloudCursor(-50, anchors)).toBe(0);
    expect(cloudCursor(5000, anchors)).toBe(4);
  });

  it('takes the higher index once scroll reaches equal anchors, without NaN', () => {
    expect(cloudCursor(299, anchors)).toBeLessThan(2);
    expect(cloudCursor(300, anchors)).toBe(3);
    expect(Number.isNaN(cloudCursor(300, anchors))).toBe(false);
  });

  it('works with no rows', () => {
    expect(cloudCursor(250, [0, 500])).toBeCloseTo(0.5);
  });
});

describe('canPin', () => {
  it.each([
    [1440, 900, 700, true],
    [1039, 900, 700, false],
    [1040, 900, 900, false],
    [1041, 900, 900, true],
    [1440, 600, 700, false],
  ])('width %s, height %s, content %s is %s', (width, height, content, expected) => {
    expect(canPin(width, height, content)).toBe(expected);
  });
});
