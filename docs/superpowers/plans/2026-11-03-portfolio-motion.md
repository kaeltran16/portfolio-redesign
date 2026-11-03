# Portfolio motion: particle cloud plus text and scroll polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `C:\Users\cktra\AppData\Local\arc-wt\aa7c5655\docs\superpowers\specs\2026-11-03-portfolio-motion-design.md`
**Verify:** `npm test && npm run build`
**Setup:** `npm ci --no-audit --no-fund`
**Check:** `npm run build`
**Final:** `npm run build && SHOTS_SERVE=1 node scripts/shots.mjs`

**Goal:** The hero sphere dissolves into one page-wide particle cloud that acts out each project row's steps and settles at Experience, with smooth scroll, split-text headings and springy Experience entrances on Home.

**Architecture:** Pure maths (where the cloud is along the page) goes into `src/lib/scene.ts` and pure shape generation into a new `src/lib/shapes.ts`, both unit tested. One renderer, `src/scripts/cloud.ts`, draws the hero sphere mesh and the particle cloud on one fixed canvas, reading a cursor computed from `window.scrollY` each frame. `page.ts` measures the rows and hands the cloud its track. Lenis (smooth scroll) and GSAP SplitText (headings, Experience) live in their own small modules that `page.ts` imports.

**Tech Stack:** Astro 7, vanilla TypeScript, three 0.186, gsap ^3.15.0 (SplitText), lenis ^1.3.27, vitest, Chrome via CDP (`scripts/shots.mjs`).

## Decisions made beyond the design, and why

