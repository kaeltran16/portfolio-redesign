# Portfolio: next improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `C:\Users\kael02\AppData\Local\arc-wt\957d9a1f\docs\superpowers\specs\2026-11-04-next-improvements-design.md`
**Verify:** `npm test && npm run build`
**Check:** `npm run build`
**Final:** `npm run build -- --site https://example.com && SHOTS_SERVE=1 SHOTS_SKIP=cloud-phone-fps node scripts/shots.mjs`

**Goal:** In 30 seconds, a hiring manager sees shipped, measured proof above the fold, an Experience section they can scan, About facts, and a share preview, with the Arc and SIEM band shapes reading as diagrams and opal drawing its next screen in dots beside the phone.

**Architecture:** Copy and layout changes go in `src/pages/index.astro` and `src/styles/global.css`. The share tags go in `src/layouts/Base.astro`. The shapes change in `src/lib/shapes.ts`, and `src/scripts/cloud.ts` gains a per-dot size. Every new browser check is a scenario in `scripts/shots.mjs`, written first, so each content task proves itself with a named step.

**Tech Stack:** Astro 7, TypeScript, three.js (ShaderMaterial), vitest, headless Chrome over CDP (`scripts/shots.mjs`).

## Decisions made beyond the design, and why

1. **All the new browser checks land first, in one task (Task 1).** `scripts/shots.mjs` is one file, and the hero, Experience, About, Contact and share tasks would all need to add to it. With one owner up front, those four tasks run side by side without colliding at merge, and each proves its work by running the steps by name. These checks fail on today's site, which shows they can fail. The shape tasks (5, 6) come after Task 1 and touch `shots.mjs` only for their own cloud gates.
2. **Hero and Experience share one task, and About and Contact follow it.** Both tasks edit `index.astro` and `global.css`. Splitting them further would only make a longer serial chain on the same two files.
3. **One shared inline-link style, `.inline-link`, in `global.css`.** The hero's SIEM link and the three linked Experience bullets look the same. The text keeps `--textBody`, so contrast holds at 4.5:1 in both themes. An accent underline marks it as a link, and hover turns it accent. The shots checks find links by this class.
4. **A linked Experience bullet is a link as a whole.** The one-liner is the result, so it makes good link text. Each highlight becomes `{ text: string; href?: string }`. In the hero, only the SIEM words are linked, as the spec asks.
5. **The home `description` becomes the proof line in plain text.** `og:description` reads each page's `description` prop, so the share card carries the proof, not the old tagline.
6. **`og:image` and `og:url` render only when `Astro.site` is set.** Hosting is undecided (chunk 11). An absolute URL built on a guessed origin would publish a wrong link, so without `site` the two tags are left out, and `og:title`, `og:description` and `twitter:card` still render. `astro.config.mjs` gets a one-line comment saying where `site` goes. The Final builds with `--site https://example.com`, Astro's own CLI flag, so the tags are rendered and checked without committing a guessed host.
7. **`og.png` comes from a shots scenario named `og`.** It runs at 1200x630 and writes `og.png` to the shots output like every other scenario. Task 7 copies that file to `public/og.png` once the hero copy has landed. A separate `share-image` scenario checks that the served `/og.png` is 1200x630. It belongs to Task 7, not Task 4, so Task 4 can pass before the image exists.
8. **About facts reuse `.case-facts` as it stands.** The list is `<dl class="case-facts about-facts">`, with `.about-facts` used only for placement. Renaming to a shared `.facts` would touch the case page and its checks for no gain. About becomes two columns above 1040px (`STACK_MAX_WIDTH`, the same breakpoint as the project rows) and stacks below it.
9. **The per-dot size is a parallel array on `Track`.** The type becomes `Track = { names: string[]; shapes: Float32Array[]; sizes: Float32Array[] }`. `sizes[k]` holds `count` floats, the size multiplier of each particle in shape k, where 1 means `POINT_SIZE`. The `(x, y, z, presence)` stride and every test that indexes `i * 4` stay as they are. In `cloud.ts`, the size goes to two float attributes (`aFromSize`, `aToSize`) that are mixed by `uMorph`. `Point` gains a fifth element, size, which `parts()` sets to 1 by default.
10. **Brightness comes from presence, and size comes from `sizes`.** Node and link dots draw at presence 1 and size above 1. Field dots are size 1, dim, and still present (presence above 0.5), so the siem-5 cut test and its "all present in steps 1-4" check keep working. The "every particle present" rule applies to arc-1 through arc-4. Enlarged nodes appear only in arc-1, siem-3, siem-4 and siem-6, as the spec says.
11. **Diagram dot counts are fixed, not a share of `count`.** Each node and link gets a set number of dots, so the 1500-particle phone track and the 6000-particle desktop track draw the same diagram. The other particles form the field. In arc-1, siem-3 and siem-4, a field dot sits either in the band (y at or above `HALO_INNER`, |x| at most `TEXT_EDGE`) or hidden behind the console (|x| at most 0.78, y between `VISUAL_FLOOR` and 0.58). The current "siem-3 at least 80% in the halo" test is replaced by "every enlarged dot is in the band": the old test would force the haze the spec removes. siem-6 draws the arch from the 3-5% survivors.
12. **Opal geometry is in shape units.** The box is 680x520 and the transform scale is 416px per unit, so the phone fills |x| up to 0.30 and |y| up to 0.613. Opal is row 3 (odd), with its title column on the left, so the patch goes on the right, away from it. The patch is a 250:510 rect inside x 0.34 to 0.80 and |y| at most 0.5 (about 0.2 half-width, centre near x 0.57). Patch dots are enlarged (size above 1). Every other opal dot sits hidden behind the phone (|x| at most 0.26, |y| at most 0.57) or, at step 4 and in still mode, in the loose field (y at or above `VISUAL_FLOOR`, |x| at most `TEXT_EDGE`, size 1).
13. **Reduced motion means a `still` track.** The new signature is `buildTrack(rows, count, { seed = DEFAULT_SEED, still = false } = {})`, and `cloud.ts` passes `{ still: !mode.live }`. With `still`, every opal step uses the step-4 loose field, so no patch is drawn. Without JS there is no cloud, as today.
14. **The CV-sync comment changes in two places.** The comment in `index.astro` and line 13 of `README.md` both say Experience copies the CV. Both change to say the site gives one-line summaries, the full wording lives in `public/cv.pdf`, and the numbers must match it.
15. **Final skips `cloud-phone-fps` (new `SHOTS_SKIP` env, Task 1), and Task 5 owns the fps evidence.** This machine already fails that gate on the shapes from before this round (29-48 fps against 50, chunk 16 notes), so in the Final it would be red whatever this round does. Task 5 is the only change to per-frame work, so it measures before and after on the same machine and reports both. The scenario stays in the suite for any other run.
16. **Shape bounds gate only the anchored shapes.** Unit tests pin every anchored shape (arc, siem and opal steps). The morph between two rows interpolates between two different screen boxes while the page scrolls, and neither row's text is pinned at that moment. No test covers that path, and none is added: it would need the browser's layout, and a shape-space test would not prove it. Screenshots at the anchors go to the reviewers. Looking at the screenshots does not decide whether a task passes.
17. **No Effort or Chunk lines.** The initiative already records this round: the 11-04 10:43 note on chunk 8 says Nov 8 is dropped, and chunk 17 is marked skipped. Chunk 8 covers more than this round, so this plan's merges do not close it.

