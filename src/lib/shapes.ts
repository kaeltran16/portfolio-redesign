// particle shapes for the page-wide cloud; no dom and no three, so they are unit tested.
// every shape is count * 4 floats (x, y, z, presence) in a [-1, 1] box, with count sizes beside it, and particle
// i is the same particle in every shape, so the renderer only lerps between two of them. a size multiplies the
// renderer's point size, so 1 is a plain dot

export type Track = { names: string[]; shapes: Float32Array[]; sizes: Float32Array[] };

type Random = () => number;
type Point = [x: number, y: number, z: number, presence: number, size: number];
type Shape = { points: Float32Array; sizes: Float32Array };
type Place = (i: number, random: Random, previous: Shape, count: number) => Point;
type Part = (random: Random) => [x: number, y: number];
type Dot = [x: number, y: number, size: number];

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

function sphere(i: number, count: number): Point {
  const y = 1 - (2 * (i + 0.5)) / count;
  const radius = Math.sqrt(1 - y * y);
  const angle = i * GOLDEN_ANGLE;
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius, 1, 1];
}

const isSurvivor = (i: number) => i % SURVIVOR_EVERY === 0;

function kept({ points, sizes }: Shape, i: number): Point {
  return [points[i * 4], points[i * 4 + 1], points[i * 4 + 2], 0, sizes[i]];
}

// a shape is drawn behind its row's visual, which hides shape space out to about 0.82 by 0.62; the step caption
// sits below the visual, and the rail or the row's title column beside it. so arc and siem show in the band above
// the visual, from HALO_INNER to 1, which also clears 1 / CLOUD_SPREAD with margin for dot size and drift
export const HALO_INNER = 0.7;
const HALO_MID = 0.85;
// a dot stays above this, where it is either in the band or hidden by the visual; the caption starts near -0.68
export const VISUAL_FLOOR = -0.55;
// the visual's own half width; past it sit the rail, the logo, the theme toggle or the title column
export const TEXT_EDGE = 0.82;
// between the console's panels and its command box is a gap the visual does not hide: y -0.50 to -0.47 at 1440
// and -0.35 to -0.29 at 390, where the console keeps its size in a smaller box. the band spans both, with margin
// for dot size and drift, across the visual's width
export const CONSOLE_GAP_FLOOR = -0.53;
export const CONSOLE_GAP_TOP = -0.24;
// float32 storage rounds 0.7 to just under it, so a part laid on the band's floor sits this far above it
const FLOOR_MARGIN = 0.02;
const bandY = (random: Random) => HALO_INNER + FLOOR_MARGIN + random() * (1 - HALO_INNER - FLOOR_MARGIN);

// each dot drifts a few px on its own, so nodes are packed and links dense enough to hold their shape through it
const NODE_SIZE = 3.6;
const LINK_SIZE = 1.8;
const LINK_GAP = 0.014;
const BAND_FIELD = 60;
const FIELD_PRESENCE = 0.6;
// inside the 0.82 by 0.62 the visual hides, with margin for dot size and drift; the floor stays above the console
// gap, CONSOLE_GAP_FLOOR to CONSOLE_GAP_TOP, where a dot would show
const HIDDEN_HALF_WIDTH = 0.74;
const HIDDEN_TOP = 0.54;
const HIDDEN_FLOOR = CONSOLE_GAP_TOP;

// a sunflower disc spaces a node's dots evenly whatever their number
function disc(cx: number, cy: number, radius: number, dots: number): Dot[] {
  return Array.from({ length: dots }, (_, k) => {
    const r = radius * Math.sqrt((k + 0.5) / dots);
    return [cx + Math.cos(k * GOLDEN_ANGLE) * r, cy + Math.sin(k * GOLDEN_ANGLE) * r, NODE_SIZE];
  });
}

// evenly spaced dots between two nodes, stopping short of each node's disc
function dotted([x1, y1]: [number, number], [x2, y2]: [number, number], inset: number): Dot[] {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const dots = Math.max(1, Math.round((length - 2 * inset) / LINK_GAP));
  return Array.from({ length: dots }, (_, k) => {
    const t = (inset + ((k + 0.5) / dots) * (length - 2 * inset)) / length;
    return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, LINK_SIZE];
  });
}

