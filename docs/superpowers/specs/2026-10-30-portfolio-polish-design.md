# Portfolio polish: scroll scenes on Home

Date: 2026-10-30. Initiative: Portfolio redesign (`effort:cfbbf16d-7742-4c43-a3d1-46211de27e7b`), chunk "Polish: site still reads primitive".

## Intent

Khang finds the site primitive because there is too little interaction, and wants an interactive portfolio. After looking at five reference sites, Khang chose **pinned scenes on the current page**, the Apple product page pattern: a section stays pinned while the scroll position plays its visual, then lets go. The layout, the text and the existing sections stay as they are. The motion goes on the visuals that already show the work: the Arc and SIEM diagrams and the opal phone.

## Goals

- The Arc and SIEM rows on Home pin while their visuals play in steps, then let go. The opal row is deferred (see "Deferred: opal").
- The Experience timeline line draws down through the roles as you scroll (no pin).
- Phones get the scenes too, without pinning.
- Reduced motion gets the finished state with no pinning.

## Non-goals (this pass)

- Case-study pages (`/projects/[slug]`). They render the same `ProjectVisual` component, and it must keep showing the finished visual there, as today.
- Hover or cursor reactions on the diagrams or phone.
- The intro (sphere, decoding name, cycling roles), About and Contact: unchanged.
- Final copy (chunk 8, deferred) and deployment (chunks 10-11, deferred).

## Anti-goals

- About and Contact must not become slow to reach: only the Arc and SIEM rows pin (opal joins them when its scene lands).
- On a phone, no scroll is ever held, and the text under a visual is never hidden behind it.
- No new animation dependency (see "How it is built").

## Constraints

- Astro 7 + vanilla TypeScript; dependencies are `astro`, `three`, two `@fontsource` fonts. Keep it that way.
- Tokens live in `src/styles/global.css` (`--durationM`, `--bezierFastoutSlowin`, `--accent`, ...); reuse them.
- Dark and light themes both work (`[data-theme]` on `<html>`, toggled by `src/scripts/theme.ts`).
- Rows stack (visual above text) at 1040px and below (`.project` media query `max-width: 1040px` in `global.css`); "phone" below means that stacked layout.
- `prefers-reduced-motion: reduce` already kills all animations and transitions globally (`global.css` ~line 1096) and `page.ts` reads it once into `reduceMotion` (line 10).
- Verification is `npm test` (vitest), `npm run build`, and `npm run shots` (Chrome via CDP against the dev server on `localhost:4321`, which must be running first).

## What each scene plays

The prototype is the design canvas `.superpowers/design/scroll-scenes/project/` (gitignored): `Main.dc.html` (Arc), `SIEM.dc.html`, `Experience.dc.html`. The opal board moved to `.superpowers/design/scroll-scenes/deferred/Opal.dc.html` with the deferral. Each board shows the scene's frames at points through the scroll; build to them.

Shared by the pinned project rows (desktop):

- The row pins when it fills the screen. The text column (index, title, description, View project) stays put.
- A step caption sits under the visual: a mono counter (`01 / 03`, accent) and one sentence. Captions are in the boards.
- Elements not yet reached are faint (the boards use opacity 0.12), not hidden, so the whole diagram's shape is visible from the start.
- After the last step the row lets go and the page scrolls on.

**Arc**: 3 steps, following the diagram's flow (geometry unchanged from `src/data.ts`).
1. The three agent boxes (claude code, claude code, run) and the "agents" caption light up.
2. The edges into wsh and from wsh into arc light with moving packets; wsh, arc and its runs / initiatives / notes boxes light up.
3. The arc-to-cockpit edge and the cockpit box light up.

**SIEM**: 4 steps; one sample event travels down the four stages (log sources, collectors and parsers, detection and ai, management panel). Each lit stage has a card beside it, joined by a short accent tick, showing the event at that stage (the card text is in `SIEM.dc.html`): raw firewall line, parsed schema fields, an anomaly flag mapped to MITRE ATT&CK T1110 (Brute Force), the alert in the management panel. The event is invented for illustration and uses private and documentation-range IPs (10.0.4.12, 203.0.113.9); it is not customer data. To make room for the card, the diagram column moves left in the 680x520 box (box x from 200 to 100, centre x 340 to 240), as in the board. Packets run only on the edge into the lit stage.

**opal** (deferred, see "Deferred: opal"): 4 steps; the phone's screen slides to the next of Today, Areas, Workout, You. The four screen names sit under the phone, the current one in accent with an underline. Only Today has a capture (`src/assets/opal-today.png`); Areas, Workout and You must be captured (see "Left to the builder").

**Experience** (no pin): the timeline line fills with accent from the top as the section scrolls through the screen, and each role's square marker fills when the line reaches it. Today each role draws its own line segment (`.experience-marker::after`) and only the current role's marker is filled (`[data-current]`); the builder may restructure this so one continuous line can fill. When fully drawn, the line is accent and every marker is filled, as in the last frame of `Experience.dc.html`; the current role no longer stands out by its marker.

## Phones (stacked rows, 1040px and below) and short windows

