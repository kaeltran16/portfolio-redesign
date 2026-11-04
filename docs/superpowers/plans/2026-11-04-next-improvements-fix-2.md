# Portfolio: next improvements, fix round 2: console-gap dots and link hover contrast

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `C:\Users\kael02\AppData\Local\arc-wt\957d9a1f\docs\superpowers\specs\2026-11-04-next-improvements-design.md`
**Verify:** `npm test && npm run build`
**Check:** `npm run build`
**Final:** `npm run build -- --site https://example.com && SHOTS_SERVE=1 SHOTS_SKIP=cloud-phone-fps node scripts/shots.mjs`

**Goal:** No cloud dot shows through the gap between a product console and its command box in any arc or siem step, and the run's inline links keep 4.5:1 text contrast while hovered in both themes.

**Architecture:** One shape constraint in `src/lib/shapes.ts` with a unit test. One CSS hover change in `src/styles/global.css`, with a hover step added to `scripts/shots.mjs`.

**Tech Stack:** Astro 7, TypeScript, vitest, CSS, headless Chrome over CDP (`scripts/shots.mjs`).

## Where these come from, and the decisions

1. **The console gap (from Task 5's Found not fixed).** Between the console and its command box there is a gap near shape y -0.42 at 1440. Dots behind the visual show through it. Task 5 kept its hidden field above it (`HIDDEN_FLOOR = -0.36`), but arc-2's `lane` (y from `VISUAL_FLOOR` up, `laneY`) and siem-1's `events` (`stream`) still place dots there. The base `scene-arc-2` screenshot shows them. This predates the run, but it is in `shapes.ts`, which the run changed.
   - The gap becomes one named band in `shapes.ts`: `CONSOLE_GAP_TOP` and `CONSOLE_GAP_FLOOR` in shape units, measured from the 1440 layout (the console's bottom edge and the command box's top edge, through the 416px-per-unit transform), with a margin for dot size and drift. It applies across the visual's width (|x| at most 0.82). Note that `HIDDEN_FLOOR`'s comment already names this gap: reuse the band there rather than keeping two numbers for one gap.
   - Every place that puts a present dot inside the visual's width skips the band, either by drawing y from the two ranges on either side of it or by moving such a dot to just below the band. Don't add a loop that rejects and redraws. Dot counts and presence stay unchanged, so the cut, survivors and lanes tests keep their meaning.
2. **Inline-link hover contrast (from Task 2's review).** `.inline-link:hover` turns the text `--accent`. In the light theme, `#4d9fff` on the background is about 2.4:1. Hover now keeps the text colour (`color: inherit`, so 4.5:1 holds as at rest), and the underline thickens from 2px to 3px. The accent underline colour stays. Drop the `color` transition. Other accent hovers on the site have the same gap but are outside this run's feature, and they stay as they are.

## Review Focus

1. The phone track at 390px uses the same shapes: the band must be measured where it is widest across the 1440 and 390 layouts, or one of them still shows dots. Steps 3 and 4 of Task 1 check both.
2. The hover change must not move text. A thicker underline at a fixed offset does not change layout, so check that `text-underline-offset` stays at 4px.

---

### Task 1: Keep arc and siem dots out of the console gap
**Depends on:** none
**Files:** `src/lib/shapes.ts`, `src/lib/shapes.test.ts`

- [ ] **Step 1: Failing test.** In `shapes.test.ts`, `keeps arc and siem dots out of the gap between the console and its command box` runs at count 1500 and 6000. For every arc and siem step, it asserts that no dot with presence above 0.5 and |x| at most `TEXT_EDGE` has y inside [`CONSOLE_GAP_FLOOR`, `CONSOLE_GAP_TOP`]. Export the two constants for the test. Run `npx vitest run src/lib/shapes.test.ts`. It fails on arc-2 and siem-1.
- [ ] **Step 2: Fix.** Place lanes and events, and any other place the test flags, around the band as decision 1 says. Point `HIDDEN_FLOOR`'s gap comment at the new constants.
- [ ] **Step 3: Pass.** `npx vitest run src/lib/shapes.test.ts src/scripts/cloud.test.ts` passes, with every existing test still passing.
- [ ] **Step 4: Look.** `npm run build && SHOTS_SERVE=1 SHOTS=scene-arc-2,scene-arc-2-light,scene-siem-1,scene-siem-2-phone-390 node scripts/shots.mjs <tmp dir>` passes. In the screenshots, no dots sit in the gap between the console and its command box.

### Task 2: Inline links keep their contrast on hover
**Depends on:** none
**Files:** `src/styles/global.css`, `scripts/shots.mjs`

- [ ] **Step 1: Failing check.** In `shots.mjs`, add a `hover: '<selector>'` scenario field. It dispatches a CDP `Input.dispatchMouseEvent` of type `mouseMoved` at the centre of the first matching element before the check runs, in the same place and the same way the `wheel` field resolves its `at` element. Add the scenarios `hero-proof-hover` and `hero-proof-hover-light`, at desktop, with `hover: '.intro-pitch .inline-link'`. The check asserts that the hovered link's text contrast is at least 4.5:1, using the contrast computation inside `readable` (factor it out if you reuse it). Run `npm run build && SHOTS_SERVE=1 SHOTS=hero-proof-hover,hero-proof-hover-light node scripts/shots.mjs <tmp dir>`. The light one fails at about 2.4:1.
- [ ] **Step 2: Fix.** Change `.inline-link:hover` as decision 2 says, and update the rule's comment.
- [ ] **Step 3: Pass.** The Step 1 command passes. `SHOTS_SERVE=1 SHOTS=hero-proof,hero-proof-light,experience,experience-light node scripts/shots.mjs <tmp dir>` passes too.
