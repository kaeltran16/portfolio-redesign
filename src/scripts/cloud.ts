// one fixed, page-wide canvas: the hero's displacement sphere dissolves into a particle cloud that re-forms
// behind each project row's scene and settles at experience.
// the sphere is a port of hamishw.com's displacement-sphere.jsx (MIT, Hamish Williams). his shaders replace
// three's phong shader wholesale against three 0.161; here the same displacement and colour maths are spliced
// into the stock phong shader so it survives three upgrades.
import {
  AdditiveBlending,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  DynamicDrawUsage,
  LinearSRGBColorSpace,
  Mesh,
  MeshPhongMaterial,
  NormalBlending,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  type IUniform,
} from 'three';
import { cloudCursor, type CloudMode } from '../lib/scene';
import { buildTrack } from '../lib/shapes';
import noiseGlsl from './sphere-noise.glsl?raw';

export type Theme = 'dark' | 'light';
export type Cloud = {
  setTheme(theme: Theme): void;
  // anchors from trackAnchors; targets[i] is the element shape i forms behind (same length as anchors)
  setTrack(anchors: number[], targets: HTMLElement[]): void;
};
type Rect = { left: number; top: number; width: number; height: number };

// a shape spreads past its target's box so it halos the scene instead of hiding under it
export const CLOUD_SPREAD = 1.6;
// css px; nearer dots draw up to DEPTH_SIZE larger
const POINT_SIZE = 3;
const DEPTH_SIZE = 0.5;
// share of the dissolve over which the dots fade in on the sphere's surface
const DOTS_IN = 0.25;
const DRIFT_PX = 6;
// radians the shapes sway about their vertical axis, so their depth reads
const SWAY = 0.25;
const SWAY_SPEED = 0.2;
const PUSH_PX = 40;
const PUSH_RADIUS = 140;
// per second; how fast the push follows the mouse
const POINTER_FOLLOW = 8;
// light mode dots move this far toward black, since the accent alone is faint on a light background
const LIGHT_DARKEN = 0.4;

const LIGHTS: Record<Theme, { directional: number; ambient: number }> = {
  dark: { directional: 2.0, ambient: 0.4 },
  light: { directional: 1.8, ambient: 2.7 },
};
// useSpring({ stiffness: 30, damping: 20, mass: 2 }) in the original
const TILT_SPRING = { stiffness: 30, damping: 20, mass: 2 };
const TIME_SCALE = 0.00005;
const SPIN_PER_FRAME = 0.001;
// the sphere's view is 30% taller than the intro, as in the original
const HEIGHT_OVERSCAN = 1.3;
const SPHERE_RADIUS = 32;

// three's webgl renderer needs webgl2, and it logs before rethrowing when it cannot get a context
const CONTEXT_ATTRIBUTES: WebGLContextAttributes = { alpha: true, antialias: false, powerPreference: 'high-performance' };

const glslFloat = (value: number) => value.toFixed(4);

export function boxTransform(rect: Rect, spread: number): { x: number; y: number; scale: number } {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    scale: (Math.min(rect.width, rect.height) / 2) * spread,
  };
}

// holds a shape near its anchor and moves quickest between two
function ease(t: number): number {
  return t * t * (3 - 2 * t);
}

