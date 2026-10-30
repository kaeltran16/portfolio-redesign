# Portfolio polish: scroll scenes on Home — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Effort:** effort:cfbbf16d-7742-4c43-a3d1-46211de27e7b
**Spec:** `C:\Users\kael02\IdeaProjects\portfolio-redesign\docs\superpowers\specs\2026-10-30-portfolio-polish-design.md`
**Verify:** `npm test && npm run build`
**Check:** `npm run build`
**Final:** `npm run build && SHOTS_SERVE=1 node scripts/shots.mjs`
**Prototype:** C:\Users\kael02\IdeaProjects\portfolio-redesign\.superpowers\design\scroll-scenes\project\Experience.dc.html

**Goal:** The Arc and SIEM rows on Home pin and play their diagrams in steps as you scroll, phones play the same steps without pinning, and the Experience timeline draws down with scroll.

**Architecture:** Each scene's data (which step every SVG element belongs to, step captions, SIEM event cards) lives in `src/data.ts`. `ProjectVisual.astro` renders it with `data-at` on every element; a new `src/styles/scenes.css` styles each step off the row's `data-step`. One passive scroll listener in `src/scripts/page.ts` turns row position into `data-step` (and `data-pinned` when the window can hold the row) through pure functions in `src/lib/scene.ts`, and fills the timeline.

**Tech Stack:** Astro 7, vanilla TypeScript, CSS (container queries, sticky), vitest, Chrome via CDP (`scripts/shots.mjs`).

## Decisions made beyond the design, and why