## Global Constraints

- No dot below `VISUAL_FLOOR` (-0.55) and none past `TEXT_EDGE` (0.82), in every Arc, SIEM and opal step. Opal's patch also stays inside the box beside the phone, clear of the names (y about -0.66), the caption (y about -0.79) and the title column.
- Text stays at 4.5:1 or better in both themes, links included.
- Reduced motion and no-JS both keep working: static frames, with everything readable, and no opal patch.
- Every number in the copy is already on the public CV (`public/cv.pdf`). The SIEM page may name MozoX.
- No new dependencies. No per-page share images and no build-time image rendering.
- No change to the hero layout, the decoding name, the cycling roles, the sphere, the 680x520 visual box or the consoles.
- All copy is a draft for Khang (chunk 9). Mark it with the existing comment form `// draft copy until khang finalizes it`.

## Review Focus

1. **Morphs between anchored shapes.** When the cloud morphs siem-6 into opal-1, or opal-4 into settle, enlarged dots could sweep across the opal title. This is accepted as uncovered (decision 16). Only the anchors are tested.
2. **The compact 1500-particle track.** With fixed diagram counts, the phone track has a much smaller field. The bounds and enlarged-dot tests in Tasks 5 and 6 run at both 1500 and 6000.
3. **A build without `site`.** It must emit no `og:image` or `og:url` at all, not a relative or `undefined` URL. Task 4 checks `dist/index.html`.
4. **Experience at 390px.** A one-liner may wrap to two lines, never three. The `experience-phone-390*` steps fail on three lines (Task 1).
5. **`cloud-phone-fps` is noisy on this machine.** Chunk 16's notes record it failing on both old and new shapes (29-48 fps against a 50 floor). Task 5 adds per-dot attributes, so its worker reports fps before and after on the same machine rather than reading one failure as a regression.