1. **The cloud's position along the page is one scalar, the cursor.** The track is an ordered list of shapes: index 0 `sphere`, then every row step in page order (`arc-1..4`, `siem-1..6`, `opal-1..4`), then `settle`. Each index has a scroll anchor; the cursor is the piecewise-linear position of `scrollY` between anchors. An integer cursor is exactly one shape, a fraction is a morph. This one function covers the dissolve, morphs within a row, travel between rows and the settle, is continuous by construction, and is unit tested without a DOM.
2. **A row step's anchor is the scroll position at the middle of that step** (progress `(k - 0.5) / steps`), so the cloud shows shape k exactly where `stepAt` says step k, for pinned and unpinned rows alike. Anchors come from `pinSpan` / `revealSpan`, which restate `pinProgress` / `revealProgress` as the scroll range they run over; tests pin the two forms to each other so they cannot drift.
3. **Anchors are measured, the cursor is read per frame.** `page.ts` recomputes anchors where it already re-measures rows (load, resize, font load) and also under reduced motion. The cloud reads `scrollY` in its own `requestAnimationFrame`, so it moves in step with Lenis rather than with scroll events.
4. **One renderer, one fixed canvas, outside `#intro`.** `<canvas class="cloud" data-cloud>` sits before `<main>`, `position: fixed; inset: 0; z-index: -1; pointer-events: none`. Today `global.css:92-104` gives both `html` and `body` the background, and an in-flow body background paints above a `z-index: -1` layer, which would hide the cloud. So Task 5 splits that rule: `html` keeps margin and fonts but no background; `body` keeps `background-color` and its transition. With no root background, body's propagates to the viewport and paints beneath the canvas, and the canvas paints beneath every piece of content, so the cloud can never be drawn over text. Body keeps the colour because `readable()` and `headerBar()` in `shots.mjs` read `document.body`'s background. A screenshot diff (decision 19) proves the cloud is actually visible. `sphere.ts` is folded into `cloud.ts` and deleted.
5. **The first screen looks as today** by reproducing the old 130%-tall canvas with `camera.setViewOffset(width, introHeight * 1.3, 0, scrollY, width, innerHeight)`: same camera, sphere position breakpoints, noise shader, lights and tilt spring as `sphere.ts`.
6. **The dissolve runs on the GPU from the mesh's own surface.** The points' vertex shader includes `sphere-noise.glsl` and places each sphere-phase particle on the displaced surface with the mesh's formula (`position + normal + position * noise`) and model matrix, so particles start exactly where the mesh was. The mesh fades out over cursor 0 → 1 while particles fade in; the mesh stops rendering once the cursor passes 1.
7. **Morphs run on the GPU.** Two `vec4` attributes, `aFrom` and `aTo` (x, y, z, presence), and a uniform morph factor. Buffers are re-uploaded only when `floor(cursor)` changes, so a phone uploads nothing per frame. Shapes are in a normalised box (x, y, z in [-1, 1]); the shader maps each into the screen box of its target element with one uniform scale (half the box's shorter side times `CLOUD_SPREAD`, centred), so shapes keep their proportions (opal's phone stays phone-shaped) and travel between rows is a lerp of both shape and box.
8. **Presence is the fourth component of every shape.** It is how particles leave (SIEM's triage cut) without changing the particle count: 0 means gone, 1 fully drawn. Particle i is the same particle in every shape.
9. **Each shape forms behind the target element's box, scaled by `CLOUD_SPREAD` (start at 1.6)** so it halos around the scene instead of hiding under it. Targets: index 0 `#intro`, row steps the row's `.project-visual`, `settle` the `.experience-list`.
10. **Phones and short windows use the site's own breakpoint**, `(max-width: 696px), (max-height: 696px)` from `global.css`: compact mode is `width <= 696 || height <= 696`. Desktop 6000 particles (sample K's count); compact starts at 1500 and Task 5 tunes it against the 50 fps gate. Pointer push only in desktop live mode.
11. **Reduced motion: the cloud never starts a `requestAnimationFrame` loop.** It renders on scroll, resize, theme and track changes with `Math.round(cursor)`, no drift, no push. Lenis is not created and GSAP is not imported (dynamic import only when motion is allowed), so nothing ticks.
12. **`canvas.dataset.shape` names the nearest track shape** (`sphere`, `arc-2`, `settle`), written only when it changes. It is the hook the screenshot scenarios use to prove the cloud follows the rows, and costs nothing per frame.
13. **Theme colour comes from CSS.** Dot colour is read from `--accent` on each `setTheme`; light mode lerps it 40% toward black and switches to `NormalBlending` with hard dots, dark uses `AdditiveBlending` with a soft round falloff. Sphere lights keep `sphere.ts`'s per-theme values.
14. **No cloud is a degraded page, not a broken one.** `startCloud` first probes `canvas.getContext('webgl2') ?? canvas.getContext('webgl')` and throws its own `Error('webgl unavailable')` before constructing `WebGLRenderer`, because three's renderer calls `console.error` before rethrowing, and the scenarios fail on any console error. On that throw `page.ts` logs `console.warn('cloud failed to start; the page shows without it', error)` (warn, since a missing GPU is the visitor's environment, not a site bug) and everything else runs.
15. **Lenis: `autoRaf`, native touch, a nav jump wins.** `new Lenis({ autoRaf: true, prevent: node => node.closest('[data-nav-menu]') !== null })`, so a wheel over the open menu (a scroll container, `overflow: auto`, on short windows taller than it) scrolls the menu natively instead of being turned into a page glide; `.menu` gains `overscroll-behavior: contain` so that wheel does not chain to the page at the menu's ends. Touch stays native (Lenis default), so phones keep their own inertia. A `hashchange` listener calls `lenis.scrollTo(scrollY, { immediate: true, force: true })`, so a rail, menu or skip-link jump during a wheel glide is not dragged back. `location.replace` from d6812ad stays as it is. Lenis CSS comes from `lenis/dist/lenis.css`, imported by the module.
16. **Split reveal goes on `.project-title` and `.section-title`** (Arc, SIEM, opal, Experience, About, Contact). `SplitText` with `type: 'words,chars'`, `mask: 'chars'`, `charsClass: 'split-char'`, `aria: 'auto'`, after `document.fonts.ready`. Chars rise from `yPercent: 100`, `power3.out`, ~0.7s, ~0.025s stagger, played once when an `IntersectionObserver` sees the heading.
17. **Experience entrances animate the role's contents, never `.experience-role`.** Targets per role: `.experience-dates, .experience-body h3, .experience-company, .experience-body li`, from `y: 40, opacity: 0`, `back.out(1.6)` (the overshoot), ~0.5s, ~0.06s stagger, triggered per role. `page.ts` reads role rects for the timeline line, so the roles themselves must not move. A role's entrance finishes within 1s so existing 1–1.5s screenshot waits see it at rest.
18. **One reduced-motion flag.** `src/scripts/motion.ts` exports `reduceMotion`; `page.ts`, `smooth.ts` and `reveal.ts` import it instead of each querying `matchMedia`.
19. **`shots.mjs` gains small driver features.** Task 3 adds a real wheel: a scenario's `wheel: { at, deltaY }` is sent through CDP `Input.dispatchMouseEvent` (`type: 'mouseWheel'`) at the centre of the `at` selector (or the viewport) right after `eval`, then an optional `after` expression is evaluated with no wait. A synthetic `WheelEvent` never scrolls natively, so it cannot prove the menu case. Task 5 adds:
    - an `init` script injected before page load (`Page.addScriptToEvaluateOnNewDocument`);
    - a `throttle` CPU rate (`Emulation.setCPUThrottlingRate`);
    - `cloudVisible: <share>`: after the screenshot the driver hides `[data-cloud]` (`visibility: hidden`), takes a second screenshot, decodes both in the page (`Image` plus a 2D canvas) and fails unless at least that share of pixels differs by more than 24 summed RGB. This proves the cloud is visible, which `data-shape` and `elementFromPoint` cannot;
    - `gpu: true` scenarios run in a second Chrome launched without the forced SwiftShader flags, in the same run and the same `shots.json`. If that Chrome still reports SwiftShader (`WEBGL_debug_renderer_info`), the step is recorded as `skip`, and once everything else has passed the run exits 3 with a last line naming the unverified steps. So the Final gates the 50 fps check where there is a GPU, and says loudly that it could not verify it where there is none.
