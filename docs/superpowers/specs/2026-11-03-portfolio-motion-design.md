# Portfolio motion: particle cloud plus text and scroll polish

Date: 2026-11-03. Brainstorm state: `.superpowers/brainstorm/portfolio-motion/brainstorm.json`. Samples: `.superpowers/design/portfolio-motion/spike/motion.html` (round 1, A-J) and `motion-2.html` (round 2, K-P). Both are gitignored throwaways; read them for feel, not for code to copy.

## Intent and why

Khang finds every animated moment on the Home page too simple. The problem is the whole site, not one weak scene. Round 1 of samples (scroll and text effects alone) still read as basic. The direction picked is sample K from round 2: particles that reshape as you scroll. The existing pinned, stepped project rows stay; the work enhances them instead of replacing them.

The site is the portfolio linked from the CV and LinkedIn during a job search, so a recruiter's first visit, often from a phone, is the moment that matters.

## Goals

1. **One particle cloud that acts out each row.** The hero sphere breaks into one particle cloud on a fixed, page-wide canvas. As each project row plays, the cloud re-forms behind it and plays that row's steps:
   - SIEM: events pour in and collapse to the 3-5% left after the triage cut (the CV's 95-97% triage queue cut).
   - Arc: workers split into git worktrees and merge back.
   - opal: its screens arrive as dots.
   After the projects, the cloud settles at Experience.
2. **Text and scroll polish on Home**, three effects from round 1:
   - A. Smooth inertia scroll across Home.
   - B. Split-text reveal on headings: letters rise out of a mask, staggered, as the heading enters the screen.
   - H. Staggered entrances with a slight springy overshoot on the Experience list.
3. **Phones and short windows** get the same cloud and shapes with far fewer particles and no pointer push.

## Non-goals

- Replacing or redirecting the project rows' scroll. The Arc cockpit (4 steps), SIEM console (6 steps) and opal screens (4) keep their pinning and step logic.
- Round 1 effects C (read-along), D (grow card), E (sideways gallery), F (parallax), G (magnetic buttons), I (counters), J (marquee).
- Round 2 effects L (shader card), M (3D corridor), N (pointer-reactive type), O (physics), P (card-to-page transition).
- Case-page transitions, or carrying the cloud into case pages.
- New claims: any number the cloud shows must already be on the CV (job-search/resume_v2.md).

## Anti-goals

- The cloud covers or competes with scene text so a row's caption or console becomes hard to read.
- Stutter or heavy battery drain on an ordinary phone.
- A page that only works with a mouse.

## What exists today

- `src/scripts/sphere.ts`: the hero is a displacement-mapped `Mesh` (`MeshPhongMaterial` on `SphereGeometry(32, 128, 128)`), ported from hamishw.com. Its canvas `[data-sphere]` sits inside `#intro` at 130% of the viewport height. It renders only while on screen (`IntersectionObserver`), tilts with a pointer spring (`TILT_SPRING`), and has dark and light lighting (`setTheme`).
- `src/scripts/page.ts` lazily imports the sphere, reads `prefers-reduced-motion` once (`reduceMotion`), and on scroll sets `row.dataset.step` from `stepAt(rowProgress(row), stepsOf(row))` on every project row, pinned or not. It also draws the Experience timeline line with scroll (`--fill`, `data-reached`).
- `src/lib/scene.ts` holds the scroll maths without DOM, unit tested: `stepAt`, `pinProgress`, `revealProgress`, `fillFraction`, `canPin`. Rows pin only when the window is wider than 1040px and the content fits; otherwise the scenes play unpinned as they pass the screen.
- `scripts/shots.mjs` drives screenshot scenarios that must keep passing (`npm run shots`, needs `astro dev` on 4321).
- Dependencies: `astro`, `three` (0.186), fonts. No animation library.

## Decisions

### Particle cloud

- On first load the hero looks as it does today: the solid displacement sphere from `sphere.ts`, with its noise shader and per-theme lighting. As the visitor scrolls into the projects, it dissolves into particles sampled from its displaced surface, and those particles become the cloud. (Builder question 1)
- One fixed, page-wide WebGL canvas holds the cloud.
- It follows the rows through the step each row already publishes (`data-step`) and, for smooth morphs within a step, the continuous progress from `pinProgress` / `revealProgress`. This works the same for pinned rows on desktop and unpinned rows on phones.
- Each shape forms behind the live row's scene; between rows the cloud travels from one shape to the next; after the last row it settles at Experience.
- Built on three.js, already a dependency. Particle positions are driven by the site's own scroll maths in `src/lib/scene.ts`, not by a scroll library.

### Split headings

The split reveal (B) goes on the section and project titles. The intro name keeps the decode effect it has today. (Agent's call)

### Phones and short windows

Same cloud and shapes, far fewer particles, no pointer push.

Pass/fail check: in Chrome DevTools at 390px wide with 4x CPU slowdown, scrolling through the projects holds at least 50 frames a second. The phone particle count is set to meet it. (Builder question 2)

### Dark and light themes

- Dark: accent-blue dots with a soft glow (additive blending), as in sample K.
- Light: solid, darker dots with normal blending, since glow washes out on a light background.
- The cloud switches with the theme toggle without a reload, as the sphere does today.

### Reduced motion

With `prefers-reduced-motion`, as the site behaves today: no smooth scroll; headings and Experience appear without split or stagger; rows show their last frame; the cloud draws each shape still, with no morphing or drift.

### Libraries

- GSAP with its SplitText plugin (free since 3.13) for split headings (B) and the springy Experience entrances (H).
- Lenis for smooth scroll (A).
- Both installed from npm and bundled by Astro; nothing loaded from a CDN.
- Lenis must keep the navigation from d6812ad working: anchor jumps with location.replace, scroll-margin landing under the phone strip, the skip link, and the existing nav shots scenarios. (Agent's call)

## Left to the builder

- The exact particle shape for each row step and the Experience settle, within the stories above.
- Particle counts on desktop and phones.
- How the dissolve from the solid sphere to particles looks and is timed.
- Easing and timings.
- Keeping the cloud from covering scene text (depth, opacity, placement).
- Which headings get the split reveal.
- Unit tests for any new scroll maths in `src/lib/scene.ts`, and new scenarios in `scripts/shots.mjs`.
