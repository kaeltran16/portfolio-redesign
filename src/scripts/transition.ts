// moving between pages dissolves the page into the background colour through the same kind of noise as the hero
// sphere, then dissolves the next page in. a full-window webgl canvas over everything plays both halves: the leaving
// page covers itself before navigating, and the arriving page, covered from first paint (Base.astro), uncovers itself
import { ARRIVE_KEY, isPageChange } from '../lib/transition';
import { reduceMotion } from './motion';

const LEAVE_MS = 450;
const ARRIVE_MS = 600;
// noise cells across the window's height: low, so the dissolve reads as a few large blobs
const NOISE_SCALE = 1.8;
// width of the accent line where the dissolve meets the page, in noise units
const EDGE = 0.025;
const EDGE_TINT = 0.7;
const DRIFT = 0.15;
// value noise of three octaves spans about 0.15 to 0.75; this stretches it to 0-1 so the whole window turns
const NOISE_MIN = 0.15;
const NOISE_SPAN = 0.6;
const MAX_PIXEL_RATIO = 2;

const glslFloat = (value: number) => value.toFixed(4);

const FRAGMENT = `
precision highp float;
uniform vec2 uRes;
uniform float uProgress;
uniform float uSeconds;
uniform vec3 uBackground;
uniform vec3 uAccent;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
  return v;
}

// progress 0 leaves every pixel clear and 1 covers every pixel, edge line included
void main() {
  vec2 uv = gl_FragCoord.xy / uRes.y;
  float n = clamp((fbm(uv * NOISE_SCALE + uSeconds * DRIFT) - NOISE_MIN) / NOISE_SPAN, 0.0, 1.0);
  float threshold = mix(-EDGE, 1.0 + EDGE, uProgress);
  float covered = step(n, threshold);
  float edge = 1.0 - smoothstep(0.0, EDGE, abs(n - threshold));
  gl_FragColor = vec4(mix(uBackground, uAccent, edge * EDGE_TINT), max(covered, edge));
}
`;

const VERTEX = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';

// a css colour in any syntax as 0-1 rgb, by painting it
function rgb(color: string): [number, number, number] {
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

function overlay() {
  const canvas = document.createElement('canvas');
  canvas.className = 'page-transition';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset.pageTransition = '';
  canvas.hidden = true;
  const gl = canvas.getContext('webgl', { premultipliedAlpha: false });
  if (!gl) throw new Error('webgl unavailable');

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`shader: ${gl.getShaderInfoLog(shader)}`);
    return shader;
  };
  const defines = [
    ['NOISE_SCALE', NOISE_SCALE],
    ['EDGE', EDGE],
    ['EDGE_TINT', EDGE_TINT],
    ['DRIFT', DRIFT],
    ['NOISE_MIN', NOISE_MIN],
    ['NOISE_SPAN', NOISE_SPAN],
  ].map(([name, value]) => `#define ${name} ${glslFloat(value as number)}\n`);
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, defines.join('') + FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`program: ${gl.getProgramInfoLog(program)}`);
  gl.useProgram(program);
  // one triangle larger than the window covers every pixel
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const start = performance.now();
  document.body.append(canvas);

  // the theme can change between plays, not during one
  const setColours = () => {
    const style = getComputedStyle(document.documentElement);
    gl.uniform3f(uniform('uBackground'), ...rgb(style.getPropertyValue('--background')));
    gl.uniform3f(uniform('uAccent'), ...rgb(style.getPropertyValue('--accent')));
  };

  const draw = (progress: number) => {
    const ratio = Math.min(devicePixelRatio, MAX_PIXEL_RATIO);
    const [width, height] = [Math.round(innerWidth * ratio), Math.round(innerHeight * ratio)];
    // assigning a size clears the canvas even when it is unchanged
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(uniform('uRes'), width, height);
    gl.uniform1f(uniform('uProgress'), progress);
    gl.uniform1f(uniform('uSeconds'), (performance.now() - start) / 1000);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const show = (progress: number) => {
    setColours();
    canvas.hidden = false;
    draw(progress);
  };

  const play = (from: number, to: number, ms: number) =>
    new Promise<void>(resolve => {
      show(from);
      const begin = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - begin) / ms);
        draw(from + (to - from) * easeInOut(t));
        if (t < 1) requestAnimationFrame(tick);
        else {
          canvas.hidden = to === 0;
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });

  return { play, show, hide: () => (canvas.hidden = true) };
}

// the link a plain click leaves this page through, or null for a new tab, a download or a jump within the page
function leavingThrough(event: MouseEvent): HTMLAnchorElement | null {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return null;
  }
  const link = (event.target as Element).closest('a');
  if (!link || link.target || link.hasAttribute('download')) return null;
  return isPageChange(new URL(link.href, location.href), new URL(location.href)) ? link : null;
}

function start() {
  const fx = overlay();
  let leaving = false;

  // capture, so it runs before nav.ts and smooth.ts handle the same click
  document.addEventListener(
    'click',
    event => {
      const link = leavingThrough(event);
      if (!link) return;
      event.preventDefault();
      event.stopPropagation();
      if (leaving) return;
      leaving = true;
      document.querySelectorAll<HTMLElement>(':popover-open').forEach(popover => popover.hidePopover());
      sessionStorage.setItem(ARRIVE_KEY, '1');
      fx.play(0, 1, LEAVE_MS).then(() => location.assign(link.href));
    },
    true,
  );

  if (sessionStorage.getItem(ARRIVE_KEY)) {
    sessionStorage.removeItem(ARRIVE_KEY);
    // the full cover replaces the css one in the same frame, so nothing shows between them
    fx.show(1);
    document.documentElement.classList.remove('arriving');
    fx.play(1, 0, ARRIVE_MS);
  }

  // back and forward restore a page from the cache as it was left: covered
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    leaving = false;
    fx.hide();
  });
}

if (!reduceMotion) {
  try {
    start();
  } catch (error) {
    // a missing gpu is the visitor's environment, not a site bug, so it warns rather than errors
    console.warn('page transition failed to start; pages change without it', error);
  }
}
// covered from first paint only for the transition to uncover; without one the page shows at once
document.documentElement.classList.remove('arriving');