20. **Scene scenarios check the cloud mid-step.** `toStep` and `toRevealStep` scroll to progress `(k - 0.5) / steps`, which is exactly the step-k anchor of decision 2, so `data-shape === '<slug>-<k>'` there is exact, not a near-boundary guess.
21. **Reduced motion: rows still show their last frame (`page.ts:176-182` sets no `data-step`), while the cloud still follows the scroll from still shape to still shape.** This mismatch is deliberate. The spec asks for still shapes, not for no cloud, and a cloud frozen on one shape would leave every row but one without its picture.
22. **File ownership drives the order.** `shots.mjs` and `page.ts` are single files every feature touches, so the polish task (3) and the cloud wiring (5) are chained on them; the shape and maths tasks (1, 2) and the renderer (4) run beside the polish.

## Global Constraints

- Dependencies added: `gsap` and `lenis` only, from npm, bundled by Astro. Nothing from a CDN.
- No new claim: the only number the cloud shows is the CV's 95–97% triage cut (3–5% of particles survive).
- The project rows' pinning and step logic (`stepAt`, `pinProgress`, `revealProgress`, `canPin`, `measureScenes`) keep their behaviour; every existing scenario in `scripts/shots.mjs` keeps passing.
- The intro name keeps its decode effect; no split on `.intro-name`.
- Reduced motion: no smooth scroll, no split, no stagger, rows show their last frame, the cloud draws still shapes.
- Comments only for why, lower case, as in the existing files.

## Review Focus

1. **A wheel glide in progress when a nav link or the skip link jumps.** Expected: the page lands on the target and stays. Test: Task 3 `smooth-nav-jump`.
2. **Wheel over the open menu on a short desktop window (1440x360, where the menu overflows; at 1440x400 its 292px of content fits the 302px max-height).** Expected: the menu scrolls and the page does not move under it. Test: Task 3 `smooth-menu-wheel`.
3. **A pinned row whose window turns short (pinned → unpinned).** Expected: the cloud re-anchors and still shows the row's current step. Test: Task 5 `cloud-resize`.
4. **Home opened deep at `/#experience`.** Expected: the cloud is already settled, with no replay from the sphere. Test: Task 5 extends `scenes-anchor`.
5. **No WebGL.** Expected: rows step, headings reveal, nav works, a warning is logged, no error. Test: Task 5 `cloud-no-webgl`.