1. **opal is out of this run** (spec section "Deferred: opal", approved by Khang). No Flutter SDK exists on this machine and Khang will supply the Areas, Workout and You captures later. The opal row renders exactly as today (one Today image, no pin, no names, no caption); the Opal board moved to `scroll-scenes/deferred/`, so the Prototype folder holds Main (Arc), SIEM and Experience. The data shape leaves the phone visual alone so a later run adds `screens` without touching the diagrams. The plan carries no Chunk line: the initiative chunk is not finished by this run.
2. **No wrapper element for the pin** (now in the spec, approved by Khang). The `.project` grid itself becomes the tall scroll track (`min-height: (steps + 1) × 100svh`) and its two grid items (`.project-text`, `.scene`) are `position: sticky; top: 0; height: 100svh`, content centred. A wrapper per row would break `.project:nth-of-type(even)` (each article would be alone in its wrapper) and force edits in `global.css`. This way `global.css` stays untouched by the scene work and is free for the timeline task. Pin length: `steps` viewports of pinned scroll.
3. **Step membership is `data-at="k"` on each SVG element, the current step is `data-step="k"` on the row.** One attribute name per meaning. CSS enumerates the combinations (at most 4 steps, so 3 rules per state). Elements with `data-at` greater than the step are at opacity 0.12 (the boards' value).
4. **Packets differ per diagram, as the boards draw them.** Arc: packets run on every reached edge (step 3 still shows the step 2 packets). SIEM: packets run only on the edge into the lit stage. Encoded as `packets?: 'reached' | 'current'` on the diagram (default `'reached'`), rendered as `data-packets` on the `<svg>`.
5. **SIEM shift is a CSS transform, not new geometry.** Data keeps today's centred coordinates (box x 200); in a step, a `.diagram-body` group gets `transform: translateX(-100px)` (SVG user units, same as moving box x 200 to 100). The still visual on case pages and in static mode is therefore pixel-identical to today.
6. **Narrow SIEM card goes under the 680:520 box, inside the scene figure, not inside the box** (now in the spec, approved by Khang). Fitting the card inside the box would shrink the SVG to about 140px tall at 390px, rendering 16px labels at about 4px. The box itself keeps its size, so `projectsFit` (all visuals the same size) still holds, and the card sits between the diagram and the step caption, above the row's text, so no text is covered. Wide/narrow is a container query on the scene figure at 560px (tune so the card's longest line does not wrap). Landed at 648px: the longest card line needs it.
7. **One static mode for no-JS and reduced motion** (now in the spec, approved by Khang). With no `data-step` on the row: every element lit, packets as today, SIEM centred with no card, all step captions listed under the visual. The spec requires listed captions under reduced motion; showing the same to no-JS visitors keeps one code path and loses no content. Case pages pass `still` to `ProjectVisual`, which then renders exactly today's markup (no figure, no captions, no `data-at`).
8. **Scene styles live in a new `src/styles/scenes.css`, imported by `ProjectVisual.astro`.** `ProjectVisual` is the only producer of scene markup; keeping its styles out of `global.css` lets the timeline task own `global.css` at the same time. It loads on case pages too, where every rule matches nothing.
9. **Timeline keeps its per-role segments.** Each role's `.experience-marker::after` segment fills with accent from its top by `--fill` (0..1, set per role by the driver). The marker column moves at 696px; segments already follow it, so no absolute line needs positioning at each breakpoint. A role's marker is filled when it has `data-reached` (the driver sets it when the role's fill is above 0). `data-current` goes away: when fully drawn every marker is filled.
10. **Driver geometry, as named constants in `src/lib/scene.ts`:** unpinned progress runs while the visual's centre moves from 80% to 20% of the viewport height; the timeline's "reading line" sits at 60% of the viewport height; pinning needs width > 1040px (the stacking breakpoint is `max-width: 1040px`, so 1040 itself is stacked; round 1 renamed the constant to `STACK_MAX_WIDTH`, see `2026-10-30-portfolio-polish-round-1.md`) and the row's measured content height <= the viewport height. Content height is re-measured on resize and on `document.fonts` `loadingdone` (the web font changes line heights after first layout, as `fitTitle` already handles).
11. **`scripts/shots.mjs` hosts its own server for Final.** With `SHOTS_SERVE=1` it starts `astro preview` (serving `dist/`) on a free port, points `BASE_URL` at it and stops it when done; Chrome's devtools port also becomes free-picked (`--remote-debugging-port=0`, read from `DevToolsActivePort` in the profile dir). Final then runs without a pre-started dev server, and workers in parallel trees do not collide on ports 4321 or 9333.
12. **Check is `npm run build`.** No TypeScript checker is installed and `@astrojs/check` would be a new dependency; the build catches template and syntax errors.

## Global Constraints

- No new dependencies; `package.json` and `package-lock.json` do not change.
- Reuse tokens from `src/styles/global.css`: `--durationM`, `--bezierFastoutSlowin`, `--accent`, `--text`, `--textLight`. Transitions use `var(--durationM) var(--bezierFastoutSlowin)`.
- Both themes (`[data-theme]` on `<html>`) work; step captions and lit elements keep 4.5:1 contrast; faint (0.12) elements are decorative.
- Only the Arc and SIEM rows pin. About, Contact, the intro and case pages behave as today.
- On phones (1040px and below) nothing is ever `position: sticky` in `#projects`, and no text is covered.
- `prefers-reduced-motion: reduce`: no pin, no `data-step`, static mode, packets still (existing `packetsStill` check keeps passing).
- Each `<svg class="diagram">` keeps `role="img"` and its whole-diagram `aria-label` at every step.
- Every step caption is in the DOM at every step; non-current ones are visually hidden (clip pattern, as `.visually-hidden`), never `display: none`.
- The sample event uses only 10.0.4.12 and 203.0.113.9.
- Comments: lower case, only for why (repo convention).
- Existing shots scenarios keep passing, including `projectsFit`, `project-links` and every `case-*`.

## Review Focus

1. **Resizing across the pin thresholds mid-scroll** (desktop to narrow, or a window made shorter than the row): the row must drop `data-pinned` and its tall height at once and switch to unpinned progress, with no stale tall gap. Pinned by `canPin` unit tests (Task 1) and the re-measure-on-resize requirement plus `scenes-short-window` (Task 5).
2. **Landing mid-page** (`/#experience`, reload while scrolled, End key): rows above must already show their last step and the timeline must be drawn to the reading line, computed from position on load, not accumulated from scroll events. Pinned by `scenes-anchor` (Task 5).
3. **Keyboard focus through a pinned row**: focusing the next row's View project link must scroll to it, not leave it hidden behind the pinned row. Pinned by `scenes-focus` (Task 5).
4. **SIEM card at phone width**: the card must stay within the viewport width and must not overlap the row's text or the step caption. Pinned by `scene-siem-2-phone-390` (Task 2).
5. **Off-by-one between progress and step** at exact step edges and at 0 / 1: pinned by `stepAt` boundary tests (Task 1) and the per-step `data-step` checks (Task 5).

## DOM contract (shared by Tasks 2, 3 and 4)

Home project row, for a diagram visual (Arc, SIEM); opal's row is unchanged:

```html
<article class="project">                         <!-- driver writes data-step="k", data-pinned, style="--steps: N" -->
  <div class="project-text">…unchanged…</div>
  <figure class="scene" data-steps="N">           <!-- N = captions.length -->
    <div class="project-visual">
      <svg class="diagram" role="img" aria-label="…" viewBox="0 0 680 520" [data-packets="current"]>
        <g class="diagram-body">
          <g class="diagram-edges"><path data-at="k" …/>…</g>
          <g class="diagram-packets"><path data-at="k" …/>…</g>
          <g class="diagram-boxes"><rect data-at="k" …/>…</g>
          <g class="diagram-labels"><text data-at="k" …/>…</g>
          [SIEM] <path class="scene-tick" data-at="k" d="M480 y L514 y"/>…   <!-- y = stage centre -->
        </g>
      </svg>
    </div>
    [SIEM] <div class="scene-card" data-at="k" style="--y: <stage centre y>">title + lines</div>…
    <figcaption><ol class="scene-captions">
      <li data-at="k"><span class="scene-count">0k / 0N</span> <span>caption</span></li>…
    </ol></figcaption>
  </figure>
</article>
```

Timeline (Task 3 styles it, Task 4 drives it, Task 5 checks it): `.experience-list[data-drawing]` is set by the driver when it runs; each `.experience-role` gets `style="--fill: <0..1>"` and `data-reached` when its fill is above 0. Without `data-drawing` the timeline is fully drawn.

---

### Task 1: Scroll-to-step math

**Depends on:** none
**Files:** `src/lib/scene.ts`, `src/lib/scene.test.ts`

Pure functions, no DOM, tested like `src/lib/decode.ts`.

**Interfaces — Produces** (`src/lib/scene.ts`):
- `PIN_MIN_WIDTH = 1040`, `REVEAL_START = 0.8`, `REVEAL_END = 0.2`, `READING_LINE = 0.6` (exported consts).
- `stepAt(progress: number, steps: number): number` — 1-based; `min(steps, floor(clamp01(progress) * steps) + 1)`; NaN progress gives 1.
- `pinProgress(top: number, height: number, viewport: number): number` — row rect top/height; 0 while the row's top is at or below the viewport top, 1 once its bottom reaches the viewport bottom, clamped. When `height <= viewport`, returns `top <= 0 ? 1 : 0`.
- `revealProgress(centre: number, viewport: number): number` — 0 when the visual's centre is at `REVEAL_START * viewport`, 1 at `REVEAL_END * viewport`, clamped.
- `fillFraction(top: number, height: number, line: number): number` — share of a box above `line`, clamped 0..1; 0 for `height <= 0` when `line < top`, else 1.
- `canPin(width: number, height: number, content: number): boolean` — `width >= PIN_MIN_WIDTH && content <= height`.

- [ ] **Step 1: Write the failing tests** in `src/lib/scene.test.ts`:
  - `stepAt`: `(0,3)→1`, `(0.3333,3)→1`, `(1/3,3)→2`, `(2/3,3)→3`, `(1,3)→3`, `(-0.5,3)→1`, `(1.5,3)→3`, `(0.2499,4)→1`, `(0.25,4)→2`, `(0.75,4)→4`, `(1,4)→4`, `(0.5,1)→1`, `(NaN,3)→1`. These fail if steps are off by one.
  - `pinProgress`: `(0, 3600, 900)→0`, `(100, 3600, 900)→0`, `(-1350, 3600, 900)→0.5`, `(-2700, 3600, 900)→1`, `(-5000, 3600, 900)→1`, `(-10, 800, 900)→1`, `(10, 800, 900)→0`.
  - `revealProgress`: `(800, 1000)→0`, `(900, 1000)→0`, `(500, 1000)→0.5`, `(200, 1000)→1`, `(0, 1000)→1`.
  - `fillFraction`: `(100, 200, 50)→0`, `(100, 200, 200)→0.5`, `(100, 200, 400)→1`.
  - `canPin`: `(1440, 900, 700)→true`, `(1039, 900, 700)→false`, `(1040, 900, 900)→true`, `(1440, 600, 700)→false`.
- [ ] **Step 2:** `npx vitest run src/lib/scene.test.ts` fails (module missing).
- [ ] **Step 3:** Implement `src/lib/scene.ts` with the signatures above.
- [ ] **Step 4:** `npx vitest run src/lib/scene.test.ts` passes.
- [ ] **Step 5:** Commit `feat: scroll-to-step math for the home scenes`.

### Task 2: Scene visuals for Arc and SIEM (data, markup, step styles)

**Depends on:** none
**Files:** `src/data.ts`, `src/data.test.ts`, `src/components/ProjectVisual.astro`, `src/pages/projects/[slug].astro`, `src/styles/scenes.css`, `scripts/shots.mjs`

What each step looks like, driven by a `data-step` set by hand; Task 4 sets it from scroll and Task 5 turns these scenarios scroll-driven. Follow `Main.dc.html` (Arc) and `SIEM.dc.html` in the Prototype's folder.

**Data shape** (`src/data.ts`; replaces the diagram arm of `Visual`, phone arm unchanged):

```ts
type Label = { x: number; y: number; text: string; tone?: 'primary' | 'caption'; at: number };
export type Visual =
  | {
      kind: 'diagram';
      label: string;
      edges: { d: string; at: number }[];
      boxes: { rect: [number, number, number, number]; at: number }[];
      labels: Label[];
      captions: string[];                              // one per step
      cards?: { title: string; lines: string[] }[];    // one per step (SIEM)
      packets?: 'reached' | 'current';                 // default 'reached'
    }
  | { kind: 'phone'; image: ImageMetadata; alt: string };
```

Step assignments (geometry unchanged):
- Arc edges in today's order: `at` 2, 2, 2, 2, 3. Boxes in today's order: 1, 1, 1, 2, 2, 2, 2, 2, 3. Labels: agents, claude code, claude code, run → 1; wsh, arc, runs, initiatives, notes → 2; cockpit → 3.
- SIEM boxes and labels (four stages, top to bottom): 1, 2, 3, 4. Edges: 2, 3, 4 (each lights with the stage it enters). `packets: 'current'`.

Captions, verbatim from the boards (draft copy):
- Arc: `Agents run in their own terminals: Claude Code sessions and orchestrated runs.` / `Each one reports through wsh, and Arc records it as runs, initiatives and notes.` / `The cockpit shows all of it beside the terminal.`
- SIEM: `A raw firewall log arrives from one of the vendor sources: Check Point, F5, CrowdStrike, VMware ESXi.` / `The AI parser maps it onto the platform schema. No hand-written parser for this source.` / `Detection scores it against the tenant’s baseline and maps it to a MITRE ATT&CK technique.` / `The analyst sees one alert in the management panel, already explained.`

SIEM cards (title, then lines; aligned columns use spaces, render with `white-space: pre-wrap`):
1. `raw log, as it arrives` — `Oct 30 08:24:11 fw01 drop`, `src=10.0.4.12 dst=203.0.113.9`, `dport=22 proto=tcp`
2. `parsed onto the schema` — `src_ip    10.0.4.12`, `dst_ip    203.0.113.9`, `dst_port  22`, `action    drop`
3. `flagged` — `anomaly: repeated drops on :22`, `MITRE ATT&CK  T1110`, `Brute Force`
4. `in the management panel` — `alert  Brute Force on fw01`, `10.0.4.12 → 203.0.113.9:22`, `explained by the AI assistant`

Add a comment beside the cards: the event is invented for illustration, documentation-range and private IPs, not customer data.

**Markup** (`ProjectVisual.astro`): new optional prop `still?: boolean`. With `still` or a phone visual, render exactly today's markup (plus `data-at` is fine to omit). Otherwise render the DOM contract above. The card's `--y` and the tick's y are the centre (`y + h/2`) of the box with the same `at`, computed in the component, not hard-coded. `import '../styles/scenes.css'` in the frontmatter. `[slug].astro` passes `still`.

**Styles** (`src/styles/scenes.css`), all keyed off the row's `data-step`, so a row without it is in static mode (decision 7):
- `.scene` takes the visual's grid slot (`grid-area: visual`, centred, `max-width: 680px`, full width), is `container-type: inline-size` and `position: relative`; `.project-visual` inside keeps its box.
- Step state: `[data-at]` above the step at opacity 0.12; packets on edges not reached hidden (`data-packets='current'`: hidden unless `at` equals the step); current caption shown as one line (`01 / 03` counter in mono 13px accent, then the sentence at 16px), the others visually hidden; transitions on opacity and transform.
- SIEM in a step, container at least 560px: `.diagram-body` shifted `translateX(-100px)`; the current `.scene-card` shown absolutely at `left: 61%; width: 38%`, vertically centred on `top: calc(100cqw * var(--y) / 680)`; the current tick shown in accent. Card look from the board: 1px accent border at about 50%, mono 12px, line-height 1.6, title in `--textLight`, background a surface colour that works in both themes.
- SIEM in a step, container under 560px: no shift, no tick, the current card in flow under the box at full width.
- Static mode: no card, no tick, no shift; all captions listed, each with its counter.

**shots.mjs:**
- `SHOTS_SERVE=1`: start `astro preview` (`process.execPath` with `node_modules/astro/bin/astro.mjs preview --port <free port>`), wait up to 30s for HTTP 200 (else exit 1 naming the port), set `BASE_URL`, kill it in the existing `finally`. Devtools port free-picked via `--remote-debugging-port=0` and the profile's `DevToolsActivePort` file (decision 11). Update the usage comment.
- New scenarios, each with a `step` text saying what it proves. Steps are forced: scroll the row into view, then set `data-step` on it, wait for the transition, clip the row (`#projects .project:nth-of-type(n)`):
  - `scene-arc-1`, `scene-arc-2`, `scene-arc-3`, `scene-siem-1` … `scene-siem-4` (desktop, dark). Check, with `lit = .diagram :is(.diagram-edges, .diagram-boxes, .diagram-labels) [data-at]`: every `lit` element above the step computes opacity 0.12 and every one at or below computes 1. Packets (`.diagram-packets [data-at]`): Arc shows those with `at` <= k and hides the rest; SIEM shows only the one with `at` = k (none at step 1). Exactly one caption is visible and it is the k-th. SIEM: exactly one `.scene-card` and one `.scene-tick` are visible, both the k-th, and the card lies inside the figure and the viewport. The visible caption (and for SIEM the visible card's text) passes the existing `readable` 4.5:1 test.
  - `scene-arc-2-light`, `scene-siem-3-light`: same checks after toggling the theme.
  - `scene-siem-2-phone-390`: phone viewport, step 2. Check the card is below the `.project-visual` box, within `innerWidth`, and above `.project-text` (no overlap with the text or the caption).
  - `scenes-reduced-motion`: reduced motion, clip `#projects`. Check no row has `data-step`; every `lit` element (as above) and every packet computes opacity 1; every caption is visible; no `.scene-card` or `.scene-tick` is visible; `packetsStill` holds.
  - `scene-opal`: clip the opal row. Check it is unchanged while its scene is deferred: no `.scene`, one `.phone img`.
  - Every `case-*` scenario also checks the page has no `.scene` and no `[data-at]`.

**Tests** (`src/data.test.ts`, vitest):
- Arc has 3 captions and SIEM 4 (the step count per project, spec "Verification").
- Arc `at` arrays equal the assignments above (edges `[2,2,2,2,3]`, boxes `[1,1,1,2,2,2,2,2,3]`); SIEM edges `[2,3,4]`, boxes `[1,2,3,4]`.
- Every edge, box and label `at` is within `1..captions.length`, and every step has at least one box.
- SIEM has 4 cards; the cards' text contains `10.0.4.12`, `203.0.113.9` and `T1110`, and no other IPv4 address.

**Acceptance:** `npx vitest run src/data.test.ts` passes; `npm run build` passes; with `npm run build` then `SHOTS_SERVE=1 SHOTS=scene-arc-1,scene-arc-2,scene-arc-3,scene-siem-1,scene-siem-2,scene-siem-3,scene-siem-4,scene-arc-2-light,scene-siem-3-light,scene-siem-2-phone-390,scenes-reduced-motion,scene-opal,projects,projects-phone-390,project-links,case-arc,case-siem,case-opal node scripts/shots.mjs` all pass. Look at the scene screenshots against `Main.dc.html` and `SIEM.dc.html` frames.

Commit `feat: step-by-step arc and siem scenes on home`.

### Task 3: Timeline that can draw

**Depends on:** none
**Files:** `src/styles/global.css`, `src/pages/index.astro`

The static (finished) timeline and the hooks Task 4 drives (decision 9, DOM contract). Follow the last frame of `Experience.dc.html`.

- `index.astro`: remove `data-current` from `.experience-role` (nothing else reads it; grep `data-current` across `src` and `scripts` to confirm). Touch nothing else in the file.
- `global.css`, experience section only:
  - Remove the `[data-current] &::before` rule. Static (no `data-drawing` on the list): every marker filled with accent (border and background), every segment accent.
  - `.experience-list[data-drawing]`: a role's segment is accent for its top `--fill` share and the existing track colour (`color-mix(in lab, var(--text) 15%, transparent)`) below; its marker is hollow (today's border, page background) unless the role has `data-reached`, then filled. Transition the marker fill with `var(--durationM) var(--bezierFastoutSlowin)`. Segment fill follows `--fill` directly (no transition; it tracks scroll).
  - Works in the 696px layout, where the marker spans rows.

**Acceptance:** `npm run build` passes. With the dev server on a port of your choice (`npx astro dev --port <port>`, then `BASE_URL=http://localhost:<port>/`), `SHOTS=experience,experience-light,experience-phone-390,experience-phone-390-light node scripts/shots.mjs` passes. The rendered static and drawing states are pinned by computed-style checks in Task 5's `experience-reduced-motion`, `experience-draw-start`, `experience-draw-mid` and `experience-draw-end` scenarios. If shots fails with "chrome devtools did not come up", another worker holds port 9333: rerun.

Commit `feat: experience timeline fills with accent`.

### Task 4: Scroll driver

**Depends on:** Task 1 (uses stepAt, pinProgress, revealProgress, fillFraction, canPin and the constants)
**Files:** `src/scripts/page.ts`

Writes the DOM contract's attributes from scroll; it styles nothing. New `--- scroll scenes ---` section in `page.ts`; the scroll cue's listener becomes the one passive scroll listener calling both.

- Skip all of it when `reduceMotion` is true (static mode stays).
- Rows: every `.project` containing `figure.scene[data-steps]` (none until Task 2 lands; the code then finds no rows and does nothing, without errors). Per row, decide mode with `canPin(innerWidth, innerHeight, content)`, where `content` is the larger of the text column's and the scene's natural heights, measured with `data-pinned` removed. Measure on start, on resize and on `document.fonts` `loadingdone`.
- Pinned: set `data-pinned` and `--steps` (N) on the row; step from `pinProgress(row rect top, row rect height, innerHeight)`. Unpinned: remove both; step from `revealProgress(centre of .project-visual, innerHeight)`. Write `data-step` only when it changes.
- Timeline: set `data-drawing` on `.experience-list`; per role `--fill = fillFraction(role rect top, height, READING_LINE * innerHeight)` and `data-reached` when fill > 0.
- Compute everything once on start, so landing mid-page is right without scrolling.

**Acceptance:** `npm run build` passes and the existing `desktop`, `phone-390` and `reduced-motion` shots scenarios pass with no page errors. Its behaviour is proven by Task 5's scenarios: `scene-arc-1` … `scene-siem-4` (data-step per step, pinned), `scenes-phone-390`, `scenes-short-window`, `scenes-anchor`, `scenes-reduced-motion`, `experience-draw-start`, `experience-draw-mid`, `experience-draw-end`.

Commit `feat: scroll driver for the home scenes and timeline`.

### Task 5: Pin styles and scroll-driven scenarios

**Depends on:** Task 2, Task 3 (its scenarios assert the timeline's rendered marker styles), Task 4 (uses the driver's data-step, data-pinned, --fill and data-reached)
**Files:** `src/styles/scenes.css`, `scripts/shots.mjs`

**Pin styles** (`scenes.css`, decision 2): `.project[data-pinned]` gets `min-height: calc((var(--steps) + 1) * 100svh)` and `align-items: start`; its `.project-text` and `.scene` get `position: sticky; top: 0; height: 100svh` with content centred vertically. Nothing sticky without `data-pinned`.

**shots.mjs:**
- Replace Task 2's forced-step scenarios (same names, same visual checks) with scroll-driven ones: scroll to the row's top plus `(k - 0.5) / N` of its pinned scroll length, wait, then also check the row has `data-pinned`, `data-step` equals k, and `.project-text` computes `position: sticky`. Screenshot the viewport instead of clipping the tall row. `scene-siem-2-phone-390` scrolls the SIEM visual's centre to the progress for step 2 and checks `data-step` is 2 and no `data-pinned`.
- `scenes-phone-390`: phone; scroll through `#projects` in steps; check no element in `#projects` ever computes `position: sticky`, `data-step` never decreases while scrolling down, and each `.project-text` is never overlapped by its figure.
- `scenes-short-window`: 1280 wide, height below the measured row content (read it from the page and pick e.g. 520 if that holds); check no row has `data-pinned` and nothing is sticky.
- `scenes-focus`: desktop; scroll to Arc step 1, focus the SIEM row's `.button`; check the button's rect is fully inside the viewport and not covered (`document.elementFromPoint` at its centre is the button or inside it).
- `scenes-anchor`: open `/#experience`; check Arc and SIEM rows have `data-step` equal to their last step and the Experience heading is in the viewport.
- `scenes-reduced-motion`: also scroll through `#projects` and `#experience` before checking; still no `data-step`, `data-pinned` or `data-drawing`.
- Experience board, one scenario per frame, each clipping `#experience`. "Filled" means `getComputedStyle(marker, '::before').backgroundColor` equals the computed `--accent`; "hollow" means it does not:
  - `experience-draw-start` (frame 1): reading line above the first role; no role has `data-reached`, every `--fill` is 0, every marker hollow.
  - `experience-draw-mid` (frame 2): reading line between the first and second role; the first role has `data-reached` and is filled, the second has neither.
  - `experience-draw-end` (frame 3): scrolled past the list; every role has `data-reached`, `--fill` 1, and is filled.
  - `experience-reduced-motion`: reduced motion, scrolled to `#experience`; no `data-drawing`, every marker filled.

**Acceptance:** `npm run build` then `SHOTS_SERVE=1 node scripts/shots.mjs` passes in full (all old and new scenarios). Tune pin length and the 560px card breakpoint by eye against the boards at 1440 and 390, dark and light; the scenarios above are the pass/fail gate.

Commit `feat: pin arc and siem rows and check the scenes on scroll`.