---

### Task 1: New shots checks for the hero, Experience, About, Contact and share preview
**Depends on:** none
**Files:** `scripts/shots.mjs`

Add these checks and scenarios. Name each page-side helper as given, so later tasks can refer to it. Use the existing `readable`, `allOf`, `toggleTheme`, `show`, `titleFits` and `cloudShows`. Count lines as `Math.round(el.offsetHeight / parseFloat(getComputedStyle(el).lineHeight))`: `offsetHeight` measures layout, so the entrance transforms do not skew it.

- [ ] **Step 0: `SHOTS_SKIP`.** Next to `SHOTS`, read `SHOTS_SKIP` as a comma list of scenario names to leave out. A name in `SHOTS_SKIP` that matches no scenario is an error, so a typo cannot silently skip nothing. Update the usage comment at the top.
- [ ] **Step 1: Hero.** `heroProof(maxLines)` returns an error string unless:
  - `.intro-pitch p` is at most `maxLines` lines,
  - it contains `a.inline-link[href="/projects/siem"]`,
  - `.intro-pitch .button` top is at or below the `p` bottom (`>= bottom - 0.5`).

  Add the scenarios `hero-proof` and `hero-proof-light` (desktop), and `hero-proof-phone-390` and `hero-proof-phone-390-light` (phone). Each uses `waitMs: 6000` and the check `allOf(heroProof(viewport.width >= 1440 ? 2 : Infinity), readable('.intro-pitch', 'p, .inline-link'))`. The spec caps the line count only at 1440. Each step reads like `hero proof line at <w>px, <theme>: at most two lines (1440 only), SIEM linked to /projects/siem, Download CV below it, text at 4.5:1 or more`.
