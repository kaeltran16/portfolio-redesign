# Portfolio polish, round 1: pin boundary at 1040px — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Effort:** effort:cfbbf16d-7742-4c43-a3d1-46211de27e7b
**Spec:** `C:\Users\kael02\IdeaProjects\portfolio-redesign\docs\superpowers\specs\2026-10-30-portfolio-polish-design.md`
**Verify:** `npm test && npm run build`
**Check:** `npm run build`
**Final:** `npm run build && SHOTS_SERVE=1 node scripts/shots.mjs`
**Prototype:** C:\Users\kael02\IdeaProjects\portfolio-redesign\.superpowers\design\scroll-scenes\project\Experience.dc.html

**Goal:** A Home row never pins while it is stacked in one column, including at a viewport exactly 1040px wide.

**Architecture:** `src/styles/global.css` stacks rows at `@media (max-width: 1040px)`, so 1040 itself is stacked; `canPin` in `src/lib/scene.ts` pins at `width >= 1040`, so at 1040 a stacked row gets `data-pinned` and both its text and its scene become sticky and 100svh tall. Fix the TypeScript side so it agrees with the CSS: pin only above the stacking width.

**Tech Stack:** Astro 7, vanilla TypeScript, vitest, Chrome via CDP (`scripts/shots.mjs`).

## Decisions made beyond the design, and why

1. **Fix `canPin`, not the media queries.** `global.css` uses `max-width: 1040px` in four places (lines 59, 368, 667 and 1038; 667 is the one that stacks project rows), and all of them treat 1040 as narrow. Changing one line of TypeScript keeps every layout as it is today; changing the CSS would move four breakpoints.
2. **Rename `PIN_MIN_WIDTH` to `STACK_MAX_WIDTH`**, with a comment naming the `global.css` media query it mirrors. With a strict `>` the old name says the opposite of what the value means. Its only reader is `canPin` (grep: `src/lib/scene.ts`; `page.ts` and `shots.mjs` do not import it).

## Global Constraints

- No new dependencies; `package.json` and `package-lock.json` do not change.
- No change to `src/styles/global.css` or `src/styles/scenes.css`.
- Every existing scenario in `scripts/shots.mjs` keeps passing.

## Review Focus

- A 1040px-wide window: the Arc and SIEM rows are stacked, have no `data-pinned`, nothing in `#projects` is sticky, and their scenes still step on scroll (reveal progress).
- A 1041px-wide window tall enough for the row: the row pins, as at 1280.

---

### Task 1: Pin only above the stacking width

**Depends on:** none

**Files:** `src/lib/scene.ts`, `src/lib/scene.test.ts`, `scripts/shots.mjs`

**Interfaces:**
- Consumes: the `scene-*` / `scenes-*` scenario helpers already in `scripts/shots.mjs` (`toStep`, `unpinned`, the pinned checks the `scene-arc-*` scenarios use).
- Produces: `export const STACK_MAX_WIDTH = 1040;` and `canPin(width: number, height: number, content: number): boolean`, true when `width > STACK_MAX_WIDTH && content <= height`. `PIN_MIN_WIDTH` no longer exists.

- [ ] **Step 1: Change the `canPin` cases in `src/lib/scene.test.ts`**

The case `[1040, 900, 900, true]` becomes `[1040, 900, 900, false]`; add `[1041, 900, 900, true]`. Keep the other cases.

- [ ] **Step 2: Run `npx vitest run src/lib/scene.test.ts`.** Expected: FAIL on the 1040 case.

- [ ] **Step 3: In `src/lib/scene.ts`, rename the constant to `STACK_MAX_WIDTH` (value 1040) with a lower-case comment saying `global.css` stacks rows at `max-width: 1040px`, and make `canPin` use `width > STACK_MAX_WIDTH`.**

- [ ] **Step 4: Run `npx vitest run src/lib/scene.test.ts`.** Expected: PASS.

- [ ] **Step 5: Add two scenarios to `scripts/shots.mjs`, beside `scenes-short-window`**

- `scenes-1040`: viewport 1040x900, scrolled into the Arc row so its visual's centre is at mid viewport. Checks: no `.project` has `data-pinned`; no element in `#projects` computes `position: sticky`; the Arc row's `.project-text` and `.scene` stack (the scene's top is at or below the text's bottom, or the text's top is at or below the scene's bottom); the row has a `data-step`.
- `scenes-1041`: viewport 1041x1000, scrolled to Arc step 2 the way `scene-arc-2` is. Checks: the Arc row has `data-pinned` and `data-step="2"`, and its `.project-text` computes `position: sticky`. If Arc's content is taller than 1000px at 1041, raise the height until it fits and say so in the report; the check must fail if the row is not pinned.

- [ ] **Step 6: Run `npm run build && SHOTS_SERVE=1 node scripts/shots.mjs`.** Expected: exit 0, with `scenes-1040.png` and `scenes-1041.png` written.

- [ ] **Step 7: Commit**

```bash
git add src/lib/scene.ts src/lib/scene.test.ts scripts/shots.mjs
git commit -m "fix: pin home rows only above the 1040px stacking width"
```