Pinning needs room: a row pins only when the window is wider than 1040px **and** tall enough to show the whole pinned row (text column, visual, step caption and, for opal, the screen names) without clipping. Measure the row; do not hard-code a height. A window that fails either test uses the unpinned mode below. (Agent's call, builder question 2: the spec already promises text is never hidden, and the unpinned mode already exists.)

Nothing pins. Each step plays as the visual moves up through the screen, driven by the same progress-to-step function as desktop, fed by the visual's position on screen instead of the pin. The text under the visual is never covered.

SIEM card on narrow screens (Agent's call, builder question 1): when the visual box is too narrow for the card beside the diagram (decide with a container query on the scene figure that wraps `.project-visual` and its captions; about 560px wide is the starting point, tuned so the card's longest line does not wrap; it landed at 648px), the diagram recentres (box x back to 200) and the card sits under the diagram's 680x520 box at full width, inside the scene figure and above the step caption, showing the lit stage's event. It does not go inside the box: fitting it there would shrink the diagram to about 4px labels at 390px (Khang approved, 2026-10-30). The tick joining card and stage is dropped in this layout. The box keeps its size, so `projectsFit` keeps passing. Khang chose this over pinning on phones and over no scenes on phones.

## Reduced motion

Nothing pins and nothing steps. Each visual shows its last frame (whole diagram lit, SIEM with its final card or no card at the builder's choice, timeline fully drawn), and the step captions are listed under the visual so their content is not lost. Packets stand still, as today (the existing `packetsStill` shots check must keep passing).

## How it is built

Chosen by Khang after an independent judge weighed six approaches: **a sticky row, with scroll progress setting `data-step`.**

- No wrapper element: the `.project` grid itself becomes the tall scroll track while pinned, and its two columns (text and visual) are `position: sticky`. A wrapper per row would put each row alone in its parent and break the `.project:nth-of-type(even)` left/right alternation (Khang approved, 2026-10-30). Scroll length per row is roughly one viewport per step.
- One passive scroll listener (there is already one in `src/scripts/page.ts`, lines 121-123, for the scroll cue) computes each row's 0..1 progress through its pinned scroll, maps it to a step, and writes `data-step` on the row. At 1040px and below progress comes from the visual's position on screen instead.
- CSS reacts to `data-step` with transitions (opacity, the SIEM card's position, the phone screen's slide, the caption). Packets stay the existing CSS keyframe (`diagram-flow`), shown only on edges whose step is reached.
- Without JS, or before the script runs, each visual shows its finished state (no pin, no faint elements). Home lists the step captions under the visual, the same static mode as reduced motion, so no-JS visitors lose no content (Khang approved, 2026-10-30). Case pages render the visual exactly as today, with no captions.
- Put the progress-to-step mapping in a pure function in `src/lib/` so it can be unit tested like `src/lib/decode.ts`.

Rejected by the judge: three.js scenes (redraws SVG text as 3D, loses crisp text and the SVG `aria-label`) and Motion's `scroll()` (a dependency to set the same attributes). Also weighed: IntersectionObserver sentinels, CSS scroll-driven animations (`animation-timeline`), GSAP ScrollTrigger.

## Deferred: opal

Decided 2026-10-30: this pass does not build the opal scene. Its Areas, Workout and You captures need opal's Flutter web build, which is not available on this machine, and Khang will supply the captures later ("skip it, will supply that later"). Until then the opal row on Home renders exactly as today (the Today image, no pin, no screen names, no caption). The scene described above, the captures and the opal captions under "Left to the builder" land in a follow-up pass once the captures exist, built to `.superpowers/design/scroll-scenes/deferred/Opal.dc.html`.

## Data changes

`src/data.ts` today has, per diagram, flat arrays of `edges`, `boxes` and `labels`, and `ProjectVisual.astro` renders them as four SVG groups by kind, so the markup has no notion of steps. Each box, edge and label needs a step number, and each project needs its step captions; the SIEM project also needs its four sample-event cards (opal's four screens come with the deferred opal scene). `src/data.ts` stays the single source for all of it.

## Accessibility

- Each SVG keeps a `role="img"` and an `aria-label` describing the whole diagram, whatever step is showing.
- The step caption text is in the DOM for every step (not only the current one), so screen readers get all of it; visually only the current step's caption shows.
- The pin must not trap keyboard focus: tabbing to the next row's View project link scrolls normally.
- Text and lit elements keep 4.5:1 contrast in both themes; faint (not yet reached) elements are decorative.

## Verification

- A vitest unit test for the progress-to-step function: boundaries (0, exactly at a step edge, 1), clamping below 0 and above 1, and the step count per project (Arc 3, SIEM 4). It must fail if steps are off by one.
- `scripts/shots.mjs` scenarios: Arc and SIEM at each step on desktop (scroll to the step's progress, then screenshot and check the expected `data-step`); the phone run at 390px with no element sticky; reduced motion (no `data-step` changes, everything lit, captions listed, packets still); both themes for at least one step of Arc and of SIEM. The existing scenarios, including `projectsFit` and `project-links`, must keep passing.
- Case pages: the existing `case-*` shots still pass and show the finished visual.
- Look at the screenshots by eye at 1440 and 390, dark and light, against the boards.

## Left to the builder

- Pin length: about one viewport of scroll per step (Arc 3, SIEM 4), tuned by eye.
- Step data shape in `src/data.ts`.
- Transition timings: reuse `--durationM` and `--bezierFastoutSlowin`.
- opal captures (deferred with the opal scene): capture Areas, Workout and You from the seed-data web build (`dart_defines/dev.json`) at the same size and crop as Today, and add them to `src/assets/`. Capture each screen as the seed data renders it, without changing the opal repo (Khang, builder question 2); the earlier Areas capture showed an odd "$0.15 over $85", and that is accepted as is. If a screen cannot be captured at all, stop and report instead of using a placeholder.
- Whether the timeline becomes one continuous line or keeps per-role segments.
- All copy in the captions is a draft for Khang to finalize with the rest of the content (chunk 8). The opal captions for Areas, Workout and You have no draft in the board: write them from the captured screens, in the same voice as the Today caption. Khang has said drafts are fine and will be finalized later.
