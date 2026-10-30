// screenshots of the site through the chrome devtools protocol.
// headless chrome's window cannot go below ~500px wide, so phone sizes need device emulation.
// usage: node scripts/shots.mjs [outDir]   (dev server on http://localhost:4321, or set BASE_URL;
// SHOTS_SERVE=1 serves the last build (dist/) itself on a free port instead, so run `npm run build` first;
// SHOTS=phone-390,role-wipe runs only those)
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { READING_LINE, REVEAL_END, REVEAL_START } from '../src/lib/scene.ts';

const OUT = process.argv[2] ?? process.env.ARC_FINAL_OUT ?? join(tmpdir(), 'portfolio-shots');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PREVIEW_TIMEOUT_MS = 30_000;
const CHROME = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find(p => p && existsSync(p));

const desktop = { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false };
const phone = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true };
const toggleTheme = "document.querySelector('[data-theme-toggle]').click()";
// returns an error string when the longest role would run past the viewport
const titleFits = `(() => {
  const right = Math.max(...[...document.querySelectorAll('[data-title-sizer] > *')].map(s => s.getBoundingClientRect().right));
  return right > innerWidth ? 'title overflows: ' + Math.round(right) + 'px > ' + innerWidth + 'px' : '';
})()`;
const show = id => `document.getElementById('${id}').scrollIntoView()`;
const showExperience = show('experience');
// returns an error string when the section runs past the viewport or its text drops below 4.5:1 (wcag aa).
// colours go through a 1px canvas so color-mix and translucent text are composited as the browser draws them
const readable = (selector, text) => `(() => {
  const section = document.querySelector('${selector}');
  const over = [...section.querySelectorAll('*')].find(el => el.getBoundingClientRect().right > innerWidth + 0.5);
  if (over) return '${selector} overflows: .' + over.className + ' ends at ' + Math.round(over.getBoundingClientRect().right) + 'px > ' + innerWidth + 'px';
  const ctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
  const paint = (...colors) => {
    ctx.clearRect(0, 0, 1, 1);
    for (const c of colors) {
      ctx.fillStyle = 'transparent';
      ctx.fillStyle = c;
      if (ctx.fillStyle === 'rgba(0, 0, 0, 0)') throw new Error('canvas cannot parse colour ' + c);
      ctx.fillRect(0, 0, 1, 1);
    }
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
  };
  const luminance = rgb => rgb
    .map(v => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const bg = getComputedStyle(document.body).backgroundColor;
  const unmatched = '${text}'.split(',').find(selector => !section.querySelector(selector));
  if (unmatched) return '${selector}: ' + unmatched + ' matches nothing, so its contrast is unchecked';
  const low = [...section.querySelectorAll('${text}')]
    .map(el => {
      const [a, b] = [luminance(paint(bg)), luminance(paint(bg, getComputedStyle(el).color))];
      return { el, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
    })
    .filter(({ ratio }) => ratio < 4.5);
  return low.map(({ el, ratio }) => (el.className || el.tagName) + ' contrast ' + ratio.toFixed(2) + ':1').join(', ');
})()`;

// returns an error string when the project visuals differ in size, anything spills out, or a phone screenshot
// fails to load. the screenshots are lazy and the clip never scrolls to them, so they are forced to load first
const projectsFit = `(async () => {
  for (const img of document.querySelectorAll('#projects .phone img')) {
    img.loading = 'eager';
    try { await img.decode(); } catch { return 'phone screenshot does not load: ' + img.currentSrc; }
  }
  const rows = document.querySelectorAll('#projects .project').length;
  const boxes = [...document.querySelectorAll('#projects .project-visual')].map(b => b.getBoundingClientRect());
  const size = b => Math.round(b.width) + 'x' + Math.round(b.height);
  if (!rows || boxes.length !== rows) return 'expected one visual per project row, found ' + boxes.length + ' for ' + rows;
  if (new Set(boxes.map(size)).size > 1) return 'project visuals differ: ' + boxes.map(size).join(', ');
  // content clipped by an ancestor, such as a visually hidden step caption, cannot run past; the ancestor is checked itself
  const clipped = el => {
    for (let a = el.parentElement; a.id !== 'projects'; a = a.parentElement) if (/hidden|clip/.test(getComputedStyle(a).overflowX)) return true;
    return false;
  };
  const wide = [...document.querySelectorAll('#projects *')].find(el => el.getBoundingClientRect().right > innerWidth + 0.5 && !clipped(el));
  if (wide) return 'runs past the viewport: ' + wide.tagName + '.' + wide.getAttribute('class');
  const spill = [...document.querySelectorAll('.phone')].find(p => p.scrollWidth > p.clientWidth || p.scrollHeight > p.clientHeight);
  return spill ? 'screenshot spills out of its phone: ' + spill.querySelector('img')?.alt : '';
})()`;
// returns an error string naming any project link that does not load
const projectLinksLoad = `Promise.all([...document.querySelectorAll('#projects .button')].map(a => fetch(a.href).then(r => r.ok ? '' : a.getAttribute('href') + ' ' + r.status)))
  .then(failed => failed.filter(Boolean).join(', '))`;
