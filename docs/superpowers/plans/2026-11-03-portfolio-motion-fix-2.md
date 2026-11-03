# Portfolio motion, fix round 2: shapes stay in range without a silent clamp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `C:\Users\cktra\AppData\Local\arc-wt\aa7c5655\docs\superpowers\specs\2026-11-03-portfolio-motion-design.md`
**Verify:** `npm test && npm run build`
**Setup:** `npm ci --no-audit --no-fund`
**Check:** `npm run build`
**Final:** `npm run build && SHOTS_SERVE=1 node scripts/shots.mjs`

**Goal:** Every shape `buildTrack` returns is in range because its parts are, so the range test can fail and no shape is flattened at the box edge.

**Architecture:** `fill()` in `src/lib/shapes.ts` (line 215) clamps every component into [-1, 1], and presence into [0, 1], before storing it. As a result, the test `keeps positions in [-1, 1] and presence in [0, 1]` in `src/lib/shapes.test.ts` cannot fail. Since the last round, the clamp also distorts a shape: the siem-3 and siem-4 `SIEM_CLUSTERS` at y 0.92, with blob radius 0.18 (intel) or 0.12 (chain nodes), reach y 1.10 and 1.04, so their tops are cut flat. The fix removes the clamp and fits the parts that overshoot.

**As built:** the distortion premise was stale. Fix round 1 had already set `CLUSTER_RADIUS = 0.08` (0.06 for chain nodes), so the cluster tops reach at most y 1.00. The worker measured every shape with the clamp removed: the largest |x|, |y| or |z| is 1.0000 (the opal frame and the siem-6 ring), and presence stays in [0, 1]. Step 2's expected failure did not occur, and Step 3 had nothing to fit. Only the clamp removal landed, so the range test now guards for real.

**Tech Stack:** TypeScript, vitest, Chrome via CDP (`scripts/shots.mjs`).

## Decisions made beyond the design, and why

1. **No clamp: an out-of-range part is a bug the test must catch.** `fill()` stores what `place` returns, unchanged. With no other caller, `clamp()` is deleted. The existing range test then guards for real, and it stays as written.
2. **Fit the overshooting parts and keep the visibility the last round established.**
   - Tighten the shapes so every point stays within [-1, 1]: the SIEM cluster centres and blob radii, `ANSWER_RADIUS` (1, ring points at exactly ±1), and any depth `FORWARD + spread(DEPTH)` beyond 1.
   - The halo tests from round 1 must still pass unchanged: siem-5/6 present particles at `max(|x|, |y|) >= HALO_INNER`, and siem-3 at least 80%.
   - So the cluster blobs shrink, or the band sits a little lower, but stays above `HALO_INNER`.
   - The ring may keep radius 1, provided no part adds jitter beyond 1.
3. **A test proves the clamp is gone.** Running the range test against the current shapes, with the clamp removed, must fail before the shapes are fitted. The worker records that failing run in the report.

## Review Focus

1. Desktop and phone SIEM scenes: shrinking or lowering the band must not drop `cloudVisible` on `scene-siem-3` through `scene-siem-6` or `scene-siem-2-phone-390` below their 0.001 gates.

---

### Task 1: Remove the clamp and fit the shapes into range

**Depends on:** none
**Files:** `src/lib/shapes.ts`, `src/lib/shapes.test.ts`

- [ ] **Step 1: Remove the clamp.** In `fill()`, store `[x, y, z, presence]` as `place(i)` returns it, and delete `clamp()`.
- [ ] **Step 2: Run `npx vitest run src/lib/shapes.test.ts`.** Expected: `keeps positions in [-1, 1] and presence in [0, 1]` FAILS, at least on siem-3. Note the failing value in the report.
- [ ] **Step 3: Fit the overshooting parts as decision 2 says.** Use the `HALO_*` constants the file already has, not new literals, where one fits.
- [ ] **Step 4: Run `npm test`.** Expected: every file passes, including the range test, the 3-5% survivor test and both halo tests, unchanged.
- [ ] **Step 5: Check the SIEM scenes still show.** Run `npm run build && SHOTS=scene-siem-1,scene-siem-2,scene-siem-3,scene-siem-4,scene-siem-5,scene-siem-6,scene-siem-3-light,scene-siem-2-phone-390 SHOTS_SERVE=1 node scripts/shots.mjs`. Expected: all pass. Open `scene-siem-3.png` and confirm the five clusters are round, not cut flat on top, and say so in the report.
- [ ] **Step 6: Commit** `src/lib/shapes.ts src/lib/shapes.test.ts`, with a subject like `fix: keep particle shapes in range without clamping them`.
