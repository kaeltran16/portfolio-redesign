# Portfolio motion, fix round 1: make the SIEM triage cut visible — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `C:\Users\cktra\AppData\Local\arc-wt\aa7c5655\docs\superpowers\specs\2026-11-03-portfolio-motion-design.md`
**Verify:** `npm test && npm run build`
**Setup:** `npm ci --no-audit --no-fund`
**Check:** `npm run build`
**Final:** `npm run build && SHOTS_SERVE=1 node scripts/shots.mjs`

**Goal:** On desktop, the SIEM row's cloud is drawn where the eye can see it, so the collapse to the 3-5% that survive the triage cut is visible.

**Architecture:** Only the SIEM story in `src/lib/shapes.ts` moves. The renderer, `boxTransform` and `CLOUD_SPREAD` stay as they are. A shape is drawn behind the row's `.project-visual`, scaled by `min(w, h) / 2 * CLOUD_SPREAD`. The SIEM console is opaque and sits above the canvas (z-index -1). So anything within `1 / CLOUD_SPREAD` (0.625) of the centre on the box's shorter axis is hidden. The SIEM shapes must sit in the halo beyond that.

**Tech Stack:** TypeScript, vitest, Chrome via CDP (`scripts/shots.mjs`).

## Decisions made beyond the design, and why

1. **The Final review's failure.** In the Final shots, `scene-siem-5.png` and `scene-siem-6.png` show no particles at all, and siem-2 to siem-4 show only stray dots at the console's corners. The cause is in `src/lib/shapes.ts`. The survivors gather at `blob(0, 0, 0.2)`, the agent answer is `ring(0, 0, 0.45)`, and `SIEM_CLUSTERS` sit within ±0.75. All of that lands under the opaque console. Spec Goal 1 says the SIEM cloud shows the cut to 3-5%, and that is the only number the cloud may show. The fix moves the shapes; it does not change what they mean.
2. **One shared threshold, `HALO_INNER = 0.7`, exported from `src/lib/shapes.ts`.** It is the shape-space distance, on the box's shorter axis, beyond which a point clears the box. That edge is `1 / CLOUD_SPREAD` = 0.625, and 0.7 leaves margin for dot size and drift. `cloud.test.ts` pins `HALO_INNER > 1 / CLOUD_SPREAD`, so changing the spread cannot silently hide SIEM again.
3. **Measure the box before placing anything.** At 1440x900 and 390x844, read the SIEM `.project-visual` rect and find which axis is shorter. "Clears the box" means `|coordinate on that axis| >= HALO_INNER`, or, on the longer axis, beyond `(long / short) / CLOUD_SPREAD`. Put the measured numbers in the report.
4. **Survivors go above the visual or to its sides, never below.** Each row's step caption sits under the visual, and the Task 5 report already notes halo dots behind captions. Putting the main SIEM shapes below would make the cloud compete with the caption text, which the spec lists as a risk. Where the shapes go above or to the side, check the screen-y sign that `cloud.ts` uses for shape y.
5. **Where each SIEM step's shape goes:**
   - `alerts` (siem-5): the survivors gather into one blob in the halo, for example centred at |y| >= 0.8 on the visible side.
   - `agent` (siem-6): the same survivors form the answer ring, with radius large enough that the ring clearly frames the console. Start at about 0.9, so that most of the ring clears the box at both measured viewports.
   - `intel` (siem-3) and `chain` (siem-4): `SIEM_CLUSTERS` move outward into the halo, so the five clusters and their links are seen around the console.
   - `risk`'s outlier (siem-2): moves into the halo too, so the outlier is visibly pulled out.
   - `events` and `risk`'s stream (siem-1, siem-2): may cross the console, but their ends must show beyond it.

   Particle identity and presence do not change. Survivors are still `i % 25 === 0`, and the non-survivors still fade where they stood.

## Review Focus

1. Phone (390x844): the SIEM visual is unpinned and nearly full width there, so shapes that clear it on desktop may run off screen. The phone scene must still show the cloud.
2. Light theme: dots are darkened with normal blending, so a sparse survivor blob must still read against the light body background.

---

### Task 1: SIEM shapes in the halo, proven visible

**Depends on:** none
**Files:** `src/lib/shapes.ts`, `src/lib/shapes.test.ts`, `src/scripts/cloud.test.ts`, `scripts/shots.mjs`

In `src/lib/shapes.ts`, change the SIEM story at lines 124-163 and `SIEM_CLUSTERS`, and add the exported `HALO_INNER`. In `src/scripts/cloud.test.ts`, add one assertion. In `scripts/shots.mjs`, change `CLOUD_SEEN` and the phone SIEM scenario.

**Interfaces:**
- Consumes: `CLOUD_SPREAD` from `src/scripts/cloud.ts`, and `buildTrack` / `Track` as they are.
- Produces: `export const HALO_INNER = 0.7` in `src/lib/shapes.ts`. `buildTrack`'s signature does not change.

- [ ] **Step 1: Write the failing tests in `src/lib/shapes.test.ts`.** Add `it('places the siem survivors in the halo, clear of the visual')`: for `siem-5` and `siem-6`, every present particle has `Math.max(|x|, |y|) >= HALO_INNER`. Add `it('places the siem clusters in the halo')`: for `siem-3`, at least 80% of particles satisfy the same rule. Keep the existing 3-5% survivor test unchanged; it must still pass.
- [ ] **Step 2: Add one assertion to `src/scripts/cloud.test.ts`:** `expect(shapes.HALO_INNER).toBeGreaterThan(1 / CLOUD_SPREAD)`.
- [ ] **Step 3: Run `npx vitest run src/lib/shapes.test.ts src/scripts/cloud.test.ts`.** Expected: the new tests fail, because `HALO_INNER` is undefined and the survivors are at the centre.
- [ ] **Step 4: Measure the SIEM visual's rect** at 1440x900 and 390x844 (decision 3). Then move the SIEM shapes as decision 5 says, above or to the side, never below (decision 4).
- [ ] **Step 5: Run `npm test`.** Expected: all files pass, including the full suite and not only the two files above.
- [ ] **Step 6: Prove the shapes are visible in `scripts/shots.mjs`.**
  - Add to `CLOUD_SEEN`: `'scene-siem-3': 0.001`, `'scene-siem-4': 0.001`, `'scene-siem-5': 0.001` and `'scene-siem-6': 0.001`.
  - Add `cloudVisible: 0.001` to `scene-siem-2-phone-390`.
  - Keep every existing check. `readable()` and `cloudInRow` must still pass with the moved shapes.
- [ ] **Step 7: Run `npm run build && SHOTS=scene-siem-1,scene-siem-2,scene-siem-3,scene-siem-4,scene-siem-5,scene-siem-6,scene-siem-3-light,scene-siem-2-phone-390 SHOTS_SERVE=1 node scripts/shots.mjs` (`SHOTS` takes exact names, comma-separated), then the full Final.** Expected: every scene-siem scenario passes, with `cloudVisible` met.
  - Open `scene-siem-5.png` and `scene-siem-6.png` and confirm by eye: siem-5 shows a small gathered group, and siem-6 shows the ring around the console. Say in the report that you looked.
  - The whole Final must pass. Its only allowed non-zero exit is 3, when there is no GPU, with the `unverified, no gpu` last line.
- [ ] **Step 8: Commit** `src/lib/shapes.ts src/lib/shapes.test.ts src/scripts/cloud.test.ts scripts/shots.mjs`, with a subject like `fix: draw the siem triage cut in the halo where it shows`.