const caseText = 'h1, .project-description, .case-facts dt, .case-facts dd, .case-section h2, .prose p, .case-back, .case-next-label, .case-next-title';
const packetsStill = `getComputedStyle(document.querySelector('.diagram-packets')).animationName === 'none' ? '' : 'packets animate under reduced motion'`;
// joins checks that each return an error string or ''
const allOf = (...checks) => `[${checks.join(', ')}].filter(Boolean).join('; ')`;
const noScene = `document.querySelector('.scene, [data-at]') ? 'page renders scene markup' : ''`;

// --- scroll scenes: the row's data-step picks the step, each element's data-at is the step it lights in
const row = n => `#projects .project:nth-of-type(${n})`;
const ARC = 1;
const SIEM = 2;
const OPAL = 3;
const frames = 'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))';
// scrolls a pinned row to the middle of step k: its top plus (k - 0.5) / steps of its pinned scroll length.
// fonts first, since the driver re-measures rows when they arrive
const toStep = (n, k) => `(async () => {
  await document.fonts.ready;
  const row = document.querySelector('${row(n)}');
  const steps = Number(row.querySelector('.scene').dataset.steps);
  const { top, height } = row.getBoundingClientRect();
  window.scrollTo({ top: scrollY + top + (height - innerHeight) * (${k} - 0.5) / steps, behavior: 'instant' });
  await ${frames};
})()`;
// scrolls an unpinned row so its visual's centre sits where the reveal reads the middle of step k
const toRevealStep = (n, k) => `(async () => {
  await document.fonts.ready;
  const row = document.querySelector('${row(n)}');
  const steps = Number(row.querySelector('.scene').dataset.steps);
  const { top, height } = row.querySelector('.project-visual').getBoundingClientRect();
  const centre = (${REVEAL_START} - (${REVEAL_START - REVEAL_END}) * (${k} - 0.5) / steps) * innerHeight;
  window.scrollBy({ top: top + height / 2 - centre, behavior: 'instant' });
  await ${frames};
})()`;
// page-side helpers: on screen means not hidden, not transparent and not clipped away like .visually-hidden
const sceneKit = `
  const at = el => Number(el.dataset.at);
  const onScreen = el => el.checkVisibility({ opacityProperty: true, visibilityProperty: true })
    && getComputedStyle(el).clipPath === 'none' && el.getBoundingClientRect().width > 1;
  const litOf = root => [...root.querySelectorAll('.diagram :is(.diagram-edges, .diagram-boxes, .diagram-labels) [data-at]')];
  const opacityOf = el => getComputedStyle(el).opacity;
  const within = (inner, outer) => inner.left >= outer.left - 0.5 && inner.right <= outer.right + 0.5
    && inner.top >= outer.top - 0.5 && inner.bottom <= outer.bottom + 0.5;
`;
// returns an error string unless the row shows step k: diagram elements ahead faint and packets on the reached
// edges, or for the siem console only the k-th panel lit and the k-th command in its box, inside the box; and only
// the k-th caption
const showsStep = (n, k) => `(() => {
  ${sceneKit}
  const row = document.querySelector('${row(n)}');
  const errors = [];
  if (row.dataset.step !== '${k}') errors.push('row is at step ' + row.dataset.step);
  for (const el of litOf(row)) {
    const want = at(el) > ${k} ? '0.12' : '1';
    if (opacityOf(el) !== want) errors.push(el.tagName + ' of step ' + at(el) + ' has opacity ' + opacityOf(el) + ', not ' + want);
  }
  for (const el of row.querySelectorAll('.diagram-packets [data-at]')) {
    const want = at(el) <= ${k} ? '1' : '0';
    if (opacityOf(el) !== want) errors.push('packet of step ' + at(el) + ' has opacity ' + opacityOf(el) + ', not ' + want);
  }
  for (const el of row.querySelectorAll('.console .p')) {
    const want = at(el) === ${k} ? '1' : '0.4';
    if (opacityOf(el) !== want) errors.push('panel of step ' + at(el) + ' has opacity ' + opacityOf(el) + ', not ' + want);
  }
  const parts = ${n === SIEM} ? ['.scene-captions li', '.cmd-line'] : ['.scene-captions li'];
  for (const part of parts) {
    const shown = [...row.querySelectorAll(part)].filter(onScreen).map(at);
    if (shown.join() !== '${k}') errors.push(part + ' shows steps [' + shown.join(', ') + '], not only ${k}');
  }
  const dash = row.querySelector('.console')?.getBoundingClientRect();
  if (dash && !within(dash, row.querySelector('.project-visual').getBoundingClientRect())) errors.push('console runs out of its box');
  return errors.join('; ');
})()`;
// returns an error string unless the row is pinned with its text sticky and its box in the viewport
const pinned = n => `(() => {
  ${sceneKit}
  const row = document.querySelector('${row(n)}');
  const errors = [];
  if (!row.hasAttribute('data-pinned')) errors.push('row is not pinned');
  if (getComputedStyle(row.querySelector('.project-text')).position !== 'sticky') errors.push('row text is not sticky');
  const box = row.querySelector('.project-visual').getBoundingClientRect();
  if (!within(box, { left: 0, top: 0, right: innerWidth, bottom: innerHeight })) errors.push('box is not wholly in the viewport');
  return errors.join('; ');
})()`;
// the console keeps its own dark palette in both themes, like a screenshot, so only the captions are checked
const sceneText = '.scene-captions li span';
const sceneScenarios = [
  ...[1, 2, 3].map(k => [ARC, 'arc', k, false]),
  ...[1, 2, 3, 4, 5, 6].map(k => [SIEM, 'siem', k, false]),
  [ARC, 'arc', 2, true],
  [SIEM, 'siem', 3, true],
].map(([n, slug, k, light]) => ({
  name: `scene-${slug}-${k}${light ? '-light' : ''}`,
  viewport: desktop,
  waitMs: 1000,
  eval: light ? `${toggleTheme}; ${toStep(n, k)}` : toStep(n, k),
  check: allOf(pinned(n), showsStep(n, k), readable(row(n), sceneText)),
  step: `${slug} scene scrolled to step ${k} of ${slug === 'arc' ? 3 : 6}, ${light ? 'light' : 'dark'}: row pinned, ${slug === 'siem' ? `only panel ${k} lit and its command in the box` : 'elements ahead faint, packets on the reached edges'}, only caption ${k} shown, text at 4.5:1 or more`,
}));