const DOTS_VERTEX = `
uniform float time;
uniform mat4 uSphereModel;
uniform bool uFromSphere;
uniform float uMorph;
uniform vec3 uFromBox;
uniform vec3 uToBox;
uniform vec2 uViewport;
uniform float uSeconds;
uniform float uDrift;
uniform vec2 uPointer;
uniform float uPush;
uniform float uFade;
attribute vec4 aFrom;
attribute vec4 aTo;
varying float vAlpha;
${noiseGlsl}

vec2 toPx(vec4 clip) {
  vec2 ndc = clip.xy / clip.w;
  return vec2(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5) * uViewport;
}

// the mesh's own displacement and model matrix, so a dot leaves exactly where the surface was
vec2 onSphere(vec3 unit) {
  vec3 surface = unit * SPHERE_RADIUS;
  float noise = turbulence(0.01 * surface + unit + time * 0.8);
  return toPx(projectionMatrix * viewMatrix * uSphereModel * vec4(surface + unit + surface * noise, 1.0));
}

vec3 sway(vec3 p) {
  float angle = uDrift * SWAY * sin(uSeconds * SWAY_SPEED);
  float c = cos(angle);
  float s = sin(angle);
  return vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
}

// shape y points up, screen y points down
vec2 inBox(vec3 p, vec3 box) {
  return box.xy + vec2(p.x, -p.y) * box.z;
}

void main() {
  vec3 from = sway(aFrom.xyz);
  vec3 to = sway(aTo.xyz);
  vec2 start;
  if (uFromSphere) start = onSphere(aFrom.xyz);
  else start = inBox(from, uFromBox);
  vec2 px = mix(start, inBox(to, uToBox), uMorph);
  // position carries each dot's drift phase
  px += uDrift * DRIFT_PX * vec2(sin(uSeconds * 0.7 + position.x), cos(uSeconds * 0.5 + position.y));
  vec2 away = px - uPointer;
  float gap = length(away);
  px += uPush * PUSH_PX * (1.0 - smoothstep(0.0, PUSH_RADIUS, gap)) * away / max(gap, 1.0);
  vAlpha = mix(aFrom.w, aTo.w, uMorph) * uFade;
  gl_PointSize = POINT_SIZE * (1.0 + DEPTH_SIZE * mix(from.z, to.z, uMorph));
  gl_Position = vec4(px / uViewport * vec2(2.0, -2.0) + vec2(-1.0, 1.0), 0.0, 1.0);
}
`;

const DOTS_FRAGMENT = `
uniform vec3 uColor;
uniform float uSoft;
varying float vAlpha;

void main() {
  float r = length(gl_PointCoord - 0.5);
  if (r > 0.5) discard;
  // dark glows from a soft centre; light keeps a hard dot, since glow washes out on a light background
  float falloff = mix(1.0, 1.0 - smoothstep(0.0, 0.5, r), uSoft);
  gl_FragColor = vec4(uColor, falloff * vAlpha);
}
`;