---

### Task 1: Cloud track maths in scene.ts
**Depends on:** none
**Files:** `src/lib/scene.ts`, `src/lib/scene.test.ts`

Pure functions the cloud and `page.ts` share. No DOM.

**Interfaces (produces):**
```ts
// global.css: @media (max-width: 696px), (max-height: 696px)
export const COMPACT_MAX = 696;
export const CLOUD_COUNT = 6000;
export const COMPACT_CLOUD_COUNT = 1500; // Task 5 tunes this
export type CloudMode = { count: number; push: boolean; live: boolean };
export function cloudMode(width: number, height: number, reduceMotion: boolean): CloudMode;
export type Span = { start: number; end: number }; // scroll positions over which a row's progress runs 0 -> 1
export function pinSpan(top: number, height: number, viewport: number, scroll: number): Span;
export function revealSpan(centre: number, viewport: number, scroll: number): Span;
export function trackAnchors(rows: (Span & { steps: number })[], settleAt: number): number[];
export function cloudCursor(scroll: number, anchors: number[]): number;
```

- [ ] **Tests first** in `src/lib/scene.test.ts`:
  - `cloudMode`: 1440x900 → `{ count: CLOUD_COUNT, push: true, live: true }`; 390x844 and 1440x650 and 696x900 → count `COMPACT_CLOUD_COUNT`, push false; 697x697 → desktop; reduced motion at any size → `live: false, push: false`.
  - `pinSpan` / `revealSpan` agree with `pinProgress` / `revealProgress`: for several scrolls s, `(s - start) / (end - start)` clamped equals the progress the old functions give for the rect moved by `s - scroll`. Includes the `height <= viewport` case, where `start === end`.
  - `trackAnchors`: length `2 + sum(steps)`; first 0, last `settleAt`; row step k anchor at `start + (k - 0.5) / steps * (end - start)`; output is non-decreasing even when inputs overlap or `settleAt` is early (clamped to the running max).
  - `cloudCursor`: at each anchor returns its index; halfway between two distinct anchors returns i + 0.5; below the first → 0; above the last → last index; equal anchors produce no NaN and the higher index once scroll reaches them; `[0, 500]` (no rows) works.
- [ ] Run `npx vitest run src/lib/scene.test.ts`: new tests fail, then implement, then they pass. Existing scene tests stay green.

### Task 2: Particle shapes in shapes.ts
**Depends on:** none
**Files:** `src/lib/shapes.ts`, `src/lib/shapes.test.ts`

Pure, no DOM, no three. Deterministic from a seed (a small PRNG such as mulberry32 in the file).

**Interfaces (produces):**
```ts
export type Track = { names: string[]; shapes: Float32Array[] }; // per track index; each shape is count * 4: x, y, z, presence
export function buildTrack(rows: { slug: string; steps: number }[], count: number, seed?: number): Track;
```
- `names` = `['sphere', ...rows.flatMap(r => steps 1..n as `${slug}-${k}`), 'settle']`.
- Index 0 (`sphere`): unit-sphere directions (Fibonacci sphere), presence 1. The renderer places them on the displaced mesh surface.
- Every other shape: x, y, z in [-1, 1], presence in [0, 1].
- Stories, shapes within them the worker's call:
  - **arc** (run, worker, ask, diff): one goal splits into a task graph; workers split into separate lanes (git worktrees); one lifts out as the question; lanes merge back into one trunk.
  - **siem** (events, risk, intel, chain, alerts, agent): a wide noisy stream pours in; scoring pulls an outlier out; intel and correlation link a few clusters; at alerts 95–97% of particles go (presence 0) and the 3–5% left gather; the agent step keeps those same survivors as the answer.
  - **opal** (Today, Areas, Workout, You): each screen arrives as dots inside a phone-shaped rectangle (250:510), one distinct pattern per screen.
  - **settle**: a calm, low-motion shape for Experience.