// page-side helpers for the scroll checks
const scrollKit = `
  ${sceneKit}
  const projects = document.getElementById('projects');
  const sceneRows = [...projects.querySelectorAll('.project')].filter(r => r.querySelector('.scene'));
  const stickies = () => [...projects.querySelectorAll('*')].filter(el => getComputedStyle(el).position === 'sticky');
  // natural heights, as the driver measures them: a pinned row's text and scene are a viewport tall
  const contentOf = r => {
    const pinned = r.hasAttribute('data-pinned');
    r.removeAttribute('data-pinned');
    const height = Math.max(...['.project-text', '.scene'].map(s => r.querySelector(s).getBoundingClientRect().height));
    r.toggleAttribute('data-pinned', pinned);
    return height;
  };
`;
// returns an error string if any scene row is pinned, anything sticks, or a row keeps more height than its content
const unpinned = `(() => {
  ${scrollKit}
  const errors = [];
  for (const [i, r] of sceneRows.entries()) {
    if (contentOf(r) <= innerHeight) errors.push('row ' + (i + 1) + ' content (' + Math.round(contentOf(r)) + 'px) fits a ' + innerHeight + 'px window, so this does not test a short one');
    if (r.hasAttribute('data-pinned')) errors.push('row ' + (i + 1) + ' is pinned');
    const height = r.getBoundingClientRect().height;
    if (height > Math.max(contentOf(r), parseFloat(getComputedStyle(r).minHeight)) + 1) errors.push('row ' + (i + 1) + ' keeps a tall track of ' + Math.round(height) + 'px');
  }
  if (stickies().length) errors.push(stickies().length + ' elements are sticky');
  return errors.join('; ');
})()`;
// a window shorter than the rows' content (arc's is about 507px at 1280 wide); `unpinned` checks that it still is
const shortWindow = { width: 1280, height: 480, deviceScaleFactor: 1, mobile: false };
// a tenth of the viewport either side of the timeline's reading line
const CLEAR = 0.1;
// page-side helpers for the timeline: accent resolved through a probe, never compared as custom-property text
const timelineKit = `
  const probe = document.body.appendChild(document.createElement('i'));
  probe.style.color = 'var(--accent)';
  const accent = getComputedStyle(probe).color;
  probe.remove();
  const list = document.querySelector('.experience-list');
  const roles = [...list.querySelectorAll('.experience-role')];
  const marker = (role, part) => getComputedStyle(role.querySelector('.experience-marker'), part);
  const filled = role => marker(role, '::before').backgroundColor === accent;
  const fillOf = role => role.style.getPropertyValue('--fill');
  // share of the role's segment drawn in accent: the stop after the gradient's accent, or all of a flat accent line
  const drawn = role => {
    const line = marker(role, '::after');
    if (line.backgroundImage === 'none') return line.backgroundColor === accent ? 1 : 0;
    const [, after] = line.backgroundImage.split(accent + ' ');
    return after ? parseFloat(after) / 100 : 0;
  };
  const trackAfter = role => /(rgb|lab|color)\\(/.test(marker(role, '::after').backgroundImage.split(accent)[1] ?? '');
  const reading = ${READING_LINE} * innerHeight;
  const scrollToLine = (y, line) => window.scrollBy({ top: y - line * innerHeight, behavior: 'instant' });
`;
// returns an error string naming each role whose reached, fill, marker or segment differs from `want`
const rolesAre = want => `(() => {
  ${timelineKit}
  const want = ${want};
  const errors = [];
  roles.forEach((role, i) => {
    const w = want(i);
    if (!w) return;
    const name = 'role ' + (i + 1);
    if ('reached' in w && role.hasAttribute('data-reached') !== w.reached) errors.push(name + (w.reached ? ' is not' : ' is') + ' reached');
    if ('fill' in w && fillOf(role) !== w.fill) errors.push(name + ' has --fill ' + fillOf(role) + ', not ' + w.fill);
    if ('filled' in w && filled(role) !== w.filled) errors.push(name + ' marker is ' + (w.filled ? 'hollow' : 'filled'));
    const share = drawn(role);
    if (w.drawn === 'part' ? !(share > 0 && share < 1 && trackAfter(role)) : 'drawn' in w && share !== w.drawn) {
      errors.push(name + ' segment is ' + Math.round(share * 100) + '% accent, not ' + (w.drawn === 'part' ? 'part accent, part track' : w.drawn * 100 + '%'));
    }
  });
  return errors.join('; ');
})()`;
const drawing = on => `document.querySelector('.experience-list').hasAttribute('data-drawing') === ${on} ? '' : 'timeline ${on ? 'does not draw' : 'draws'}'`;

