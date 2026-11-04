# Portfolio: next improvements, design

Date: 2026-11-04
Initiative: Portfolio redesign (effort:cfbbf16d-7742-4c43-a3d1-46211de27e7b), chunk 8 (Polish)
Brainstorm: `.superpowers/brainstorm/next-improvements/brainstorm.json` (gitignored)

## Intent

The site is going out with job applications. After 30 seconds, a hiring manager should leave knowing three things:

1. Khang ships production AI and full-stack features on a real multi-tenant SIEM, with measured results: onboarding a new log source dropped from about 7 days to minutes, and the triage queue was cut by 95-97%.
2. He builds tools engineers use, shown by Arc.
3. The CV and a way to reach him are one click away.

Everything else, including motion, About and case-page depth, supports those three or comes second. So proof belongs above the fold, and Experience should be scannable rather than a second copy of the CV.

## Timing

Do every item below before going live. The Nov 8 wave-1 date is dropped, and no new date is set: the site goes live when this round is done. Going live (initiative chunks 11 and 12) follows this round and is not part of it. Agent's call: after approval, this round is recorded on the initiative (a chunk 8 note that Nov 8 is dropped with no new date, and chunk 17 marked as replaced).

## Goals

### 1. Hero: proof above the fold

- **The change.** Replace the sentence under the title with one shipped result. Today the sentence is "Full-stack software developer. I build the tools engineers use."
- **Example.** Production AI on a SIEM handling ~1,000 events/sec that onboards new log sources in minutes instead of ~7 days.
- **Link.** The SIEM part of the sentence links to `/projects/siem`.
- **What stays.** Only the text in `.intro-pitch` changes. The layout, the fade-in and the Download CV button stay as they are.
- **Length.** The sentence takes the full width, up to two lines at 1440, and the Download CV button drops below it. The flex-wrap on .intro-pitch already does this, so no CSS changes. At 390 the button already sits below.

### 2. Experience: scannable, not the CV

- **One line per bullet.** Cut every bullet to one line that opens with its result, for example:
  - "Log-source onboarding: ~7 days to minutes"
  - "Triage queue cut 95-97%"
  - "Agentic rule proposals at under 2 cents each"
- **Links.** The three AI bullets (log parser, correlation engine, agentic investigation) link to `/projects/siem`, where the depth already lives.
- **Relationship to the CV.** The long CV wording stays in `public/cv.pdf`, so the site bullets no longer copy the CV word for word. Update the comment in `index.astro` that says to keep the two in step.
- **CNG.** CNG has no numbers, so its bullets become one-liners too.
- **Narrow screens.** Agent's call: the one-line rule holds at 1440. At 390 a bullet may wrap to two lines.

### 3. About and Contact

- **About text.** About keeps two short paragraphs on the left, cut down from the current three.
- **About facts.** About gains a facts list on the empty right half, with the rows Based in, Working on, Stack and Open to. Build it from the case-page facts layout (`.case-facts` in `[slug].astro`): a JetBrains Mono label with the value beside it.
- **Contact.** Contact keeps its footer but stops repeating what About already says.
- **No photo.** There is none in the repo, and none was asked for.

### 4. Share preview

- **Image.** Add a step to `scripts/shots.mjs` that captures the Home first screen once at 1200x630, and commit the result as `public/og.png`.
- **Tags.** Put `og:title`, `og:description`, `og:image`, `og:url` and `twitter:card` (`summary_large_image`) in `Base.astro`, so every page shares the image.
- **Absolute URLs.** `og:image` and `og:url` need absolute URLs, which in turn need `site` set in `astro.config.mjs`. Hosting is undecided (chunk 11), so build the tags to read `site` and fill the value in once hosting is decided.

### 5. Cloud shapes