// a diagram draws its nodes and links in a fixed number of larger dots, so the phone's smaller cloud draws the same
// diagram; the rest of the particles are a dim field, a few in the band and the others hidden behind the visual,
// so the band reads as a diagram rather than a haze. the field stays present so the siem cut still reads as a cut
const diagram = (dots: Dot[]): Place => (i, random) => {
  if (i < dots.length) {
    const [x, y, size] = dots[i];
    return [x, y, spread(random, DEPTH), 1, size];
  }
  const inBand = i < dots.length + BAND_FIELD;
  const x = spread(random, inBand ? TEXT_EDGE : HIDDEN_HALF_WIDTH);
  const y = inBand ? bandY(random) : HIDDEN_FLOOR + random() * (HIDDEN_TOP - HIDDEN_FLOOR);
  return [x, y, spread(random, DEPTH), FIELD_PRESENCE, 1];
};

// arc: lanes are the git worktrees; the leaves of the task graph sit where the lanes will run
const LANES = [-0.75, -0.25, 0.25, 0.75];
const LANE_WIDTH = 0.05;
const ROOT_Y = 0.95;
const LEAF_Y = 0.75;
const NODE_RADIUS = 0.03;
const LEAF_RADIUS = NODE_RADIUS * 0.8;
const NODE_DOTS = 8;

const ROOT: [number, number] = [0, ROOT_Y];
const MIDS: [number, number][] = [[-0.45, HALO_MID], [0.45, HALO_MID]];
const LEAVES = LANES.map((x): [number, number] => [x, LEAF_Y]);
const arcGraph = diagram([
  ...[ROOT, ...MIDS].flatMap(([x, y]) => disc(x, y, NODE_RADIUS, NODE_DOTS)),
  ...LEAVES.flatMap(([x, y]) => disc(x, y, LEAF_RADIUS, NODE_DOTS)),
  ...MIDS.flatMap(mid => dotted(ROOT, mid, NODE_RADIUS)),
  ...LEAVES.flatMap((leaf, k) => dotted(MIDS[k < 2 ? 0 : 1], leaf, NODE_RADIUS)),
]);

// lanes run down behind the visual, so the part in the band keeps a light density; they stop above the console
// gap, since below it is only the command box, which a dot faintly shows through
const laneY = (random: Random) => CONSOLE_GAP_TOP + random() * (1 - CONSOLE_GAP_TOP);

function lane(i: number, random: Random): Point {
  return [LANES[i % LANES.length] + spread(random, LANE_WIDTH), laneY(random), spread(random, DEPTH), 1, 1];
}

const ASK_LANE = LANES.length - 1;
const askBlob = blob(0.5, HALO_MID, 0.12);

function ask(i: number, random: Random): Point {
  if (i % LANES.length !== ASK_LANE) return lane(i, random);
  const [x, y] = askBlob(random);
  // the question comes forward, out of its lane
  return [x, y, FORWARD + spread(random, DEPTH), 1, 1];
}

// lanes converge from the top of the band and run into the visual as one trunk; all in the band, so the
// converging lines stay dense
const MERGE_Y = 0.82;
function merge(i: number, random: Random): Point {
  const y = bandY(random);
  const x = LANES[i % LANES.length] * Math.max(0, (y - MERGE_Y) / (1 - MERGE_Y)) + spread(random, LANE_WIDTH);
  return [x, y, spread(random, DEPTH), 1, 1];
}

// siem: survivors are fixed by index, so the triage cut keeps the particles that were already the outlier
const SIEM_CLUSTERS: [number, number][] = [[-0.7, 0.82], [-0.35, 0.92], [0, 0.82], [0.35, 0.92], [0.7, 0.82]];
const CLUSTER_RADIUS = 0.05;
const CLUSTER_DOTS = 14;
const CHAIN_RADIUS = 0.03;
const CHAIN_DOTS = 8;
const WAVE = 0.03;

function stream(random: Random, cy: number, noise: number): Point {
  const x = spread(random, TEXT_EDGE);
  return [x, cy + WAVE * Math.sin(2.5 * x) + spread(random, noise), spread(random, DEPTH), 1, 1];
}

// the events spread down behind the visual, so the part in the band stays sparse; their wave stays above the
// console gap
const EVENTS_FLOOR = CONSOLE_GAP_TOP + WAVE;
const EVENTS_TOP = 0.9;
const events: Place = (_, random) =>
  stream(random, (EVENTS_FLOOR + EVENTS_TOP) / 2, (EVENTS_TOP - EVENTS_FLOOR) / 2);

// the stream calms and drops to make room for the outlier above it
const outlier = blob(0.6, 0.94, 0.05);
const risk: Place = (i, random) => {
  if (i % OUTLIER_EVERY !== 0) return stream(random, 0.8, 0.03);
  const [x, y] = outlier(random);
  return [x, y, spread(random, DEPTH), 1, 1];
};