const SCENARIOS = [
  { name: 'desktop', viewport: desktop, waitMs: 7000, check: titleFits },
  // role words change every 5s; 6.2s lands inside the wipe of the second word
  { name: 'role-wipe', viewport: desktop, waitMs: 6200 },
  { name: 'light', viewport: desktop, waitMs: 6000, eval: toggleTheme },
  { name: 'phone-390', viewport: phone, waitMs: 6000, check: titleFits },
  { name: 'reduced-motion', viewport: desktop, waitMs: 1500, reduced: true, check: packetsStill },
  { name: 'projects', viewport: desktop, waitMs: 1500, clip: '#projects', check: projectsFit },
  { name: 'projects-light', viewport: desktop, waitMs: 1500, eval: toggleTheme, clip: '#projects', check: projectsFit },
  { name: 'projects-phone-390', viewport: phone, waitMs: 1500, clip: '#projects', check: projectsFit },
  { name: 'projects-phone-light', viewport: phone, waitMs: 1500, eval: toggleTheme, clip: '#projects', check: projectsFit },
  { name: 'project-links', viewport: desktop, waitMs: 500, check: projectLinksLoad, step: 'every View project link loads' },
  ...['arc', 'siem', 'opal'].flatMap(slug => [
    [`case-${slug}`, desktop, false],
    [`case-${slug}-phone-390-light`, phone, true],
  ].map(([name, viewport, light]) => ({
    name,
    viewport,
    page: `projects/${slug}`,
    waitMs: 1000,
    eval: light ? toggleTheme : undefined,
    check: allOf(readable('.case', caseText), noScene),
    clip: '.case',
    step: `${slug} case study at ${viewport.width}px, ${light ? 'light' : 'dark'}: fits the width, text at 4.5:1 or more, the finished visual with no scene`,
  }))),
  ...sceneScenarios,
  {
    name: 'scene-siem-2-phone-390',
    viewport: phone,
    waitMs: 1000,
    eval: toRevealStep(SIEM, 2),
    check: `(() => {
      ${sceneKit}
      const row = document.querySelector('${row(SIEM)}');
      if (row.dataset.step !== '2') return 'row is at step ' + row.dataset.step + ', not 2';
      if (row.hasAttribute('data-pinned')) return 'row is pinned on a phone';
      const panels = [...row.querySelectorAll('.console .p')].filter(onScreen);
      if (panels.map(at).join() !== '2') return 'panels shown for steps [' + panels.map(at).join(', ') + '], not only 2';
      const dash = row.querySelector('.console').getBoundingClientRect();
      const box = row.querySelector('.project-visual').getBoundingClientRect();
      const text = row.querySelector('.project-text').getBoundingClientRect();
      const caption = [...row.querySelectorAll('.scene-captions li')].find(onScreen)?.getBoundingClientRect();
      if (!within(dash, box)) return 'console runs out of its box';
      if (dash.left < -0.5 || dash.right > innerWidth + 0.5) return 'console runs past the viewport width';
      if (caption && box.bottom > caption.top + 0.5) return 'box overlaps the step caption';
      return box.bottom > text.top + 0.5 ? 'box overlaps the row text' : '';
    })()`,
    step: 'siem scene scrolled to step 2 on a 390px phone: not pinned, only the risk panel shows, the console inside its box and the width, above the caption and the row text',
  },
  {
    name: 'scenes-phone-390',
    viewport: phone,
    waitMs: 500,
    check: `(async () => {
      ${scrollKit}
      await document.fonts.ready;
      const errors = new Set();
      const seen = sceneRows.map(() => new Set());
      const { top, bottom } = projects.getBoundingClientRect();
      const start = scrollY + top - innerHeight;
      // a twelfth of the viewport per move is finer than the reveal's 0.6 viewport split into 6 steps
      for (let y = start; y <= scrollY + bottom; y += innerHeight / 12) {
        window.scrollTo({ top: y, behavior: 'instant' });
        await ${frames};
        for (const el of stickies()) errors.add('.' + el.className + ' is sticky');
        sceneRows.forEach((r, i) => {
          const step = Number(r.dataset.step);
          if (step < Math.max(0, ...seen[i])) errors.add('row ' + (i + 1) + ' went back to step ' + step);
          seen[i].add(step);
          const text = r.querySelector('.project-text').getBoundingClientRect();
          const figure = r.querySelector('.scene').getBoundingClientRect();
          if (figure.bottom > text.top + 0.5 && figure.top < text.bottom - 0.5) errors.add('row ' + (i + 1) + ' figure overlaps its text');
        });
      }
      sceneRows.forEach((r, i) => {
        const steps = Number(r.querySelector('.scene').dataset.steps);
        const all = Array.from({ length: steps }, (_, k) => k + 1).join();
        if ([...seen[i]].join() !== all) errors.add('row ' + (i + 1) + ' passed steps [' + [...seen[i]].join(', ') + '], not ' + all);
      });
      return [...errors].join('; ');
    })()`,
    step: 'scrolling down through the projects on a 390px phone: nothing sticky, each scene steps forward through every step, no figure over its text',
  },
  {
    name: 'scenes-short-window',
    viewport: shortWindow,
    waitMs: 1000,
    eval: toStep(ARC, 2),
    check: unpinned,
    step: 'a 1280x480 window, shorter than the rows: no row pinned, nothing sticky, no tall track',
  },
  {
    name: 'scenes-short-window-resize',
    viewport: desktop,
    eval: `${toStep(ARC, 2)}.then(() => (window.wasPinned = document.querySelector('${row(ARC)}').hasAttribute('data-pinned')))`,
    resize: shortWindow,
    waitMs: 1000,
    check: allOf(`window.wasPinned ? '' : 'arc row was not pinned before the resize'`, unpinned),
    step: 'arc row pinned at step 2, then the window made 480 tall: the row drops its pin and its tall track at once',
  },
  {
    name: 'scenes-1040',
    viewport: { ...desktop, width: 1040 },
    waitMs: 1000,
    eval: `(async () => {
      await document.fonts.ready;
      const box = document.querySelector('${row(ARC)} .project-visual').getBoundingClientRect();
      window.scrollBy({ top: box.top + box.height / 2 - innerHeight / 2, behavior: 'instant' });
      await ${frames};
    })()`,
    check: `(() => {
      ${scrollKit}
      const errors = [];
      for (const [i, r] of sceneRows.entries()) if (r.hasAttribute('data-pinned')) errors.push('row ' + (i + 1) + ' is pinned');
      if (stickies().length) errors.push(stickies().length + ' elements are sticky');
      const row = document.querySelector('${row(ARC)}');
      const text = row.querySelector('.project-text').getBoundingClientRect();
      const scene = row.querySelector('.scene').getBoundingClientRect();
      if (scene.top < text.bottom - 0.5 && text.top < scene.bottom - 0.5) errors.push('arc text and scene sit side by side');
      if (!row.dataset.step) errors.push('arc row has no step');
      return errors.join('; ');
    })()`,
    step: 'a 1040px window, where the rows stack: arc row centred, no row pinned, nothing sticky, text and scene stacked, the row still steps',
  },
  {
    name: 'scenes-1041',
    viewport: { ...desktop, width: 1041, height: 1000 },
    waitMs: 1000,
    eval: toStep(ARC, 2),
    check: allOf(pinned(ARC), `document.querySelector('${row(ARC)}').dataset.step === '2' ? '' : 'arc row is not at step 2'`),
    step: 'a 1041x1000 window, just above the stacking width: arc scrolled to step 2 is pinned with its text sticky',
  },
  {
    name: 'scenes-focus',
    viewport: desktop,
    waitMs: 1000,
    eval: `${toStep(ARC, 1)}.then(() => document.querySelector('${row(SIEM)} .button').focus())`,
    check: `(() => {
      ${sceneKit}
      const button = document.querySelector('${row(SIEM)} .button');
      const box = button.getBoundingClientRect();
      if (!within(box, { left: 0, top: 0, right: innerWidth, bottom: innerHeight })) return 'focused button is not wholly in the viewport';
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return button.contains(hit) ? '' : 'focused button is covered by ' + hit?.tagName + '.' + hit?.getAttribute('class');
    })()`,
    step: 'arc row pinned at step 1, then the siem row’s View project link focused: the link scrolls into view, uncovered',
  },
  {
    name: 'scenes-anchor',
    viewport: desktop,
    page: '#experience',
    waitMs: 1500,
    check: `(() => {
      ${scrollKit}
      ${timelineKit}
      const errors = [];
      sceneRows.forEach((r, i) => {
        const steps = r.querySelector('.scene').dataset.steps;
        if (r.dataset.step !== steps) errors.push('row ' + (i + 1) + ' is at step ' + r.dataset.step + ', not its last, ' + steps);
      });
      const heading = document.querySelector('#experience h2').getBoundingClientRect();
      if (heading.top < 0 || heading.bottom > innerHeight) errors.push('experience heading is not in the viewport');
      const behind = roles.filter(role => role.getBoundingClientRect().top < reading && !role.hasAttribute('data-reached'));
      if (behind.length) errors.push(behind.length + ' roles above the reading line are not reached');
      return errors.join('; ');
    })()`,
    step: 'opened at /#experience: the arc and siem rows above show their last step, the heading is in view, the timeline drawn to the reading line',
  },
  {
    name: 'scenes-reduced-motion',
    viewport: desktop,
    waitMs: 1000,
    reduced: true,
    eval: `(async () => {
      const { bottom } = document.getElementById('experience').getBoundingClientRect();
      for (let y = 0; y <= scrollY + bottom; y += innerHeight / 4) {
        window.scrollTo({ top: y, behavior: 'instant' });
        await ${frames};
      }
      ${show('projects')};
    })()`,
    check: allOf(packetsStill, `(() => {
      ${sceneKit}
      const projects = document.getElementById('projects');
      const errors = [];
      if (projects.querySelector('[data-step]')) errors.push('a row has a step under reduced motion');
      if (projects.querySelector('[data-pinned]')) errors.push('a row is pinned under reduced motion');
      if (document.querySelector('[data-drawing]')) errors.push('the timeline draws under reduced motion');
      const dim = [...litOf(projects), ...projects.querySelectorAll('.diagram-packets [data-at]')].filter(el => opacityOf(el) !== '1');
      if (dim.length) errors.push(dim.length + ' diagram elements are not fully lit');
      const hidden = [...projects.querySelectorAll('.scene-captions li')].filter(el => !onScreen(el));
      if (hidden.length) errors.push(hidden.length + ' step captions are not listed');
      const unlit = [...projects.querySelectorAll('.console .p')].filter(el => !onScreen(el) || opacityOf(el) !== '1');
      if (unlit.length) errors.push(unlit.length + ' console panels are not shown fully lit');
      if ([...projects.querySelectorAll('.cmd')].some(onScreen)) errors.push('the siem command box shows');
      return errors.join('; ');
    })()`),
    clip: '#projects',
    step: 'scenes under reduced motion: no steps, every diagram and console panel lit, packets still, every caption listed, no command box',
  },
  {
    name: 'scene-opal',
    viewport: desktop,
    waitMs: 1000,
    eval: `document.querySelector('${row(OPAL)}').scrollIntoView()`,
    check: `(() => {
      const row = document.querySelector('${row(OPAL)}');
      if (row.querySelector('.scene')) return 'opal row renders a scene while its scene is deferred';
      const images = row.querySelectorAll('.phone img').length;
      return images === 1 ? '' : 'opal row shows ' + images + ' phone images, not 1';
    })()`,
    clip: row(OPAL),
    step: 'opal row unchanged while its scene is deferred: no scene, one phone image',
  },
  ...[
    ['experience', 'h2, h3, .experience-dates, .experience-company, .experience-body li'],
    ['about', 'h2, .prose p'],
    ['contact', 'h2, .contact-pitch, .contact-links a, .contact-meta'],
  ].flatMap(([id, text]) => [
    [id, desktop, false],
    [`${id}-light`, desktop, true],
    [`${id}-phone-390`, phone, false],
    [`${id}-phone-390-light`, phone, true],
  ].map(([name, viewport, light]) => ({
    name,
    viewport,
    waitMs: 1500,
    eval: light ? `${toggleTheme}; ${show(id)}` : show(id),
    check: readable(`#${id}`, text),
    clip: `#${id}`,
    step: `${id} section at ${viewport.width}px, ${light ? 'light' : 'dark'}: fits the width, text at 4.5:1 or more`,
  }))),
  {
    name: 'experience-focus',
    viewport: desktop,
    waitMs: 500,
    eval: `${showExperience}; document.querySelector('#experience .button').focus()`,
    check: `(() => {
      const button = document.querySelector('#experience .button');
      return button.matches(':focus-visible') && getComputedStyle(button).outlineStyle !== 'none' ? '' : 'download cv button shows no focus ring';
    })()`,
    clip: '#experience',
    step: 'experience download cv button focused: focus ring visible',
  },
  {
    name: 'experience-draw-start',
    viewport: desktop,
    waitMs: 1000,
    eval: `(() => { ${timelineKit} scrollToLine(roles[0].getBoundingClientRect().top, ${READING_LINE + CLEAR}); })()`,
    check: allOf(drawing(true), rolesAre(`() => ({ reached: false, fill: '0', filled: false, drawn: 0 })`)),
    clip: '#experience',
    step: 'experience timeline with the reading line above the first role: nothing reached, every marker hollow, no accent line',
  },
  {
    name: 'experience-draw-mid',
    viewport: desktop,
    waitMs: 1000,
    eval: `(() => {
      ${timelineKit}
      const { top, height } = roles[0].getBoundingClientRect();
      scrollToLine(top + height / 2, ${READING_LINE});
    })()`,
    check: allOf(drawing(true), rolesAre(`i => [
      { reached: true, filled: true, drawn: 'part' },
      { reached: false, fill: '0', filled: false, drawn: 0 },
    ][i]`)),
    clip: '#experience',
    step: 'experience timeline with the reading line inside the first role: its marker filled and its line part drawn, the second role untouched',
  },
  {
    name: 'experience-draw-end',
    viewport: desktop,
    waitMs: 1000,
    eval: `(() => { ${timelineKit} scrollToLine(list.getBoundingClientRect().bottom, ${READING_LINE - CLEAR}); })()`,
    check: allOf(drawing(true), rolesAre(`() => ({ reached: true, fill: '1', filled: true, drawn: 1 })`)),
    clip: '#experience',
    step: 'experience timeline scrolled past the list: every role reached, every marker filled, the whole line accent',
  },
  {
    name: 'experience-reduced-motion',
    viewport: desktop,
    waitMs: 1000,
    reduced: true,
    eval: showExperience,
    check: allOf(drawing(false), rolesAre(`() => ({ filled: true, drawn: 1 })`)),
    clip: '#experience',
    step: 'experience timeline under reduced motion: not drawing, every marker filled, the whole line accent',
  },
];
// the page-space rect of a selector, for a screenshot of a section taller than the viewport
const clipOf = selector => `(() => {
  const r = document.querySelector('${selector}').getBoundingClientRect();
  return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height, scale: 1 };
})()`;