function sphereMaterial(time: IUniform<number>): MeshPhongMaterial {
  // transparent so it can fade into the dots; at opacity 1 it draws exactly as an opaque mesh
  const material = new MeshPhongMaterial({ transparent: true });
  material.onBeforeCompile = shader => {
    shader.uniforms.time = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float time;\nvarying vec2 vNoiseUv;\nvarying float noise;\n${noiseGlsl}`)
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vNoiseUv = uv;
        noise = turbulence(0.01 * position + normal + time * 0.8);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal + position * noise, 1.0);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vNoiseUv;\nvarying float noise;')
      .replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        `vec3 noiseColor = vec3(vNoiseUv * (0.2 - 2.0 * noise), 1.0);
        vec3 finalColors = vec3(noiseColor.b * 1.5, noiseColor.r, noiseColor.r);
        vec4 diffuseColor = vec4(cos(finalColors * noise * 3.0), opacity);`,
      );
  };
  return material;
}

export function startCloud(
  canvas: HTMLCanvasElement,
  options: { theme: Theme; mode: CloudMode; rows: { slug: string; steps: number }[] },
): Cloud {
  const context = canvas.getContext('webgl2', CONTEXT_ATTRIBUTES);
  if (!context) throw new Error('webgl unavailable');
  const { mode } = options;
  const track = buildTrack(options.rows, mode.count);

  const renderer = new WebGLRenderer({ canvas, context });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = LinearSRGBColorSpace;

  const camera = new PerspectiveCamera(54, 1, 0.1, 100);
  camera.position.z = 52;
  const scene = new Scene();

  const time: IUniform<number> = { value: 0 };
  const sphereSurface = sphereMaterial(time);
  const sphere = new Mesh(new SphereGeometry(SPHERE_RADIUS, 128, 128), sphereSurface);
  const directional = new DirectionalLight(0xffffff);
  directional.position.set(100, 100, 200);
  const ambient = new AmbientLight(0xffffff);
  scene.add(sphere, directional, ambient);

  const vec4Attribute = () => new BufferAttribute(new Float32Array(mode.count * 4), 4).setUsage(DynamicDrawUsage);
  const from = vec4Attribute();
  const to = vec4Attribute();
  const phases = new Float32Array(mode.count * 3).map(() => Math.random() * Math.PI * 2);
  const geometry = new BufferGeometry();
  // three sizes the draw from position, so it carries the drift phases rather than a place; it has all three
  // components because three's depth sort reads them
  geometry.setAttribute('position', new BufferAttribute(phases, 3));
  geometry.setAttribute('aFrom', from);
  geometry.setAttribute('aTo', to);

  const uniforms = {
    time,
    uSphereModel: { value: sphere.matrixWorld },
    uFromSphere: { value: true },
    uMorph: { value: 0 },
    uFromBox: { value: new Vector3() },
    uToBox: { value: new Vector3() },
    uViewport: { value: new Vector2() },
    uSeconds: { value: 0 },
    uDrift: { value: mode.live ? 1 : 0 },
    uPointer: { value: new Vector2() },
    uPush: { value: 0 },
    uFade: { value: 0 },
    uColor: { value: new Color() },
    uSoft: { value: 1 },
  };
  const dotsMaterial = new ShaderMaterial({
    uniforms,
    vertexShader: DOTS_VERTEX,
    fragmentShader: DOTS_FRAGMENT,
    defines: {
      SPHERE_RADIUS: glslFloat(SPHERE_RADIUS),
      SWAY: glslFloat(SWAY),
      SWAY_SPEED: glslFloat(SWAY_SPEED),
      DRIFT_PX: glslFloat(DRIFT_PX),
      PUSH_PX: glslFloat(PUSH_PX),
      PUSH_RADIUS: glslFloat(PUSH_RADIUS),
      POINT_SIZE: glslFloat(POINT_SIZE),
      DEPTH_SIZE: glslFloat(DEPTH_SIZE),
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const dots = new Points(geometry, dotsMaterial);
  dots.frustumCulled = false;
  // over the fading sphere
  dots.renderOrder = 1;
  scene.add(dots);

  let anchors: number[] = [];
  let targets: HTMLElement[] = [];
  let loaded = -1;

  const load = (index: number, next: number) => {
    from.copyArray(track.shapes[index]);
    to.copyArray(track.shapes[next]);
    from.needsUpdate = true;
    to.needsUpdate = true;
    loaded = index;
  };

  const setBox = (box: Vector3, rect: Rect) => {
    const { x, y, scale } = boxTransform(rect, CLOUD_SPREAD);
    box.set(x, y, scale);
  };

  // the old canvas sat at the intro's top and was 130% of its height; this views the same slice of it
  const placeSphere = (intro: Rect) => {
    const width = window.innerWidth;
    camera.setViewOffset(width, intro.height * HEIGHT_OVERSCAN, 0, -intro.top, width, window.innerHeight);
  };

  const draw = (cursor: number) => {
    if (anchors.length === 0) return;
    const last = anchors.length - 1;
    const index = Math.min(Math.floor(cursor), last);
    const next = Math.min(index + 1, last);
    if (index !== loaded) load(index, next);
    const morph = ease(cursor - index);
    uniforms.uMorph.value = morph;

    const nextRect = targets[next].getBoundingClientRect();
    setBox(uniforms.uToBox.value, nextRect);
    const onSphere = index === 0;
    uniforms.uFromSphere.value = onSphere;
    if (onSphere) {
      placeSphere(targets[0].getBoundingClientRect());
      sphereSurface.opacity = 1 - morph;
      uniforms.uFade.value = Math.min(1, morph / DOTS_IN);
    } else {
      setBox(uniforms.uFromBox.value, next === index ? nextRect : targets[index].getBoundingClientRect());
      uniforms.uFade.value = 1;
    }
    sphere.visible = onSphere;
    dots.visible = !onSphere || morph > 0;

    const shape = track.names[Math.round(cursor)];
    if (canvas.dataset.shape !== shape) canvas.dataset.shape = shape;
    renderer.render(scene, camera);
  };

  const drawStill = () => draw(Math.round(cloudCursor(window.scrollY, anchors)));

  const setTheme = (next: Theme) => {
    directional.intensity = LIGHTS[next].directional;
    ambient.intensity = LIGHTS[next].ambient;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    // the renderer outputs linear values untouched, so the css numbers are kept as they are
    const color = uniforms.uColor.value.setStyle(accent, LinearSRGBColorSpace);
    if (next === 'light') color.multiplyScalar(1 - LIGHT_DARKEN);
    dotsMaterial.blending = next === 'dark' ? AdditiveBlending : NormalBlending;
    uniforms.uSoft.value = next === 'dark' ? 1 : 0;
    if (!mode.live) drawStill();
  };

  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    uniforms.uViewport.value.set(width, height);
    // same breakpoints as the original: mobile 696, tablet 1040
    const [x, y] = width <= 696 ? [14, 10] : width <= 1040 ? [18, 14] : [22, 16];
    sphere.position.set(x, y, 0);
    if (!mode.live) drawStill();
  };

  const tiltTarget = { x: 0, y: 0 };
  const tilt = { x: 0, y: 0, vx: 0, vy: 0 };
  const pointer = new Vector2();
  let push = 0;
  const onPointer = (event: PointerEvent) => {
    tiltTarget.x = event.clientY / window.innerHeight / 2;
    tiltTarget.y = event.clientX / window.innerWidth / 2;
    pointer.set(event.clientX, event.clientY);
    push = mode.push && event.pointerType === 'mouse' ? 1 : 0;
  };
  const onPointerOut = (event: PointerEvent) => {
    if (!event.relatedTarget) push = 0;
  };

  const start = performance.now();
  let frame = 0;
  let previous = start;
  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    const dt = Math.min((now - previous) / 1000, 1 / 30);
    previous = now;
    for (const axis of ['x', 'y'] as const) {
      const v = axis === 'x' ? 'vx' : 'vy';
      const force = -TILT_SPRING.stiffness * (tilt[axis] - tiltTarget[axis]) - TILT_SPRING.damping * tilt[v];
      tilt[v] += (force / TILT_SPRING.mass) * dt;
      tilt[axis] += tilt[v] * dt;
    }
    time.value = TIME_SCALE * (now - start);
    sphere.rotation.z += SPIN_PER_FRAME;
    sphere.rotation.x = tilt.x;
    sphere.rotation.y = tilt.y;

    const follow = 1 - Math.exp(-POINTER_FOLLOW * dt);
    uniforms.uPointer.value.lerp(pointer, follow);
    uniforms.uPush.value += (push - uniforms.uPush.value) * follow;
    uniforms.uSeconds.value = (now - start) / 1000;
    draw(cloudCursor(window.scrollY, anchors));
  };

  const setTrack = (nextAnchors: number[], nextTargets: HTMLElement[]) => {
    const shapes = track.names.length;
    if (nextAnchors.length !== shapes || nextTargets.length !== shapes) {
      throw new Error(
        `cloud track has ${shapes} shapes but got ${nextAnchors.length} anchors and ${nextTargets.length} targets`,
      );
    }
    anchors = nextAnchors;
    targets = nextTargets;
    if (!mode.live) drawStill();
    else if (frame === 0) frame = requestAnimationFrame(loop);
  };

  setTheme(options.theme);
  resize();
  window.addEventListener('resize', resize);
  if (mode.live) {
    window.addEventListener('pointermove', onPointer);
    window.addEventListener('pointerout', onPointerOut);
  } else {
    window.addEventListener('scroll', drawStill, { passive: true });
  }

  return { setTheme, setTrack };
}