- Unknown slug, or a step beyond the story's count, throws `Error` naming the slug and step, so data drift is loud.

- [ ] **Tests first** in `src/lib/shapes.test.ts`:
  - names for `[{arc,4},{siem,6},{opal,4}]` are `sphere, arc-1..arc-4, siem-1..siem-6, opal-1..opal-4, settle`; shapes has the same length; each shape has length `count * 4`.
  - every component within its range; sphere directions have length 1 ± 1e-6.
  - siem-5 survivors (presence > 0.5) are between 3% and 5% of count, for count 1500 and 6000; siem-6 survivors are the same indices; siem-1..4 have every particle present.
  - arc-2 particles split into at least 2 groups along x (a gap of at least 0.2 in sorted x); arc-4 has no gap above 0.1 (one trunk).
  - each opal shape's present particles have a bounding box with width / height within 5% of 250 / 510; consecutive opal shapes differ (mean particle displacement > 0.05).
  - same seed → identical arrays; unknown slug and `siem` step 7 throw.
- [ ] Run `npx vitest run src/lib/shapes.test.ts`: fail first, then pass.

### Task 3: Smooth scroll, split headings, springy Experience
**Depends on:** none
**Files:** `package.json`, `package-lock.json`, `src/scripts/motion.ts`, `src/scripts/smooth.ts`, `src/scripts/reveal.ts`, `src/scripts/page.ts`, `src/styles/global.css`, `scripts/shots.mjs`

Decisions 15–18 and the wheel driver of 19 apply. In `global.css` this task adds only `overscroll-behavior: contain` to `.menu`.

- [ ] `npm install gsap@^3.15.0 lenis@^1.3.27`.
- [ ] `src/scripts/motion.ts`: `export const reduceMotion: boolean` from `matchMedia('(prefers-reduced-motion: reduce)')`. `page.ts` imports it in place of its own constant, and imports `./smooth` and `./reveal` (Home only, as `page.ts` is).
- [ ] `src/scripts/smooth.ts`: Lenis as decision 15, created only when `!reduceMotion`.
- [ ] `src/scripts/reveal.ts`: when `!reduceMotion`, dynamically import `gsap` and `gsap/SplitText`, then headings and Experience as decisions 16–17. A failed import is logged with `console.error` and leaves the content visible (nothing is hidden before the split succeeds).
- [ ] Add scenarios to `scripts/shots.mjs`, each with a `step` line:
  - `smooth-wheel` (desktop): `html` has class `lenis`; a real wheel of deltaY 800, with `after` storing `scrollY` two frames later, gives `0 < stored < 800` and `|scrollY - 800| <= 2` after the wait.
  - `smooth-nav-jump` (desktop): a real wheel of deltaY 3000, with `after` clicking the `#about` rail link at once; after 1500ms the hash is `#about` and the About heading is inside the viewport.
  - `smooth-menu-wheel` (1440x360): `eval` opens the menu and records `scrollY`; first assert the menu overflows (`scrollHeight > clientHeight`, else return an error, since the case would be untested); a real wheel of deltaY 300 at `.menu`; after 800ms `menu.scrollTop > 0` and `scrollY` unchanged.
  - `headings-waiting` (desktop, top of page): every `.project-title` and `.section-title` holds `.split-char` elements, the opal title's chars are translated (not at rest), and each heading's accessible text (its `aria-label`, or text when none) equals its original text.
  - `headings-revealed` (desktop, `show('about')`, wait 1500): the About title's `.split-char` elements are at rest (transform `none` or identity matrix).
  - `experience-enter` (desktop): the eval scrolls to Experience and records the first role's `h3` translateY every frame for 1000ms; the check passes when the minimum is below -0.5 (overshoot past rest) and, after the wait, every animated item is at rest with opacity 1.
  - `motion-reduced` (reduced motion, `show('experience')`): no `lenis` class, no `.split-char` on the page, no Experience item with an inline transform or opacity.