const only = process.env.SHOTS?.split(',');
const selected = only ? SCENARIOS.filter(s => only.includes(s.name)) : SCENARIOS;

if (!CHROME) {
  console.log('no chrome found; set CHROME to its path');
  process.exit(3);
}
mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const preview = process.env.SHOTS_SERVE === '1' ? await startPreview() : undefined;
const BASE_URL = preview?.url ?? process.env.BASE_URL ?? 'http://localhost:4321/';

// port 0 lets chrome pick a free devtools port, which it writes to DevToolsActivePort in the profile
const profile = mkdtempSync(join(tmpdir(), 'shots-profile-'));
const chrome = spawn(CHROME, [
  '--headless=new',
  '--enable-unsafe-swiftshader',
  '--use-angle=swiftshader',
  '--hide-scrollbars',
  '--no-first-run',
  '--remote-debugging-port=0',
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: 'ignore' });

const errors = [];

try {
  const ws = await connect();
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener('message', ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(`${msg.error.message} (${msg.error.code})`)) : resolve(msg.result);
    } else {
      listeners.forEach(fn => fn(msg));
    }
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      pending.set(++id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });

  const shots = [];
  for (const s of selected) {
    // a fresh context per scenario so a stored theme or background does not leak into the next
    const { browserContextId } = await send('Target.createBrowserContext');
    const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const onEvent = msg => {
      if (msg.sessionId !== sessionId) return;
      if (msg.method === 'Runtime.exceptionThrown') {
        errors.push(`${s.name}: ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`);
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        errors.push(`${s.name}: console.error ${msg.params.args.map(a => a.value ?? a.description).join(' ')}`);
      }
    };
    listeners.push(onEvent);
    await send('Runtime.enable', {}, sessionId);
    await send('Page.enable', {}, sessionId);
    await send('Emulation.setDeviceMetricsOverride', s.viewport, sessionId);
    if (s.viewport.mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true }, sessionId);
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: s.reduced ? 'reduce' : 'no-preference' }],
    }, sessionId);
    await send('Page.navigate', { url: new URL(s.page ?? '', BASE_URL).href }, sessionId);
    await sleep(800);
    if (s.eval) {
      const { exceptionDetails } = await send('Runtime.evaluate', { expression: s.eval, awaitPromise: true }, sessionId);
      if (exceptionDetails) errors.push(`${s.name}: eval threw ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
    }
    // a window resized mid-scenario, after the eval has set up the state before it
    if (s.resize) await send('Emulation.setDeviceMetricsOverride', s.resize, sessionId);
    await sleep(s.waitMs);
    if (s.check) {
      const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: s.check, returnByValue: true, awaitPromise: true }, sessionId);
      // a check that throws must fail, not read as a pass
      if (exceptionDetails) errors.push(`${s.name}: check threw ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
      else if (result.value) errors.push(`${s.name}: ${result.value}`);
    }
    const clip = s.clip && (await send('Runtime.evaluate', { expression: clipOf(s.clip), returnByValue: true }, sessionId)).result.value;
    const { data } = await send('Page.captureScreenshot', clip ? { format: 'png', clip, captureBeyondViewport: true } : { format: 'png' }, sessionId);
    const file = `${s.name}.png`;
    writeFileSync(join(OUT, file), Buffer.from(data, 'base64'));
    const step = s.step ?? `open at ${s.viewport.width}px${s.reduced ? ', reduced motion' : ''}${s.eval ? ', theme toggled' : ''}${s.clip ? `, ${s.clip} captured` : ''}`;
    const failed = errors.filter(e => e.startsWith(`${s.name}: `));
    shots.push({ name: s.name, files: [file], steps: [{ step, state: failed.length ? 'fail' : 'pass', detail: failed.join('; ') || undefined }] });
    listeners.splice(listeners.indexOf(onEvent), 1);
    await send('Target.closeTarget', { targetId });
    await send('Target.disposeBrowserContext', { browserContextId });
    console.log(`wrote ${join(OUT, file)}`);
  }
  writeFileSync(join(OUT, 'shots.json'), JSON.stringify(shots, null, 2));
  ws.close();
} finally {
  chrome.kill();
  preview?.server.kill();
}