const intel = diagram(SIEM_CLUSTERS.flatMap(([x, y]) => disc(x, y, CLUSTER_RADIUS, CLUSTER_DOTS)));

const chain = diagram([
  ...SIEM_CLUSTERS.flatMap(([x, y]) => disc(x, y, CHAIN_RADIUS, CHAIN_DOTS)),
  ...SIEM_CLUSTERS.slice(1).flatMap((node, k) => dotted(SIEM_CLUSTERS[k], node, CHAIN_RADIUS)),
]);

// the rest fade out where they stood while the survivors gather and come forward to the analyst,
// which also keeps so few dots large enough to read
const gathered = blob(0, HALO_MID, 0.14);
const alerts: Place = (i, random, previous) => {
  if (!isSurvivor(i)) return kept(previous, i);
  const [x, y] = gathered(random);
  return [x, y, FORWARD + spread(random, DEPTH), 1, 1];
};

// the answer arches over the visual, framing it from above
const ARCH_HALF_WIDTH = 0.8;
const ARCH_BASE = HALO_INNER + FLOOR_MARGIN;
const ARCH_HEIGHT = 1 - ARCH_BASE - FLOOR_MARGIN;
const ARCH_SIZE = 2;
const ARCH_STEPS = 256;
const archAt = (angle: number): [number, number] =>
  [Math.cos(angle) * ARCH_HALF_WIDTH, ARCH_BASE + Math.sin(angle) * ARCH_HEIGHT];
