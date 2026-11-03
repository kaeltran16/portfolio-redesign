// particle shapes for the page-wide cloud; no dom and no three, so they are unit tested.
// every shape is count * 4 floats (x, y, z, presence) in a [-1, 1] box, and particle i is the
// same particle in every shape, so the renderer only lerps between two of them

export type Track = { names: string[]; shapes: Float32Array[] };

type Random = () => number;
type Point = [x: number, y: number, z: number, presence: number];
type Place = (i: number, random: Random, previous: Float32Array) => Point;
type Part = (random: Random) => [x: number, y: number];

const DEFAULT_SEED = 1;
// keeps flat shapes from reading as paper cut-outs when the camera tilts
const DEPTH = 0.15;
// depth of a part that comes toward the viewer, which also draws its dots larger
const FORWARD = 0.6;
// 1 in 25 is 4%, inside the cv's 3-5% left after its 95-97% triage cut
const SURVIVOR_EVERY = 25;
const OUTLIER_EVERY = 100;
// opal's phone is 250:510; the box is 2 tall, so the half width is 250 / 510
const PHONE = 250 / 510;
// dimmer than a row's shapes so experience text stays the thing you read
const SETTLE_PRESENCE = 0.6;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function mulberry32(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function spread(random: Random, half: number): number {
  return (random() * 2 - 1) * half;
}

const blob = (cx: number, cy: number, radius: number): Part => random => {
  const angle = random() * Math.PI * 2;
  const r = radius * Math.sqrt(random());
  return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
};

const ring = (cx: number, cy: number, radius: number): Part => random => {
  const angle = random() * Math.PI * 2;
  return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
};

const segment = (x1: number, y1: number, x2: number, y2: number, jitter = 0.02): Part => random => {
  const t = random();
  return [x1 + (x2 - x1) * t + spread(random, jitter), y1 + (y2 - y1) * t + spread(random, jitter)];
};

const box = (cx: number, cy: number, halfWidth: number, halfHeight: number): Part => random =>
  [cx + spread(random, halfWidth), cy + spread(random, halfHeight)];

const wave = (cy: number, amplitude: number, halfWidth: number): Part => random => {
  const x = spread(random, halfWidth);
  return [x, cy + amplitude * Math.sin((x / halfWidth) * Math.PI * 2) + spread(random, 0.02)];
};

// particle i always draws from part i % n, so a shape's parts share the particles evenly
const parts = (...list: Part[]): Place => (i, random) => {
  const [x, y] = list[i % list.length](random);
  return [x, y, spread(random, DEPTH), 1];
};

function sphere(i: number, count: number): Point {
  const y = 1 - (2 * (i + 0.5)) / count;
  const radius = Math.sqrt(1 - y * y);
  const angle = i * GOLDEN_ANGLE;
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius, 1];
}

const isSurvivor = (i: number) => i % SURVIVOR_EVERY === 0;

function kept(previous: Float32Array, i: number): Point {
  return [previous[i * 4], previous[i * 4 + 1], previous[i * 4 + 2], 0];
}

// arc: lanes are the git worktrees; the leaves of the task graph sit where the lanes will run
const LANES = [-0.75, -0.25, 0.25, 0.75];
const LANE_WIDTH = 0.05;
const LEAF_Y = -0.75;

const arcGraph = parts(
  blob(0, 0.75, 0.12),
  blob(-0.5, 0, 0.1),
  blob(0.5, 0, 0.1),
  ...LANES.map(x => blob(x, LEAF_Y, 0.08)),
  segment(0, 0.75, -0.5, 0),
  segment(0, 0.75, 0.5, 0),
  segment(-0.5, 0, LANES[0], LEAF_Y),
  segment(-0.5, 0, LANES[1], LEAF_Y),
  segment(0.5, 0, LANES[2], LEAF_Y),
  segment(0.5, 0, LANES[3], LEAF_Y),
);

function lane(i: number, random: Random): Point {
  return [LANES[i % LANES.length] + spread(random, LANE_WIDTH), spread(random, 1), spread(random, DEPTH), 1];
}

const ASK_LANE = LANES.length - 1;
const askBlob = blob(0.55, 0.45, 0.2);

function ask(i: number, random: Random): Point {
  if (i % LANES.length !== ASK_LANE) return lane(i, random);
  const [x, y] = askBlob(random);
  // the question comes forward, out of its lane
  return [x, y, FORWARD + spread(random, DEPTH), 1];
}

// lanes converge over the top half and run as one trunk below it
function merge(i: number, random: Random): Point {
  const y = spread(random, 1);
  const x = LANES[i % LANES.length] * Math.max(0, y) + spread(random, LANE_WIDTH);
  return [x, y, spread(random, DEPTH), 1];
}

// a shape is drawn behind its row's visual, and the opaque siem console covers shape space out to
// 1 / CLOUD_SPREAD on the box's shorter axis; beyond this a point shows, with margin for dot size and drift
export const HALO_INNER = 0.7;
// the band above the console: below it sits the step caption, and a phone cuts off the sides
const HALO_MID = 0.85;
// the answer ring frames the console; at this radius its diagonals (radius / sqrt 2) still clear HALO_INNER
const ANSWER_RADIUS = 1;

