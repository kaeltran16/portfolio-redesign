import { afterEach, describe, expect, it, vi } from 'vitest';
import * as scene from '../lib/scene';
import * as shapes from '../lib/shapes';
import { boxTransform, CLOUD_SPREAD, startCloud } from './cloud';

const options = {
  theme: 'dark' as const,
  mode: scene.cloudMode(1440, 900, false),
  rows: [{ slug: 'arc', steps: 4 }],
};

describe('startCloud', () => {
  afterEach(() => vi.restoreAllMocks());

  it('throws webgl unavailable before three logs anything', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
    expect(() => startCloud(canvas, options)).toThrowError(new Error('webgl unavailable'));
    expect(error).not.toHaveBeenCalled();
  });
});

describe('boxTransform', () => {
  it('centres on the box and scales half its shorter side by the spread', () => {
    expect(boxTransform({ left: 100, top: 50, width: 680, height: 520 }, 1.6)).toEqual({ x: 440, y: 310, scale: 416 });
  });

  it('gives a zero-size box scale 0 and no NaN', () => {
    const box = boxTransform({ left: 10, top: 20, width: 0, height: 0 }, 1.6);
    expect(box).toEqual({ x: 10, y: 20, scale: 0 });
    expect(Object.values(box).some(Number.isNaN)).toBe(false);
  });

  // a siem shape inside 1 / spread is drawn under the opaque console
  it('keeps the halo beyond the visual it is drawn behind', () => {
    expect(shapes.HALO_INNER).toBeGreaterThan(1 / CLOUD_SPREAD);
  });
});

// vite does not type-check, so this guards the names cloud.ts imports from the other tasks
describe('cross-task imports', () => {
  it('resolve', () => {
    expect(typeof scene.cloudCursor).toBe('function');
    expect(typeof scene.cloudMode).toBe('function');
    expect(typeof shapes.buildTrack).toBe('function');
  });
});