- [ ] **Step 2: Experience.** `oneLiners(maxLines)` returns an error string unless:
  - every `.experience-body li` is at most `maxLines` lines (the message names the first offender's text and line count),
  - the first `.experience-role` holds exactly 3 `li .inline-link[href="/projects/siem"]`.

  In the generated `experience*` scenarios, add `, .inline-link` to the text selectors, and add `oneLiners(viewport.width >= 1440 ? 1 : 2)` to the check. Update each step to say "every bullet one line" at 1440 or "at most two lines" at 390, and "the three AI bullets link to the SIEM page".
- [ ] **Step 3: About.** `aboutLayout(stacked)` returns an error string unless:
  - `#about .prose p` count is 2,
  - the `#about .about-facts dt` texts are exactly `['Based in', 'Working on', 'Stack', 'Open to']`.
  - When not stacked: `.about-facts` left is at least `.prose` right, and their vertical ranges overlap.
  - When stacked: `.about-facts` top is at least `.prose` bottom.

  In the generated `about*` scenarios, the text becomes `'h2, .prose p, .about-facts dt, .about-facts dd'`, and the check adds `aboutLayout(viewport.width <= 1040)`.
- [ ] **Step 4: Contact.** `contactTrimmed` returns an error string if the `.contact-pitch` text, lowercased, contains the lowercased `dd` that follows the `Open to` `dt` in `#about`, or equals any `#about .prose p`. It also returns an error when About has no `Open to` fact, so a missing fact cannot read as a pass. Add it to the generated `contact*` checks.
- [ ] **Step 5: Share tags.** `shareTags` returns an error string unless:
  - `meta[property="og:title"]` content equals `document.title`,
  - `og:description` equals `meta[name="description"]` content,
  - `meta[name="twitter:card"]` is `summary_large_image`,
  - `og:image` is an absolute http(s) URL whose pathname is `/og.png`,
  - `og:url` is absolute, with a pathname equal to `location.pathname` (ignore trailing slashes).

  If `og:image` is missing, the error says `og:image missing; build with --site or set site in astro.config.mjs`. Add the scenarios `share-tags` (page `''`) and `share-tags-case` (page `projects/siem`), desktop, with `waitMs: 300`.
- [ ] **Step 6: Share image.** `share-image` (desktop, `waitMs: 300`) loads `new URL('/og.png', location.origin)` through `new Image()` and checks `naturalWidth === 1200 && naturalHeight === 630`. The step reads `the served /og.png is a 1200x630 image`.
- [ ] **Step 7: The `og` scenario.** Viewport `{ width: 1200, height: 630, deviceScaleFactor: 1, mobile: false }`, `waitMs: 7000`, check `allOf(titleFits, cloudShows('sphere'), <.intro-pitch computed opacity is '1'>)`. The screenshot is written as `og.png`. The step reads `Home first screen at 1200x630 for the share image: title fits, sphere drawn, proof line shown`.
- [ ] **Step 8: Prove the checks can fail.** Run `npm run build && SHOTS_SERVE=1 SHOTS=hero-proof,experience,experience-phone-390,about,contact,share-tags,share-image,og node scripts/shots.mjs` on today's content. Expected failures:
  - `hero-proof`: no SIEM link,
  - `experience`: multi-line bullets and no links,
  - `about`: 3 paragraphs and no facts,
  - `contact`: no `Open to` fact in About,
  - `share-tags`: no og tags,
  - `share-image`: no image.

  `og` passes. Record the failing output in the report. Then run `SHOTS=desktop,projects,scene-arc-2 ...` to show the existing scenarios still pass. Show that `SHOTS_SKIP=cloud-phone-fps` leaves that scenario out of `shots.json` and that `SHOTS_SKIP=nope` exits 1. Run `node --check scripts/shots.mjs` too.

### Task 2: Hero proof line and Experience one-liners
**Depends on:** Task 1 (proves itself with its hero-proof and experience scenarios)
**Files:** `src/pages/index.astro`, `src/styles/global.css`, `README.md`

- [ ] **Step 1: Hero.** Replace the `.intro-pitch p` text with one sentence. It must say production AI on the SIEM, about 1,000 events/sec, and onboarding new log sources in minutes instead of about 7 days. Only the words naming the SIEM link to `/projects/siem`, as `<a class="inline-link" href="/projects/siem">`. Change no other markup or CSS of the intro.
- [ ] **Step 2: Home description.** Set the home `description` prop on `<Base>` to the same sentence in plain text.
- [ ] **Step 3: `.inline-link` in `global.css`.** Text colour inherits (`--textBody`), the underline is in `--accent` with an offset, hover is `--accent`, and `:focus-visible` gets a visible outline.
- [ ] **Step 4: Experience data.** `highlights` becomes `{ text: string; href?: string }[]`. When `href` is set, the `li` renders `<a class="inline-link" href={href}>{text}</a>`. Rewrite each MozoX and CNG bullet as a one-liner that opens with its result, using only numbers from the current bullets, for example `Log-source onboarding: ~7 days to minutes`. The log parser, correlation engine and agentic investigation bullets get `href: '/projects/siem'`. Mark the array as draft copy.
- [ ] **Step 5: The CV-sync comment.** Replace the "copied from the cv … keep the two in step" comment in `index.astro`, and the matching sentence on line 13 of `README.md`. Both now say the site gives one-line summaries, the full wording lives in `public/cv.pdf`, and the numbers must match it.
- [ ] **Step 6: Run the steps.** `npm run build && SHOTS_SERVE=1 SHOTS=hero-proof,hero-proof-light,hero-proof-phone-390,hero-proof-phone-390-light,experience,experience-light,experience-phone-390,experience-phone-390-light,experience-enter,desktop,phone-390,og node scripts/shots.mjs` passes. Look at `hero-proof`, `experience` and `experience-phone-390-light` by eye.

### Task 3: About facts and a trimmed Contact
**Depends on:** Task 2, Task 1 (proves itself with its about and contact scenarios)
**Files:** `src/pages/index.astro`, `src/styles/global.css`

- [ ] **Step 1: About copy.** Cut `about` to two short paragraphs. The current third paragraph, the invitation to get in touch, belongs to Contact.
- [ ] **Step 2: Facts list.** Add an `aboutFacts: { label: string; value: string }[]` with the rows Based in, Working on, Stack and Open to, as draft copy. Take the values from the CV, for example Ho Chi Minh City, Vietnam; production AI on a multi-tenant SIEM at MozoX; the SIEM stack from `data.ts`; remote full-stack roles. Render it as `<dl class="case-facts about-facts">`, with each label in a `dt` and each value in a `dd`, as on the case page.
- [ ] **Step 3: Layout.** Wrap `.prose` and the list in an `.about-body` in `global.css`. Above 1040px it is two columns, prose left and facts right. At 1040px and below it stacks, prose first. The paragraphs keep their 68ch measure.
- [ ] **Step 4: Contact.** Rewrite `contactPitch` so it no longer says what About says: no "open to" roles, and no paragraph copied from About. Promise nothing that is not on record. The footer markup stays as it is.
- [ ] **Step 5: Run the steps.** `npm run build && SHOTS_SERVE=1 SHOTS=about,about-light,about-phone-390,about-phone-390-light,contact,contact-light,contact-phone-390,contact-phone-390-light,headings-revealed,nav-jumps node scripts/shots.mjs` passes. Look at `about` and `about-phone-390-light` by eye.

### Task 4: Open Graph and Twitter tags
**Depends on:** Task 1 (proves itself with its share-tags scenarios)
**Files:** `src/layouts/Base.astro`, `astro.config.mjs`

- [ ] **Step 1: Tags in `Base.astro`.** Add `og:title` (from `title`), `og:description` (from `description`), `og:type` `website` and `twitter:card` `summary_large_image`. Only when `Astro.site` is set, also add `og:image` as `new URL('/og.png', Astro.site)` and `og:url` as `new URL(Astro.url.pathname, Astro.site)`.
- [ ] **Step 2: Config comment.** Add a comment in `astro.config.mjs` saying `site` is set once hosting is decided (chunk 11), and that `og:image` and `og:url` need it. Do not set a value.
- [ ] **Step 3: Run the steps.** `npm run build -- --site https://example.com && SHOTS_SERVE=1 SHOTS=share-tags,share-tags-case node scripts/shots.mjs` passes. Then `npm run build` without `--site` must leave `dist/index.html` with no `og:image` and no `og:url`, while `og:title` is present. Check with grep, and paste the output in the report.

### Task 5: Per-dot size and the Arc and SIEM diagrams
**Depends on:** Task 1 (shares `scripts/shots.mjs`)
**Files:** `src/lib/shapes.ts`, `src/lib/shapes.test.ts`, `src/scripts/cloud.ts`, `scripts/shots.mjs`

**Interfaces produced:** `Track = { names: string[]; shapes: Float32Array[]; sizes: Float32Array[] }`. `sizes[k].length === count`, and sizes are greater than 0. `Point = [x, y, z, presence, size]`. `buildTrack(rows, count, seed = DEFAULT_SEED)` keeps its signature in this task.

- [ ] **Step 1: Failing tests in `shapes.test.ts`.** Each runs at counts 1500 and 6000.
  - `gives every shape a size per particle, 1 on the sphere and the settle`: `sizes.length === shapes.length`, each `sizes[k]` has length `count`, every value in every shape is above 0, and all values are 1 for `sphere` and `settle`.
  - `draws the arc-1, siem-3, siem-4 and siem-6 diagrams in enlarged dots in the band`: each of these shapes has more than 0 dots with size above 1, and every one of them has `y >= HALO_INNER` and `|x| <= TEXT_EDGE`.
  - `keeps the field in the band or behind the console`: in arc-1, siem-3 and siem-4, every size-1 present dot is either in the band or at |x| up to 0.78 and y in [`VISUAL_FLOOR`, 0.58].
  - `keeps every arc and siem particle present before the cut`: arc-1 through arc-4 and siem-1 through siem-4 have `count` dots with presence above 0.5.
  - Delete `places the siem clusters in the halo` (decision 11). Keep the no-dots-over-text, siem cut, survivors-in-halo, lanes and determinism tests unchanged.
- [ ] **Step 2: Watch them fail.** Run `npx vitest run src/lib/shapes.test.ts`. The new tests fail with `sizes` undefined.
- [ ] **Step 3: Implement in `shapes.ts`.**
  - `fill` writes size into a second array.
  - `kept` keeps the previous size.
  - arc-1 draws its root, mid and leaf nodes, and siem-3 draws its five clusters, as fixed counts of enlarged dots. siem-4 joins the cluster nodes with thin dotted links (evenly spaced dots along each segment, slightly enlarged). siem-6's survivors draw the arch as enlarged dots.
  - The other particles form the field (decisions 10 and 11).
  - Tune counts and sizes by eye.
- [ ] **Step 4: Implement in `cloud.ts`.** Add the `aFromSize` and `aToSize` float attributes, loaded from `track.sizes` in `load()`. In the shader, `gl_PointSize = POINT_SIZE * mix(aFromSize, aToSize, uMorph) * (1.0 + DEPTH_SIZE * z)`. The sphere start uses the sphere's sizes, which are 1.
- [ ] **Step 5: Watch them pass.** `npx vitest run src/lib/shapes.test.ts src/scripts/cloud.test.ts` passes.
- [ ] **Step 6: Shots.** Add `'scene-arc-1': 0.002` and `'scene-arc-1-light': 0.002` to `CLOUD_SEEN`, and `[ARC, 'arc', 1, true]` to `sceneScenarios`. Then run `npm run build && SHOTS_SERVE=1 SHOTS=scene-arc-1,scene-arc-1-light,scene-arc-2,scene-siem-3,scene-siem-3-light,scene-siem-4,scene-siem-5,scene-siem-6,scene-siem-2-phone-390,cloud-sweep,cloud-phone-fps node scripts/shots.mjs`. Every step passes except possibly `cloud-phone-fps` (decision 15). Run it three times before and three times after this change on the same machine, and report both fps ranges. Any after-range clearly below the before-range is a regression to fix. Look at arc-1, siem-3, siem-4 and siem-6 by eye in dark and light, and at siem-2 at 390.

### Task 6: Opal's next screen beside the phone
**Depends on:** Task 5
**Files:** `src/lib/shapes.ts`, `src/lib/shapes.test.ts`, `src/scripts/cloud.ts`, `scripts/shots.mjs`

**Interfaces:**
- Consumes: `Track.sizes` and the 5-element `Point` from Task 5.
- Produces: `buildTrack(rows, count, { seed = DEFAULT_SEED, still = false }: { seed?: number; still?: boolean } = {})`.

- [ ] **Step 1: Failing tests in `shapes.test.ts`.** Each runs at 1500 and 6000. Patch rect: x in [0.34, 0.80], |y| at most 0.5. Behind the phone: |x| at most 0.26, |y| at most 0.57.
  - `draws opal steps 1-3 as a phone-shaped patch beside the phone`: in opal-1 through opal-3, every dot with size above 1 lies in the patch rect, and there are more than 0 of them. The bounding box of those dots has a width:height ratio within 5% of 250:510. Every other present dot is behind the phone.
  - `draws a different screen in each patch`: between opal-1 and opal-2, and between opal-2 and opal-3, the mean per-particle distance over all particles is above 0.05 (the current "each one different" loop, kept).
  - `disperses opal-4 into a loose field`: no dot has size above 1, every present dot has y at or above `VISUAL_FLOOR` and |x| at most `TEXT_EDGE`, and the present x span is above 1.
  - `shows no patch in a still track`: with `buildTrack(ROWS, count, { still: true })`, opal-1 through opal-4 have no dot with size above 1 and keep the same bounds.
  - Extend `keeps arc and siem dots clear of the caption and the title column` to opal-1 through opal-4.
  - Delete `draws every opal screen inside a 250:510 phone, each one different`.
  - Change the determinism test's seed call to `buildTrack(ROWS, COUNT, { seed: 2 })`.
- [ ] **Step 2: Watch them fail.** `npx vitest run src/lib/shapes.test.ts` fails on the outline shapes.
- [ ] **Step 3: Implement in `shapes.ts`.** Opal step k draws screen k+1's inner parts, today's Areas, Workout and You designs, plus a frame, scaled into the patch rect as enlarged dots (decision 12). The other particles stay behind the phone. Step 4, and every step when `still` is set, places the loose field. Delete `phoneFrame` and the full-height outline.
- [ ] **Step 4: Implement in `cloud.ts`.** Call `buildTrack(options.rows, mode.count, { still: !mode.live })`.
- [ ] **Step 5: Watch them pass.** `npx vitest run src/lib/shapes.test.ts src/scripts/cloud.test.ts` passes.
- [ ] **Step 6: Shots.** Add `CLOUD_SEEN` gates `'scene-opal-1': 0.001`, `'scene-opal-2': 0.001` and `'scene-opal-3': 0.001`, and wire `cloudVisible: CLOUD_SEEN[name]` into `opalScenarios`. Add the scenario `cloud-opal-reduced-motion`: desktop, reduced, opal's `.project-visual` scrolled to centre, clip `row(OPAL)`. Its check is a prefix test: `` `(() => { const shape = ${cloudShape}; return shape?.startsWith('opal-') ? '' : 'cloud shows ' + shape + ' with the opal row in view'; })()` `` (`cloudShows` matches whole names only). Its step reads `opal row under reduced motion: the cloud draws a still opal frame with no patch beside the phone`. Then run `npm run build && SHOTS_SERVE=1 SHOTS=scene-opal-1,scene-opal-2,scene-opal-3,scene-opal-4,scene-opal-2-light,scene-opal-2-phone-390,cloud-opal-reduced-motion,scenes-reduced-motion,cloud-settle node scripts/shots.mjs`. All steps pass. Attach opal 1-4 at 1440 dark, opal-2 light, opal-2 at 390 and the reduced-motion shot for the reviewer. The patch's clearance from the names, the caption and the title column is gated by the Step 1 unit tests (decision 16).

### Task 7: The committed share image
**Depends on:** Task 2 (captures its hero copy), Task 1 (uses its og and share-image scenarios)
**Files:** `public/og.png`, `src/og.test.ts`

- [ ] **Step 1: Failing test.** In `src/og.test.ts`, `public/og.png is a 1200x630 png` reads the file with `node:fs`, checks the PNG signature, and reads width and height from the IHDR (big-endian uint32 at bytes 16 and 20). Run `npx vitest run src/og.test.ts`. It fails because the file is missing.
- [ ] **Step 2: Capture.** Run `npm run build && SHOTS_SERVE=1 SHOTS=og node scripts/shots.mjs <tmp dir>`, then copy `<tmp dir>/og.png` to `public/og.png`. Look at it by eye: the name, the role line, the proof line and the sphere are all legible.
- [ ] **Step 3: Pass.** `npx vitest run src/og.test.ts` passes, and `npm run build && SHOTS_SERVE=1 SHOTS=share-image,og node scripts/shots.mjs` passes.
