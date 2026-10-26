// port of hamishw.com's displacement-sphere.jsx (MIT, Hamish Williams).
// his shaders replace three's phong shader wholesale against three 0.161; here the same displacement and
// colour maths are spliced into the stock phong shader so it survives three upgrades.
import {
  AmbientLight,
  DirectionalLight,
  LinearSRGBColorSpace,
  Mesh,
  MeshPhongMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  WebGLRenderer,
  type IUniform,
} from 'three';
import noiseGlsl from './sphere-noise.glsl?raw';

export type Theme = 'dark' | 'light';
export type Sphere = { setTheme(theme: Theme): void };

const LIGHTS: Record<Theme, { directional: number; ambient: number }> = {
  dark: { directional: 2.0, ambient: 0.4 },
  light: { directional: 1.8, ambient: 2.7 },
};

// useSpring({ stiffness: 30, damping: 20, mass: 2 }) in the original
const TILT_SPRING = { stiffness: 30, damping: 20, mass: 2 };
const TIME_SCALE = 0.00005;
const SPIN_PER_FRAME = 0.001;
const HEIGHT_OVERSCAN = 1.3;

export function startSphere(canvas: HTMLCanvasElement, theme: Theme, animate: boolean): Sphere {
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = LinearSRGBColorSpace;

  const camera = new PerspectiveCamera(54, 1, 0.1, 100);
  camera.position.z = 52;
  const scene = new Scene();

  const time: IUniform<number> = { value: 0 };
  const material = new MeshPhongMaterial();
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
        vec4 diffuseColor = vec4(cos(finalColors * noise * 3.0), 1.0);`,
      );
  };

  const geometry = new SphereGeometry(32, 128, 128);
  const sphere = new Mesh(geometry, material);
  scene.add(sphere);

  const directional = new DirectionalLight(0xffffff);
  directional.position.set(100, 100, 200);
  const ambient = new AmbientLight(0xffffff);
  scene.add(directional, ambient);

  const setTheme = (next: Theme) => {
    directional.intensity = LIGHTS[next].directional;
    ambient.intensity = LIGHTS[next].ambient;
    if (!animate) renderer.render(scene, camera);
  };

  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight * HEIGHT_OVERSCAN;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    // same breakpoints as the original: mobile 696, tablet 1040
    const [x, y] = width <= 696 ? [14, 10] : width <= 1040 ? [18, 14] : [22, 16];
    sphere.position.set(x, y, 0);
    if (!animate) renderer.render(scene, camera);
  };

  const target = { x: 0, y: 0 };
  const tilt = { x: 0, y: 0, vx: 0, vy: 0 };
  const onPointer = (event: PointerEvent) => {
    target.x = event.clientY / window.innerHeight / 2;
    target.y = event.clientX / window.innerWidth / 2;
  };

  const start = performance.now();
  let frame = 0;
  let last = start;
  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    for (const axis of ['x', 'y'] as const) {
      const v = axis === 'x' ? 'vx' : 'vy';
      const force = -TILT_SPRING.stiffness * (tilt[axis] - target[axis]) - TILT_SPRING.damping * tilt[v];
      tilt[v] += (force / TILT_SPRING.mass) * dt;
      tilt[axis] += tilt[v] * dt;
    }
    time.value = TIME_SCALE * (now - start);
    sphere.rotation.z += SPIN_PER_FRAME;
    sphere.rotation.x = tilt.x;
    sphere.rotation.y = tilt.y;
    renderer.render(scene, camera);
  };

  setTheme(theme);
  resize();
  window.addEventListener('resize', resize);
  if (animate) {
    window.addEventListener('pointermove', onPointer);
    // like the original, only animate while the sphere is on screen
    new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(frame);
      if (entry.isIntersecting) {
        last = performance.now();
        frame = requestAnimationFrame(loop);
      }
    }).observe(canvas);
  } else {
    renderer.render(scene, camera);
  }

  return { setTheme };
}