- **Arc and SIEM.** Both stay in the band above the console (y 0.7 to 1, |x| under `TEXT_EDGE` 0.82). They draw fewer, larger dots on the nodes, joined by thin dotted links, so the task graph, the clusters and the arch read as diagrams instead of blobs and haze.
- **Particle count.** Agent's call: every particle stays present in every Arc and SIEM step, so the SIEM step-5 cut to 3-5% still reads as a cut, and its test stays. The diagram treatment applies to arc-1 (task graph), siem-3 and siem-4 (clusters, chain) and siem-6 (arch). Particles on nodes and links draw larger and brighter through a per-dot size. The rest stay as a dim field in the band, or hidden behind the console.
- **Opal.** Opal stops outlining its phone. Instead it forms each next screen as a phone-shaped patch of dots in the empty space beside the real phone, just before the phone slides to that screen. The opal box has no background, and the phone fills only 250 of the box's 680px width, so that space is free.
- **Opal timing.** Agent's call: opal step k shows the patch of screen k+1 beside the phone. At step 4 there is no next screen, so the patch disperses into a loose field. Reduced motion and no-JS show no patch.
- **Chunk 17.** This replaces chunk 17 (opal's outline crossing the screen names). With no outline around the phone, nothing crosses the names (y about -0.66) or the caption (y about -0.79).

## Non-goals

- **Hero layout.** No new hero layout, metric tiles, or changes to the decoding name, the cycling roles or the sphere.
- **Experience extras.** No expand/collapse in Experience and no numbers in the date column.
- **About layout.** No photo, and no merging About and Contact into one section.
- **Share images.** No per-page share images and no build-time image rendering. No new dependencies.
- **Visual box.** No change to the visual box size (680x520) or to the consoles.
- **Deferred chunks.** Hosting, going live, and checking on real devices (chunks 11, 12 and 18) are out of scope.

## Constraints

- **Shape bounds.** Arc, SIEM and opal dots must stay clear of scene text. No dot below `VISUAL_FLOOR` (-0.55) or past `TEXT_EDGE` (0.82), except opal's patch, which sits inside the opal box beside the phone and must also stay clear of the names, the caption and the title column.
- **Reduced motion and no-JS.** Both keep working as today: static frames, with everything readable.
- **Contrast.** Text stays at 4.5:1 or better in both themes.
- **Facts are public.** Every number used is already on the public CV, and the SIEM page names MozoX (cleared 10-30).

## Context: how things are built today

- **Hero.**
  - The intro header (`src/pages/index.astro`) holds the decoding name (`data-decode`, `decoder.ts`), then "Full-stack" with a cycling role word (`page.ts`, `data-role`, where `--titleFit` shrinks the title to fit), then `.intro-pitch` with one line and the Download CV button.
  - The intro is 100svh. The three.js sphere dissolves into the page-wide cloud on scroll (`cloud.ts`, lazy-loaded).
- **Experience.**
  - The `experience` array in `index.astro` holds the MozoX role (five bullets, each 3-5 lines at 1440) and the CNG role (three bullets).
  - Each role is a grid of dates (200px) | marker | body, styled by `.experience-role` in `global.css`.
  - The timeline draws with scroll (`page.ts` reads role rects). Items spring in through `reveal.ts` (`ROLE_ITEMS`, which includes every `li`), so shorter `li`s need no motion change.
- **About and Contact.**
  - About is the `about` array (three draft paragraphs) in `.prose`, capped at 68ch.
  - Contact is the page footer: pitch line, email `.button`, GitHub and LinkedIn from `social` in `data.ts`, and a copyright line.
  - Copy is draft until Khang finalizes it (chunk 9).
- **Share.**
  - `Base.astro` is the single head for every page. It sets only the title, the meta description and the svg favicon.
  - `public/` holds `cv.pdf` and `favicon.svg`.
  - `scripts/shots.mjs` drives a headless browser against the dev server (`npx astro dev` on 4321) and renders WebGL in software, so shots match across machines.
- **Shapes.**
  - `src/lib/shapes.ts`. Since 79d76cc, Arc and SIEM play only in the band above the visual, because the visual hides shape space out to about 0.82 x 0.62.
  - That squeezes the Arc graph to about 0.2 tall: the root sits at y 0.95, the mid nodes at 0.85 and the leaves at 0.75.
  - Every dot is `POINT_SIZE` 3 (`cloud.ts`). The shader already scales `gl_PointSize` by depth.
  - Opal keeps a 250:510 outline spanning y -1 to 1, and a test pins that ratio.
  - `shapes.test.ts` checks that no Arc or SIEM dot sits below `VISUAL_FLOOR` or past `TEXT_EDGE`.
- **Unpushed commit.** 79d76cc is not pushed yet.

## Left to the builder

1. **Copy.** Write the wording of the hero proof line, the Experience one-liners, the About facts values and the trimmed Contact line. Draft them from the CV (`public/cv.pdf`, the current `experience` and `about` arrays) and mark them as drafts for Khang to finalize, since chunk 9 owns final copy.
2. **Dot tuning.** Choose dot sizes and counts for the bolder band, which likely means a per-dot size in the cloud shader. Choose the opal patch's position and size beside the phone. Tune both by eye at 1440 and 390, in dark and light.
3. **Tests.**
   - Keep the no-dots-over-text test and extend it to opal.
   - Replace the 250:510 outline ratio test with one that checks the opal patch stays beside the phone and off the names and caption.
   - Add shots for the new hero line (at most two lines at 1440, button below), the Experience one-liners, the About facts and the share image.
4. **Share image.** Capture `og.png` after the copy lands.
5. **Unchecked views.** Look at phones (390) and the light theme for every changed section. The recon covered only 1440 dark.