- [ ] Run `npm run build && SHOTS=smooth-wheel,smooth-nav-jump,smooth-menu-wheel,headings-waiting,headings-revealed,experience-enter,motion-reduced,nav-jumps,menu-phone-jumps,skip-link,nav-cue-reduced-motion,scenes-anchor,scenes-focus,experience-draw-mid,experience-reduced-motion SHOTS_SERVE=1 node scripts/shots.mjs`: all pass. The nav scenarios from d6812ad are the guard that Lenis kept anchors, scroll-margin and the skip link working.

### Task 4: Cloud renderer
**Depends on:** Task 1 (imports `cloudCursor`, `CloudMode`), Task 2 (imports `buildTrack`)
**Files:** `src/scripts/cloud.ts`, `src/scripts/cloud.test.ts`

The one renderer: sphere mesh plus points (decisions 4–9, 11–13). It is not wired into the page here; Task 5 does that and carries its screenshot proof. Do not edit `sphere.ts` or `page.ts` (Task 3 and 5 own them); port the mesh code from `sphere.ts` into this file. `sphere-noise.glsl` is read, not changed.

**Interfaces (produces):**
```ts
export type Theme = 'dark' | 'light';
export type Cloud = {
  setTheme(theme: Theme): void;
  // anchors from trackAnchors; targets[i] is the element shape i forms behind (same length as anchors)
  setTrack(anchors: number[], targets: HTMLElement[]): void;
};
export function startCloud(
  canvas: HTMLCanvasElement,
  options: { theme: Theme; mode: CloudMode; rows: { slug: string; steps: number }[] },
): Cloud;
```
- Probes WebGL first and throws `Error('webgl unavailable')` before touching three (decision 14). Draws nothing until the first `setTrack`.
- `export function boxTransform(rect: { left: number; top: number; width: number; height: number }, spread: number): { x: number; y: number; scale: number }` is the pure mapping of decision 7: centre in CSS px, scale `min(width, height) / 2 * spread`. The shader receives its output.
- Live mode: one `requestAnimationFrame` loop; per frame `cursor = cloudCursor(scrollY, anchors)`, the two neighbour targets' rects (at most two `getBoundingClientRect` calls), eased morph, drift, pointer push when `mode.push`. Writes `canvas.dataset.shape` on change.
- Still mode (`!mode.live`): no rAF; render on `scroll`, `resize`, `setTheme`, `setTrack` at `Math.round(cursor)`.
- `CLOUD_SPREAD` and any timing constants named at the top of the file.

