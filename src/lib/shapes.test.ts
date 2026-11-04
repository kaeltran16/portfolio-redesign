import { describe, expect, it } from 'vitest';
import { buildTrack, CONSOLE_GAP_FLOOR, CONSOLE_GAP_TOP, HALO_INNER, TEXT_EDGE, VISUAL_FLOOR } from './shapes';

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

function inHalo(shape: Float32Array, i: number): boolean {
  return Math.max(Math.abs(shape[i * 4]), Math.abs(shape[i * 4 + 1])) >= HALO_INNER;
}

function xs(shape: Float32Array): number[] {
  return presentIndices(shape).map(i => shape[i * 4]);
}

function sizesOf(name: string, from = track): Float32Array {
  return from.sizes[from.names.indexOf(name)];
}

function inBand(shape: Float32Array, i: number): boolean {
  return shape[i * 4 + 1] >= HALO_INNER && Math.abs(shape[i * 4]) <= TEXT_EDGE;
}

// the console hides shape space out to about 0.82 by 0.62, so a dot here is behind it with margin
function behindConsole(shape: Float32Array, i: number): boolean {
  const [x, y] = [shape[i * 4], shape[i * 4 + 1]];
  return Math.abs(x) <= 0.78 && y >= VISUAL_FLOOR && y <= 0.58;
}

function offText(shape: Float32Array): number[] {
  return presentIndices(shape).filter(i => shape[i * 4 + 1] < VISUAL_FLOOR || Math.abs(shape[i * 4]) > TEXT_EDGE);
}

// opal's phone hides shape space out to 0.30 by 0.613; its patch sits in the empty space right of it, away from
// the title column on the left and above the names
function behindPhone(shape: Float32Array, i: number): boolean {
  return Math.abs(shape[i * 4]) <= 0.26 && Math.abs(shape[i * 4 + 1]) <= 0.57;
}

function inPatch(shape: Float32Array, i: number): boolean {
  const [x, y] = [shape[i * 4], shape[i * 4 + 1]];
  return x >= 0.34 && x <= 0.8 && Math.abs(y) <= 0.5;
}

