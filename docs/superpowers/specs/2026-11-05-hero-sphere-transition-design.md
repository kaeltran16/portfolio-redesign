# Hero-only sphere and a noise-dissolve page transition

Date: 2026-11-05. Replaces goal 1 (the page-wide particle cloud) of `2026-11-03-portfolio-motion-design.md`; its text and scroll polish (Lenis, split headings, Experience entrances) stay. Prototype: commit 6f707d7 on branch `prototype/hero-sphere-transitions` (throwaway, not merged).

## Intent and why

Khang: the shapes morphing behind the page read as weird. Most open motion bugs were also the cloud's: dots over titles and captions, dots past the console edges, an unbounded opal field, untested morphs between rows, and the dissolve crossing the Arc title on phones. A page-wide particle canvas was also the largest unmeasured cost on a real phone.

The prototype compared three page transitions (noise dissolve, wave wipe, grid flip) against the current cloud. Chosen: the noise dissolve, toned down, because it uses the same kind of noise as the sphere, so the transition reads as part of it rather than a separate effect.

## Decisions

- **The sphere stays in the hero.** Its canvas is back inside `#intro` (as before the cloud), and it stops rendering while the intro is off screen. Home's project rows and Experience have no canvas behind them.
- **Page changes dissolve.** A plain click on a same-site link to another page (Home to a case page, a case page to a Home section) covers the window through noise in the background colour with a thin accent edge (450ms), navigates, and the new page uncovers the same way (600ms). Jumps within a page, new-tab clicks, downloads (the CV) and other sites navigate as usual.
- **Toned down from the prototype:** three noise octaves instead of five and a lower frequency (fewer, larger blobs), an edge half as wide, shorter durations (450/600ms, was 700/800ms).
- **No flash between pages.** The leaving page sets a sessionStorage flag; the next page reads it in an inline head script and covers itself with the background colour from first paint until `transition.ts` draws its own cover in the same frame. A 3s timeout uncovers it if the script never runs.
- **Back and forward.** A page restored from the back-forward cache drops its cover.
- **Reduced motion and no WebGL:** no transition; pages change at once. Without WebGL each of the sphere and the transition logs a warning, not an error.

## Left out

- Transitions for back and forward navigations, which the browser performs without a click.
- The View Transitions API: it cannot run a shader across the window between two documents.