- [ ] **Tests first** in `src/scripts/cloud.test.ts` (vitest's node environment; the canvas is a stub object):
  - `startCloud` on `{ getContext: () => null }` throws an `Error` whose message is `webgl unavailable`, and never reaches three (no `console.error` is called: spy on it).
  - `boxTransform({ left: 100, top: 50, width: 680, height: 520 }, 1.6)` gives `{ x: 440, y: 310, scale: 416 }`; a zero-size rect gives scale 0 and no NaN.
  - The module's imports of `cloudCursor`, `cloudMode`'s type and `buildTrack` resolve: `import * as scene` / `import * as shapes` in the test and assert `typeof scene.cloudCursor === 'function'` and `typeof shapes.buildTrack === 'function'`. Vite does not type-check, so this guards the cross-task names.
- [ ] Run `npx vitest run src/scripts/cloud.test.ts`: fail first, then pass. The rendering itself is proven by Task 5's scenarios, where the file is first imported.

### Task 5: Wire the cloud into Home
**Depends on:** Task 3, Task 4
**Files:** `src/scripts/page.ts`, `src/pages/index.astro`, `src/styles/global.css`, `src/scripts/sphere.ts`, `src/scripts/theme.ts`, `src/scripts/cloud.ts`, `src/lib/scene.ts`, `src/lib/scene.test.ts`, `scripts/shots.mjs`, `README.md`

- [ ] `index.astro`: remove the `[data-sphere]` canvas from `#intro`; add `<canvas class="cloud" aria-hidden="true" data-cloud></canvas>` before `<main>`; add `data-slug={slug}` to each `.project` article.
- [ ] `global.css`: replace `.sphere` with `.cloud` per decision 4, keeping the 3s fade-in on `data-visible`. Split the `html, body` rule (lines 92-104) so `background-color` and its transition sit on `body` only. No section background may hide the canvas.
- [ ] `page.ts`: lazy-import `./cloud` (as the sphere is today), `startCloud` with `cloudMode(innerWidth, innerHeight, reduceMotion)`, rows from `data-slug` and `stepsOf`. A `measureCloud()` builds spans (`pinSpan` on the row rect when `data-pinned`, else `revealSpan` on the visual's centre), `settleAt = scrollY + experienceList.top - READING_LINE * innerHeight`, anchors via `trackAnchors`, targets `[#intro, each row's .project-visual once per step, .experience-list]`, and calls `setTrack`. It runs at the end of `measureScenes` and, under reduced motion, on load, `resize` and font `loadingdone`. A start failure logs the `console.warn` of decision 14. Theme change calls `cloud.setTheme`.
- [ ] Delete `src/scripts/sphere.ts` (its only importer is `page.ts`; grep first). Update the comment in `theme.ts` and the sphere mention in `README.md` to the cloud.
- [ ] `shots.mjs`: decision 19's `init`, `throttle`, `cloudVisible` and `gpu`. Scenarios, each with a `step` line:
  - existing `scene-arc-*`, `scene-siem-*`, `scene-opal-*` (and their `-light` and phone variants) also check `[data-cloud]` `data-shape === '<slug>-<k>'` (exact, decision 20), and that `elementFromPoint` at the row title's centre lands inside the title (canvas beneath text). `scene-arc-2`, `scene-siem-3-light` and `scene-opal-2-phone-390` also carry `cloudVisible: 0.002`.
  - `cloud-hero` (desktop top, `cloudVisible: 0.02`): one `[data-cloud]`, fixed, viewport-sized, `pointer-events: none`, `data-shape` `sphere`, no `[data-sphere]`; the intro name's centre hits the name. `cloud-hero-phone-390` and `cloud-hero-light` the same at 390px and in light.
  - `cloud-dissolve` (desktop, scrolled 40% of the way from 0 to the `arc-1` anchor, `cloudVisible: 0.005`): `data-shape` `sphere`; the screenshot shows the sphere breaking into dots.
  - `cloud-sweep` (desktop) and `cloud-sweep-phone-390`: scroll from the top to past Experience in steps of a twelfth of the viewport; the `data-shape` sequence visits every track name in order and never goes back.
  - `cloud-settle` (desktop, `show('experience')`): `data-shape` `settle`.
  - `cloud-resize`: desktop at arc step 2, resized to 1280x480: `data-shape` equals `arc-` plus the row's `data-step`.
  - `scenes-anchor` (existing, opened at `/#experience`): also `data-shape` `settle`.
  - `cloud-reduced-motion` (reduced motion): after load, the eval wraps `requestAnimationFrame` with a counter and scrolls the SIEM row into view; after 1000ms idle, no frame was requested, and `data-shape` starts with `siem-`.
  - `cloud-no-webgl` (`init` makes `HTMLCanvasElement.prototype.getContext` return null for webgl/webgl2): no `[data-shape]`; rows still reach their steps when scrolled; headings still split; no console error (the warning of decision 14 is allowed).
  - `cloud-phone-fps` (`gpu: true`, 390px phone, `throttle: 4`): scroll through `#projects` over at least 2s, one step per frame, counting frames; pass at 50 fps or more.
- [ ] Tune `COMPACT_CLOUD_COUNT` in `scene.ts` until `SHOTS=cloud-phone-fps` passes; adjust the `cloudMode` test if its literal changes. Put the measured fps in the commit body. If this machine's GPU Chrome also reports SwiftShader, keep 1500 and say plainly in the task report that the 50 fps gate is unverified.
- [ ] Run `npm test`, then `npm run build && SHOTS_SERVE=1 node scripts/shots.mjs`: every scenario passes. Exit 3 is acceptable only when its last line says the fps step had no GPU.
