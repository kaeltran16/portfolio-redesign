# Portfolio: next improvements, fix round 1: the nav marks About again

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `C:\Users\kael02\AppData\Local\arc-wt\957d9a1f\docs\superpowers\specs\2026-11-04-next-improvements-design.md`
**Verify:** `npm test && npm run build`
**Check:** `npm run build`
**Final:** `npm run build -- --site https://example.com && SHOTS_SERVE=1 SHOTS_SKIP=cloud-phone-fps node scripts/shots.mjs`

**Goal:** Scrolling or jumping to About marks About in the rail and the menu again, at any window height.

**Architecture:** A CSS minimum height on the Contact footer and one new shots scenario. No change to the nav script or its rule.

**Tech Stack:** Astro 7, CSS, headless Chrome over CDP (`scripts/shots.mjs`).

## What failed, and the decisions

The Final failed one step. `nav-current` reported `#about in view: .rail-link marks #contact, expected #about` (and the same for `.menu-link`). Task 3 cut About to two paragraphs plus facts. At 1440x900, About is now 470px and Contact 407px, so together they fit in one window. I measured it: `#about.scrollIntoView()` stops at the page end (scrollY equals the maximum) with About 23px from the top and Contact at 493px. The nav rule (`src/lib/nav.ts` `currentSection`) marks the last section whenever the page is at its end, so clicking About in the rail marks Contact. This is a real bug, not only a failing check.

1. **Contact fills the window (the human's choice).** `.contact` (the `<footer id="contact">` in `index.astro`) gets `min-height: 100lvh`. Then the page always has a full window below About's top, so every nav jump brings its section to the top, and the page reaches its end only once Contact is at the top. `lvh` and not `svh`: the nav measures against `innerHeight`, which on phones grows to the large viewport when the browser bars hide. Only the large unit is always at least `innerHeight`. The cost, accepted by the human, is empty space below the contact block on tall windows. The content stays at the top of the footer. Do not spread it out or centre it.
2. **The nav rule stays as it is.** `currentSection` and its unit tests are not changed. A rule tied to the click, such as keeping the clicked link marked, was offered to the human and not chosen.
3. **A taller-window check guards the next content cut.** A new scenario, `nav-current-tall`, runs the same `navCurrent` check at 1440x1300. It is taller than any viewport the shots use today, so a later cut that makes the end sections short again fails a named step.

## Review Focus

1. A phone at 390px: Contact's min-height must not push its links or the copyright off the first screen of the footer. The `contact-phone-390*` scenarios cover readability, and a look at `contact-phone-390.png` covers placement.
2. The `og.png` capture is of the hero only and is not affected. Do not recapture it.

---

### Task 1: Contact fills the window
**Depends on:** none
**Files:** `src/styles/global.css`, `scripts/shots.mjs`

The `.contact` rule is near `global.css:1119`, and the `nav-current` scenario is at `shots.mjs:708`.

- [ ] **Step 1: Failing check.** Add `{ name: 'nav-current-tall', viewport: { ...desktop, height: 1300 }, waitMs: 1000, check: navCurrent, step: 'at 1440x1300: scrolling to each section marks only its rail and menu link current, none at the top, contact at the end' }` after `nav-current`. Run `npm run build && SHOTS_SERVE=1 SHOTS=nav-current,nav-current-tall node scripts/shots.mjs <tmp dir>`. Both fail with `#about in view: .rail-link marks #contact, expected #about`.
- [ ] **Step 2: Fix.** Add `min-height: 100lvh` to `.contact`, with a lower-case comment saying why: so the last section can reach the top and every nav jump lands its section there.
- [ ] **Step 3: Pass.** The Step 1 command passes. Then run `SHOTS_SERVE=1 SHOTS=nav-jumps,menu-phone-jumps,contact,contact-light,contact-phone-390,contact-phone-390-light,skip-link node scripts/shots.mjs <tmp dir>`, and it passes. Look at `contact.png` and `contact-phone-390.png`: the pitch, actions, links and copyright sit together at the top of the footer, with empty space below them only.
- [ ] **Step 4: Verify.** `npm test && npm run build` passes.