// even angles bunch the dots at the arch's feet, so they are spaced by length along it
const archLengths = [0];
for (let j = 1; j <= ARCH_STEPS; j++) {
  const [a, b] = [archAt((Math.PI * (j - 1)) / ARCH_STEPS), archAt((Math.PI * j) / ARCH_STEPS)];
  archLengths.push(archLengths[j - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
}
function alongArch(t: number): [number, number] {
  const target = t * archLengths[ARCH_STEPS];
  let j = 1;
  while (archLengths[j] < target) j++;
  const within = (target - archLengths[j - 1]) / (archLengths[j] - archLengths[j - 1]);
  return archAt((Math.PI * (j - 1 + within)) / ARCH_STEPS);
}
const agent: Place = (i, random, previous, count) => {
  if (!isSurvivor(i)) return kept(previous, i);
  const [x, y] = alongArch((i / SURVIVOR_EVERY + 0.5) / Math.ceil(count / SURVIVOR_EVERY));
  return [x, y, spread(random, DEPTH), 1, ARCH_SIZE];
};

// opal: step k draws screen k + 1 as a phone-shaped patch in the empty space right of the phone, just before the
// phone slides to it; the title column is on the left. the phone hides shape space out to 0.30 by 0.613, so the
// other particles wait behind it, with margin for dot size and drift
const PATCH_X = 0.57;
// the patch's half height; its half width is PHONE times it, so it spans x 0.37 to 0.77 and y -0.4 to 0.4
const PATCH_SCALE = 0.4;
const PHONE_HIDDEN_HALF_WIDTH = 0.24;
const PHONE_HIDDEN_HALF_HEIGHT = 0.55;
// a screen's parts are drawn in phone space, x within PHONE and y within 1, inside an inset from the frame
const INNER = PHONE - 0.12;
const CONTENT_SIZE = 2.8;
const CONTENT_GAP = 0.032;

const inPatch = (x: number, y: number): [number, number] => [PATCH_X + x * PATCH_SCALE, y * PATCH_SCALE];
const dotsAlong = (length: number) => Math.max(1, Math.round((length * PATCH_SCALE) / CONTENT_GAP));

// a grid of dots; zero half height makes a line of text, zero half width a bar
function filled(cx: number, cy: number, halfWidth: number, halfHeight: number): Dot[] {
  const [columns, rows] = [dotsAlong(2 * halfWidth), dotsAlong(2 * halfHeight)];
  return Array.from({ length: columns * rows }, (_, k) => {
    const x = cx + (((k % columns) + 0.5) / columns - 0.5) * 2 * halfWidth;
    const y = cy + ((Math.floor(k / columns) + 0.5) / rows - 0.5) * 2 * halfHeight;
    return [...inPatch(x, y), CONTENT_SIZE];
  });
}

function circle(cx: number, cy: number, radius: number): Dot[] {
  const dots = dotsAlong(2 * Math.PI * radius);
  return Array.from({ length: dots }, (_, k) => {
    const angle = (k / dots) * Math.PI * 2;
    return [...inPatch(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius), CONTENT_SIZE];
  });
}

function wave(cy: number, amplitude: number): Dot[] {
  const dots = dotsAlong(2 * INNER);
  return Array.from({ length: dots }, (_, k) => {
    const x = ((k + 0.5) / dots - 0.5) * 2 * INNER;
    return [...inPatch(x, cy + amplitude * Math.sin((x / INNER) * Math.PI * 2)), CONTENT_SIZE];
  });
}

const CORNERS = [[-PHONE, 1], [PHONE, 1], [PHONE, -1], [-PHONE, -1]].map(([x, y]) => inPatch(x, y));
const frame = CORNERS.flatMap((corner, k) => dotted(corner, CORNERS[(k + 1) % CORNERS.length], 0));
const lines = (...ys: number[]) => ys.flatMap(y => filled(0, y, INNER, 0));

const screenPatch = (dots: Dot[]): Place => (i, random) => {
  if (i < dots.length) {
    const [x, y, size] = dots[i];
    return [x, y, spread(random, DEPTH), 1, size];
  }
  const [x, y] = [spread(random, PHONE_HIDDEN_HALF_WIDTH), spread(random, PHONE_HIDDEN_HALF_HEIGHT)];
  return [x, y, spread(random, DEPTH), FIELD_PRESENCE, 1];
};

const opalAreas = screenPatch([
  ...frame,
  ...circle(-0.18, 0.55, 0.15),
  ...circle(0.18, 0.55, 0.15),
  ...[0.05, -0.3, -0.65].flatMap(y => filled(0, y, INNER, 0.1)),
]);
const BARS = [0.5, 0.9, 0.3, 0.7, 0.4];
const BAR_FLOOR = -0.85;
const opalWorkout = screenPatch([
  ...frame,
  ...filled(0, 0.7, INNER, 0.12),
  ...BARS.flatMap((height, k) => filled((k - 2) * 0.16, BAR_FLOOR + height / 2, 0.05, height / 2)),
]);
const opalYou = screenPatch([...frame, ...circle(0, 0.55, 0.25), ...wave(-0.1, 0.12), ...lines(-0.45, -0.7)]);

// after the last screen there is none to preview, so the particles loosen over the visual, clear of the text
const opalField: Place = (_, random) => [
  spread(random, TEXT_EDGE - FLOOR_MARGIN),
  VISUAL_FLOOR + FLOOR_MARGIN + random() * (1 - VISUAL_FLOOR - FLOOR_MARGIN),
  spread(random, DEPTH),
  FIELD_PRESENCE,
  1,
];

const settle: Place = (_, random) => [spread(random, 1), spread(random, 1), spread(random, DEPTH * 2), SETTLE_PRESENCE, 1];

const STORIES: Record<string, Place[]> = {
  arc: [arcGraph, lane, ask, merge],
  siem: [events, risk, intel, chain, alerts, agent],
  opal: [opalAreas, opalWorkout, opalYou, opalField],
};
// a patch previews the screen the phone is about to slide to, so a still page, which never slides, shows none
const STILL_STORIES: Record<string, Place[]> = {
  opal: [opalField, opalField, opalField, opalField],
};

function placeFor(slug: string, step: number, still: boolean): Place {
  const stories = still && Object.hasOwn(STILL_STORIES, slug) ? STILL_STORIES : STORIES;
  const place = Object.hasOwn(stories, slug) ? stories[slug][step - 1] : undefined;
  if (!place) throw new Error(`no particle shape for ${slug} step ${step}`);
  return place;
}

function fill(count: number, place: (i: number) => Point): Shape {
  const points = new Float32Array(count * 4);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const [x, y, z, presence, size] = place(i);
    points.set([x, y, z, presence], i * 4);
    sizes[i] = size;
  }
  return { points, sizes };
}

export function buildTrack(
  rows: { slug: string; steps: number }[],
  count: number,
  { seed = DEFAULT_SEED, still = false }: { seed?: number; still?: boolean } = {},
): Track {
  const random = mulberry32(seed);
  const names = ['sphere'];
  const filled = [fill(count, i => sphere(i, count))];
  const add = (name: string, place: Place) => {
    const previous = filled[filled.length - 1];
    names.push(name);
    filled.push(fill(count, i => place(i, random, previous, count)));
  };
  for (const { slug, steps } of rows) {
    for (let step = 1; step <= steps; step++) add(`${slug}-${step}`, placeFor(slug, step, still));
  }
  add('settle', settle);
  return { names, shapes: filled.map(shape => shape.points), sizes: filled.map(shape => shape.sizes) };
}