const COUNTS = [1500, 6000];
const DIAGRAMS = ['arc-1', 'siem-3', 'siem-4', 'siem-6'];

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

  it('places the siem survivors in the halo, clear of the visual', () => {
    for (const step of [5, 6]) {
      const shape = shapeOf(`siem-${step}`);
      for (const i of presentIndices(shape)) expect(inHalo(shape, i)).toBe(true);
    }
  });

  it.each(COUNTS)('gives every shape a size per particle, 1 on the sphere and the settle, at %s', count => {
    const sized = buildTrack(ROWS, count);
    expect(sized.sizes).toHaveLength(sized.shapes.length);
    for (const sizes of sized.sizes) {
      expect(sizes).toHaveLength(count);
      expect(sizes.every(size => size > 0)).toBe(true);
    }
    for (const name of ['sphere', 'settle']) expect(sizesOf(name, sized).every(size => size === 1)).toBe(true);
  });

  it.each(COUNTS)('draws the arc-1, siem-3, siem-4 and siem-6 diagrams in enlarged dots in the band, at %s', count => {
    const sized = buildTrack(ROWS, count);
    for (const name of DIAGRAMS) {
      const [shape, sizes] = [shapeOf(name, sized), sizesOf(name, sized)];
      const enlarged = [...sizes.keys()].filter(i => sizes[i] > 1);
      expect(enlarged.length, `${name} has no enlarged dots`).toBeGreaterThan(0);
      expect(enlarged.filter(i => !inBand(shape, i)), `${name} has enlarged dots off the band`).toEqual([]);
    }
  });

  it.each(COUNTS)('keeps the field in the band or behind the console, at %s', count => {
    const sized = buildTrack(ROWS, count);
    for (const name of ['arc-1', 'siem-3', 'siem-4']) {
      const [shape, sizes] = [shapeOf(name, sized), sizesOf(name, sized)];
      const strays = presentIndices(shape).filter(i => sizes[i] === 1 && !inBand(shape, i) && !behindConsole(shape, i));
      expect(strays, `${name} has field dots in view off the band`).toEqual([]);
    }
  });

  it.each(COUNTS)('keeps every arc and siem particle present before the cut, at %s', count => {
    const sized = buildTrack(ROWS, count);
    const steps = [...[1, 2, 3, 4].map(k => `arc-${k}`), ...[1, 2, 3, 4].map(k => `siem-${k}`)];
    for (const name of steps) expect(presentIndices(shapeOf(name, sized)), name).toHaveLength(count);
  });

  // below the visual sits the step caption, beside it the rail or the row's title column
  it('keeps arc, siem and opal dots clear of the caption and the title column', () => {
    const steps = [
      ...[1, 2, 3, 4].map(k => `arc-${k}`),
      ...[1, 2, 3, 4, 5, 6].map(k => `siem-${k}`),
      ...[1, 2, 3, 4].map(k => `opal-${k}`),
    ];
    for (const name of steps) expect(offText(shapeOf(name)), `${name} has dots over text`).toEqual([]);
  });

  it.each(COUNTS)('keeps arc and siem dots out of the gap between the console and its command box, at %s', count => {
    const sized = buildTrack(ROWS, count);
    const steps = [...[1, 2, 3, 4].map(k => `arc-${k}`), ...[1, 2, 3, 4, 5, 6].map(k => `siem-${k}`)];
    for (const name of steps) {
      const shape = shapeOf(name, sized);
      const inGap = presentIndices(shape).filter(i => {
        const [x, y] = [shape[i * 4], shape[i * 4 + 1]];
        return Math.abs(x) <= TEXT_EDGE && y >= CONSOLE_GAP_FLOOR && y <= CONSOLE_GAP_TOP;
      });
      expect(inGap, `${name} has dots in the console gap`).toEqual([]);
    }
  });

  it('splits arc workers into lanes and merges them into one trunk', () => {
    expect(largestGap(xs(shapeOf('arc-2')))).toBeGreaterThanOrEqual(0.2);
    expect(largestGap(xs(shapeOf('arc-4')))).toBeLessThanOrEqual(0.1);
  });

  it.each(COUNTS)('draws opal steps 1-3 as a phone-shaped patch beside the phone, at %s', count => {
    const sized = buildTrack(ROWS, count);
    for (const step of [1, 2, 3]) {
      const name = `opal-${step}`;
      const [shape, sizes] = [shapeOf(name, sized), sizesOf(name, sized)];
      const patch = [...sizes.keys()].filter(i => sizes[i] > 1);
      expect(patch.length, `${name} has no patch`).toBeGreaterThan(0);
      expect(patch.filter(i => !inPatch(shape, i)), `${name} has patch dots off the patch`).toEqual([]);
      const x = patch.map(i => shape[i * 4]);
      const y = patch.map(i => shape[i * 4 + 1]);
      const ratio = (Math.max(...x) - Math.min(...x)) / (Math.max(...y) - Math.min(...y));
      expect(Math.abs(ratio / (250 / 510) - 1), `${name} patch is not 250:510`).toBeLessThanOrEqual(0.05);
      const strays = presentIndices(shape).filter(i => sizes[i] <= 1 && !behindPhone(shape, i));
      expect(strays, `${name} has dots in view off the patch`).toEqual([]);
    }
  });

  it.each(COUNTS)('draws a different screen in each patch, at %s', count => {
    const sized = buildTrack(ROWS, count);
    const screens = [1, 2, 3].map(step => shapeOf(`opal-${step}`, sized));
    for (let s = 1; s < screens.length; s++) {
      let total = 0;
      for (let i = 0; i < count; i++) {
        const [a, b] = [screens[s - 1], screens[s]];
        total += Math.hypot(a[i * 4] - b[i * 4], a[i * 4 + 1] - b[i * 4 + 1], a[i * 4 + 2] - b[i * 4 + 2]);
      }
      expect(total / count).toBeGreaterThan(0.05);
    }
  });

  it.each(COUNTS)('disperses opal-4 into a loose field, at %s', count => {
    const sized = buildTrack(ROWS, count);
    const [shape, sizes] = [shapeOf('opal-4', sized), sizesOf('opal-4', sized)];
    expect(sizes.every(size => size <= 1)).toBe(true);
    expect(offText(shape)).toEqual([]);
    const x = xs(shape);
    expect(Math.max(...x) - Math.min(...x)).toBeGreaterThan(1);
  });

  it.each(COUNTS)('shows no patch in a still track, at %s', count => {
    const still = buildTrack(ROWS, count, { still: true });
    for (const step of [1, 2, 3, 4]) {
      const name = `opal-${step}`;
      expect(sizesOf(name, still).every(size => size <= 1), `${name} has a patch`).toBe(true);
      expect(offText(shapeOf(name, still)), `${name} has dots over text`).toEqual([]);
    }
  });

  it('is deterministic for a seed', () => {
    const again = buildTrack(ROWS, COUNT);
    again.shapes.forEach((shape, index) => expect(shape).toEqual(track.shapes[index]));
    expect(buildTrack(ROWS, COUNT, { seed: 2 }).shapes[1]).not.toEqual(track.shapes[1]);
  });

  it('throws on an unknown slug or a step the story lacks', () => {
    expect(() => buildTrack([{ slug: 'nope', steps: 1 }], COUNT)).toThrow(/nope step 1/);
    expect(() => buildTrack([{ slug: 'siem', steps: 7 }], COUNT)).toThrow(/siem step 7/);
  });
});
