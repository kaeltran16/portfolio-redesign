import { describe, expect, it } from 'vitest';
import { buildTrack } from './shapes';

const ROWS = [
  { slug: 'arc', steps: 4 },
  { slug: 'siem', steps: 6 },
  { slug: 'opal', steps: 4 },
];
const COUNT = 1500;
const track = buildTrack(ROWS, COUNT);

function shapeOf(name: string, from = track): Float32Array {
  const index = from.names.indexOf(name);
  if (index < 0) throw new Error(`no shape ${name}`);
  return from.shapes[index];
}

function presentIndices(shape: Float32Array): number[] {
  const indices: number[] = [];
  for (let i = 0; i < shape.length / 4; i++) if (shape[i * 4 + 3] > 0.5) indices.push(i);
  return indices;
}

function largestGap(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  let gap = 0;
  for (let i = 1; i < sorted.length; i++) gap = Math.max(gap, sorted[i] - sorted[i - 1]);
  return gap;
}

function xs(shape: Float32Array): number[] {
  return presentIndices(shape).map(i => shape[i * 4]);
}

describe('buildTrack', () => {
  it('names the sphere, every row step in order, then the settle', () => {
    expect(track.names).toEqual([
      'sphere',
      'arc-1', 'arc-2', 'arc-3', 'arc-4',
      'siem-1', 'siem-2', 'siem-3', 'siem-4', 'siem-5', 'siem-6',
      'opal-1', 'opal-2', 'opal-3', 'opal-4',
      'settle',
    ]);
    expect(track.shapes).toHaveLength(track.names.length);
    for (const shape of track.shapes) expect(shape).toHaveLength(COUNT * 4);
  });

  it('keeps positions in [-1, 1] and presence in [0, 1]', () => {
    for (const shape of track.shapes) {
      for (let i = 0; i < COUNT; i++) {
        for (let axis = 0; axis < 3; axis++) {
          expect(Math.abs(shape[i * 4 + axis])).toBeLessThanOrEqual(1);
        }
        expect(shape[i * 4 + 3]).toBeGreaterThanOrEqual(0);
        expect(shape[i * 4 + 3]).toBeLessThanOrEqual(1);
      }
    }
  });

  it('gives the sphere unit directions, all present', () => {
    const sphere = shapeOf('sphere');
    for (let i = 0; i < COUNT; i++) {
      const [x, y, z, presence] = sphere.subarray(i * 4, i * 4 + 4);
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
      expect(presence).toBe(1);
    }
  });

  it.each([1500, 6000])('keeps 3-5%% of %s particles through the siem triage cut', count => {
    const siem = buildTrack(ROWS, count);
    const survivors = presentIndices(shapeOf('siem-5', siem));
    expect(survivors.length / count).toBeGreaterThanOrEqual(0.03);
    expect(survivors.length / count).toBeLessThanOrEqual(0.05);
    expect(presentIndices(shapeOf('siem-6', siem))).toEqual(survivors);
    for (const step of [1, 2, 3, 4]) {
      expect(presentIndices(shapeOf(`siem-${step}`, siem))).toHaveLength(count);
    }
  });

  it('splits arc workers into lanes and merges them into one trunk', () => {
    expect(largestGap(xs(shapeOf('arc-2')))).toBeGreaterThanOrEqual(0.2);
    expect(largestGap(xs(shapeOf('arc-4')))).toBeLessThanOrEqual(0.1);
  });

  it('draws every opal screen inside a 250:510 phone, each one different', () => {
    const screens = [1, 2, 3, 4].map(step => shapeOf(`opal-${step}`));
    for (const screen of screens) {
      const present = presentIndices(screen);
      const x = present.map(i => screen[i * 4]);
      const y = present.map(i => screen[i * 4 + 1]);
      const ratio = (Math.max(...x) - Math.min(...x)) / (Math.max(...y) - Math.min(...y));
      expect(Math.abs(ratio / (250 / 510) - 1)).toBeLessThanOrEqual(0.05);
    }
    for (let s = 1; s < screens.length; s++) {
      let total = 0;
      for (let i = 0; i < COUNT; i++) {
        const [a, b] = [screens[s - 1], screens[s]];
        total += Math.hypot(a[i * 4] - b[i * 4], a[i * 4 + 1] - b[i * 4 + 1], a[i * 4 + 2] - b[i * 4 + 2]);
      }
      expect(total / COUNT).toBeGreaterThan(0.05);
    }
  });

  it('is deterministic for a seed', () => {
    const again = buildTrack(ROWS, COUNT);
    again.shapes.forEach((shape, index) => expect(shape).toEqual(track.shapes[index]));
    expect(buildTrack(ROWS, COUNT, 2).shapes[1]).not.toEqual(track.shapes[1]);
  });

  it('throws on an unknown slug or a step the story lacks', () => {
    expect(() => buildTrack([{ slug: 'nope', steps: 1 }], COUNT)).toThrow(/nope step 1/);
    expect(() => buildTrack([{ slug: 'siem', steps: 7 }], COUNT)).toThrow(/siem step 7/);
  });
});