// siem: survivors are fixed by index, so the triage cut keeps the particles that were
// already the outlier and the chain
const SIEM_CLUSTERS: [number, number][] = [[-0.7, 0.82], [-0.35, 0.92], [0, 0.82], [0.35, 0.92], [0.7, 0.82]];
const CLUSTER_RADIUS = 0.08;

function stream(random: Random, noise: number): Point {
  const x = spread(random, 1);
  return [x, 0.3 * Math.sin(2.5 * x) + spread(random, noise), spread(random, DEPTH), 1];
}

const events: Place = (_, random) => stream(random, 0.45);

const outlier = blob(0.6, HALO_MID, 0.08);
const risk: Place = (i, random) => {
  if (i % OUTLIER_EVERY !== 0) return stream(random, 0.2);
  const [x, y] = outlier(random);
  return [x, y, spread(random, DEPTH), 1];
};

const intel = parts(...SIEM_CLUSTERS.map(([x, y]) => blob(x, y, CLUSTER_RADIUS)));

const chainLinks = SIEM_CLUSTERS.slice(1).map(([x, y], k) => segment(...SIEM_CLUSTERS[k], x, y));
const chainNodes = parts(...SIEM_CLUSTERS.map(([x, y]) => blob(x, y, CLUSTER_RADIUS * 0.75)), ...chainLinks);
const chainOnly = parts(...chainLinks);
const chain: Place = (i, random, previous) =>
  isSurvivor(i) ? chainOnly(i, random, previous) : chainNodes(i, random, previous);

// the rest fade out where they stood while the survivors gather and come forward to the analyst,
// which also keeps so few dots large enough to read
const gathered = blob(0, HALO_MID, 0.14);
const alerts: Place = (i, random, previous) => {
  if (!isSurvivor(i)) return kept(previous, i);
  const [x, y] = gathered(random);
  return [x, y, FORWARD + spread(random, DEPTH), 1];
};

const answer = ring(0, 0, ANSWER_RADIUS);
const agent: Place = (i, random, previous) => {
  if (!isSurvivor(i)) return kept(previous, i);
  const [x, y] = answer(random);
  return [x, y, spread(random, DEPTH), 1];
};

// opal: every screen keeps the phone's outline; inner parts stay inside an inset
const INNER = PHONE - 0.12;
const phoneFrame: Part = random => {
  const side = random() < 0.5 ? -1 : 1;
  return random() < PHONE / (PHONE + 1) ? [spread(random, PHONE), side] : [side * PHONE, spread(random, 1)];
};
const lines = (...ys: number[]) => ys.map(y => segment(-INNER, y, INNER, y));

const opalToday = parts(phoneFrame, box(0, 0.6, INNER, 0.2), ...lines(0.15, -0.15, -0.45, -0.75));
const opalAreas = parts(
  phoneFrame,
  ring(-0.18, 0.55, 0.15),
  ring(0.18, 0.55, 0.15),
  ...[0.05, -0.3, -0.65].map(y => box(0, y, INNER, 0.1)),
);
const BARS = [0.5, 0.9, 0.3, 0.7, 0.4];
const BAR_FLOOR = -0.85;
const opalWorkout = parts(
  phoneFrame,
  box(0, 0.7, INNER, 0.12),
  ...BARS.map((height, k) => box((k - 2) * 0.16, BAR_FLOOR + height / 2, 0.05, height / 2)),
);
const opalYou = parts(phoneFrame, ring(0, 0.55, 0.25), wave(-0.1, 0.12, INNER), ...lines(-0.45, -0.7));

const settle: Place = (_, random) => [spread(random, 1), spread(random, 1), spread(random, DEPTH * 2), SETTLE_PRESENCE];

const STORIES: Record<string, Place[]> = {
  arc: [arcGraph, lane, ask, merge],
  siem: [events, risk, intel, chain, alerts, agent],
  opal: [opalToday, opalAreas, opalWorkout, opalYou],
};

function placeFor(slug: string, step: number): Place {
  const place = Object.hasOwn(STORIES, slug) ? STORIES[slug][step - 1] : undefined;
  if (!place) throw new Error(`no particle shape for ${slug} step ${step}`);
  return place;
}

function fill(count: number, place: (i: number) => Point): Float32Array {
  const shape = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    shape.set(place(i), i * 4);
  }
  return shape;
}

export function buildTrack(rows: { slug: string; steps: number }[], count: number, seed = DEFAULT_SEED): Track {
  const random = mulberry32(seed);
  const names = ['sphere'];
  const shapes = [fill(count, i => sphere(i, count))];
  const add = (name: string, place: Place) => {
    const previous = shapes[shapes.length - 1];
    names.push(name);
    shapes.push(fill(count, i => place(i, random, previous)));
  };
  for (const { slug, steps } of rows) {
    for (let step = 1; step <= steps; step++) add(`${slug}-${step}`, placeFor(slug, step));
  }
  add('settle', settle);
  return { names, shapes };
}