if (errors.length) {
  console.error(`page errors:\n${errors.join('\n')}`);
  process.exit(1);
}

// serves dist/ on a free port, so parallel runs do not collide on 4321
async function startPreview() {
  const port = await new Promise((resolve, reject) => {
    const probe = createServer().once('error', reject).listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
  const url = `http://127.0.0.1:${port}/`;
  const astro = join(ROOT, 'node_modules/astro/bin/astro.mjs');
  const server = spawn(process.execPath, [astro, 'preview', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  for (const deadline = Date.now() + PREVIEW_TIMEOUT_MS; Date.now() < deadline; await sleep(250)) {
    try {
      if ((await fetch(url)).status === 200) return { server, url };
    } catch {
      // not listening yet
    }
  }
  server.kill();
  console.error(`astro preview did not answer 200 on port ${port} within ${PREVIEW_TIMEOUT_MS / 1000}s`);
  process.exit(1);
}

async function connect() {
  const portFile = join(profile, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      // first line the port, second the browser's websocket path
      const [port, path] = readFileSync(portFile, 'utf8').trim().split(/\r?\n/);
      const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
      await new Promise((resolve, reject) => {
        ws.addEventListener('open', resolve, { once: true });
        ws.addEventListener('error', reject, { once: true });
      });
      return ws;
    } catch {
      await sleep(200);
    }
  }
  throw new Error(`chrome devtools did not come up: no usable ${portFile}`);
}
