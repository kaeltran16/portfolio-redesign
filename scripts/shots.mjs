// screenshots of the site through the chrome devtools protocol.
// headless chrome's window cannot go below ~500px wide, so phone sizes need device emulation.
// usage: node scripts/shots.mjs [outDir]   (dev server on http://localhost:4321, or set BASE_URL;
// SHOTS_SERVE=1 serves the last build (dist/) itself on a free port instead, so run `npm run build` first;
// SHOTS=phone-390,role-wipe runs only those; SHOTS_SKIP=cloud-phone-fps leaves those out, and a name that matches
// no scenario is an error). exits 1 on a failed step, and 3 when everything else passed but a gpu step was skipped
// because chrome had no gpu
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
// page-side: content clipped by an ancestor below root, such as a visually hidden step caption, cannot run past;
// the ancestor is checked itself
const clippedKit = `
  const clipped = (el, root) => {
    for (let a = el.parentElement; a && a !== root; a = a.parentElement) if (/hidden|clip/.test(getComputedStyle(a).overflowX)) return true;
    return false;
  };
`;
// returns an error string when the section runs past the viewport or its text drops below 4.5:1 (wcag aa).
// colours go through a 1px canvas so color-mix and translucent text are composited as the browser draws them
const readable = (selector, text) => `(() => {
  ${clippedKit}
  const section = document.querySelector('${selector}');
  const over = [...section.querySelectorAll('*')].find(el => el.getBoundingClientRect().right > innerWidth + 0.5 && !clipped(el, section));
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
  ${clippedKit}
  const projects = document.getElementById('projects');
  const wide = [...projects.querySelectorAll('*')].find(el => el.getBoundingClientRect().right > innerWidth + 0.5 && !clipped(el, projects));
  if (wide) return 'runs past the viewport: ' + wide.tagName + '.' + wide.getAttribute('class');
  // layout sizes, before transforms: a scene's waiting screens are translated beside the phone on purpose
  const spill = [...document.querySelectorAll('.phone img')].find(img => img.offsetWidth > img.parentElement.clientWidth || img.offsetHeight > img.parentElement.clientHeight);
  return spill ? 'screenshot spills out of its phone: ' + spill.alt : '';
})()`;
// returns an error string naming any project link that does not load
const projectLinksLoad = `Promise.all([...document.querySelectorAll('#projects .button')].map(a => fetch(a.href).then(r => r.ok ? '' : a.getAttribute('href') + ' ' + r.status)))
  .then(failed => failed.filter(Boolean).join(', '))`;
const caseText = 'h1, .project-description, .case-facts dt, .case-facts dd, .case-section h2, .prose p, .case-back, .case-next-label, .case-next-title';
const pulsesStill = `[...document.querySelectorAll('.db-live i, .arc-pulse')].some(el => getComputedStyle(el).animationName !== 'none') ? 'a console pulse animates under reduced motion' : ''`;
// joins checks that each return an error string or '', or a promise of one
const allOf = (...checks) => `Promise.all([${checks.join(', ')}]).then(errors => errors.filter(Boolean).join('; '))`;
const noScene = `document.querySelector('.scene, [data-at]') ? 'page renders scene markup' : ''`;
// returns an error string unless the phone header strip is filled or clear as asked. a filled strip must match the
// page background, span the width and reach below kt_ and the toggle, with the page's title scrolled under it
const showTitle = "document.querySelector('.project-title').scrollIntoView()";
const headerBar = filled => `(() => {
  const bar = getComputedStyle(document.querySelector('.rail'), '::before');
  if (bar.content === 'none') return 'no header strip';
  if (Number(bar.opacity) !== ${filled ? 1 : 0}) return 'header strip opacity is ' + bar.opacity + ', expected ${filled ? 1 : 0}';
  if (!${filled}) return '';
  const page = getComputedStyle(document.body).backgroundColor;
  if (bar.backgroundColor !== page) return 'header strip is ' + bar.backgroundColor + ', the page is ' + page;
  if (parseFloat(bar.width) < innerWidth) return 'header strip is ' + bar.width + ' wide, the screen ' + innerWidth + 'px';
  const lowest = Math.max(...['.monogram .mark', '.theme-toggle', '.menu-toggle'].map(s => document.querySelector(s).getBoundingClientRect().bottom));
  if (parseFloat(bar.height) < lowest) return 'header strip ends at ' + bar.height + ', above the header at ' + lowest + 'px';
  const title = document.querySelector('.project-title').getBoundingClientRect();
  return title.top < parseFloat(bar.height) ? '' : 'no title under the header strip, so the overlap is untested';
})()`;
const noHeaderBar = `getComputedStyle(document.querySelector('.rail'), '::before').content === 'none' ? '' : 'header strip drawn on desktop'`;

// --- scroll scenes: the row's data-step picks the step, each element's data-at is the step it lights in
const row = n => `#projects .project:nth-of-type(${n})`;
const ARC = 1;
const SIEM = 2;
const OPAL = 3;
const frames = 'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))';
// scrolls a pinned row to the middle of step k: its top plus (k - 0.5) / steps of its pinned scroll length, or
// `share` of the way there from the top of the page. fonts first, since the driver re-measures rows when they arrive
const toStep = (n, k, share = 1) => `(async () => {
  await document.fonts.ready;
  const row = document.querySelector('${row(n)}');
  const steps = Number(row.querySelector('.scene').dataset.steps);
  const { top, height } = row.getBoundingClientRect();
  window.scrollTo({ top: ${share} * (scrollY + top + (height - innerHeight) * (${k} - 0.5) / steps), behavior: 'instant' });
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
  const opacityOf = el => getComputedStyle(el).opacity;
  const within = (inner, outer) => inner.left >= outer.left - 0.5 && inner.right <= outer.right + 0.5
    && inner.top >= outer.top - 0.5 && inner.bottom <= outer.bottom + 0.5;
`;
// returns an error string unless the row shows step k: only the console's k-th panel lit, its k-th command in the
// box and the k-th caption, with the console inside its box
const showsStep = (n, k) => `(() => {
  ${sceneKit}
  const row = document.querySelector('${row(n)}');
  const errors = [];
  if (row.dataset.step !== '${k}') errors.push('row is at step ' + row.dataset.step);
  for (const el of row.querySelectorAll('.console .p')) {
    const want = at(el) === ${k} ? '1' : '0.4';
    if (opacityOf(el) !== want) errors.push('panel of step ' + at(el) + ' has opacity ' + opacityOf(el) + ', not ' + want);
  }
  for (const part of ['.scene-captions li', '.cmd-line']) {
    const shown = [...row.querySelectorAll(part)].filter(onScreen).map(at);
    if (shown.join() !== '${k}') errors.push(part + ' shows steps [' + shown.join(', ') + '], not only ${k}');
  }
  if (!within(row.querySelector('.console').getBoundingClientRect(), row.querySelector('.project-visual').getBoundingClientRect())) {
    errors.push('console runs out of its box');
  }
  return errors.join('; ');
})()`;
// returns an error string unless the phone shows screen k (0 for a row with no step, which shows the first) with
// every other screen outside it, and, in a step, only name k marked and only caption k shown
const showsScreen = (n, k) => `(() => {
  ${sceneKit}
  const row = document.querySelector('${row(n)}');
  const errors = [];
  if ((row.dataset.step ?? '0') !== '${k}') errors.push('row is at step ' + row.dataset.step);
  // the screen is the phone inside its bezel
  const bezel = row.querySelector('.phone');
  const outer = bezel.getBoundingClientRect();
  const phone = { left: outer.left + bezel.clientLeft, top: outer.top + bezel.clientTop };
  Object.assign(phone, { right: phone.left + bezel.clientWidth, bottom: phone.top + bezel.clientHeight });
  const overlap = r => Math.max(0, Math.min(r.right, phone.right) - Math.max(r.left, phone.left));
  [...row.querySelectorAll('.phone img')].forEach((img, i) => {
    const r = img.getBoundingClientRect();
    if (i + 1 === Math.max(1, ${k}) ? !within(r, phone) : overlap(r) > 0.5) errors.push('screen ' + (i + 1) + ' is ' + (overlap(r) > 0.5 ? 'in' : 'out of') + ' the phone');
  });
  if (${k}) {
    const marked = [...row.querySelectorAll('.phone-names li')].filter(li => getComputedStyle(li).borderBottomColor !== 'rgba(0, 0, 0, 0)').map(at);
    if (marked.join() !== '${k}') errors.push('names marked [' + marked.join(', ') + '], not only ${k}');
    const shown = [...row.querySelectorAll('.scene-captions li')].filter(onScreen).map(at);
    if (shown.join() !== '${k}') errors.push('captions show steps [' + shown.join(', ') + '], not only ${k}');
  } else if ([...row.querySelectorAll('.phone-names')].some(onScreen)) errors.push('screen names show with no step');
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
// returns an error string if the box moves from step to step, as it does when the step captions differ in height.
// the css keys only on data-step, so setting it walks every step without scrolling; the walk replays the step's
// fade-ins, so it waits for them before the screenshot
const steady = n => `(async () => {
  const row = document.querySelector('${row(n)}');
  const box = row.querySelector('.project-visual');
  const was = row.dataset.step;
  const tops = [];
  for (let k = 1; k <= Number(row.querySelector('.scene').dataset.steps); k++) {
    row.dataset.step = k;
    tops.push(Math.round(box.getBoundingClientRect().top));
  }
  row.dataset.step = was;
  const replayed = row.getAnimations({ subtree: true }).filter(a => a.effect.getComputedTiming().endTime !== Infinity);
  await Promise.all(replayed.map(a => a.finished));
  return new Set(tops).size > 1 ? 'box moves between steps, tops ' + tops.join(', ') : '';
})()`;
// --- cloud: [data-cloud]'s data-shape names the track shape nearest the scroll position
const cloudShape = "document.querySelector('[data-cloud]')?.dataset.shape";
// the cloud is lazy, so a scenario that reads it first waits for its first frame
const cloudStarted = `(async () => {
  for (let i = 0; i < 180 && !${cloudShape}; i++) await ${frames};
})()`;
const cloudShows = shape => `(() => {
  const shape = ${cloudShape};
  return shape === '${shape}' ? '' : 'cloud shows ' + shape + ', not ${shape}';
})()`;
// returns an error string unless the point at the element's centre hits the element, so nothing is drawn over it
const hitsText = selector => `(() => {
  const el = document.querySelector('${selector}');
  const r = el.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return el.contains(hit) ? '' : '${selector} centre hits ' + (hit ? hit.tagName + '.' + hit.getAttribute('class') : 'nothing, so it is off screen');
})()`;
// on phones the row's title is below its visual, off screen at a step, so the captions stand in for it: their list,
// since the hidden captions share the shown one's place and are hit as well
const cloudInRow = (n, slug, k, text = '.project-title') => allOf(cloudShows(`${slug}-${k}`), hitsText(`${row(n)} ${text}`));
const CAPTIONS = '.scene-captions';
// share of the screenshot the cloud must change for these scenes to count as showing it
const CLOUD_SEEN = {
  'scene-arc-1': 0.002,
  'scene-arc-1-light': 0.002,
  'scene-arc-2': 0.002,
  'scene-siem-3': 0.001,
  'scene-siem-4': 0.001,
  'scene-siem-5': 0.001,
  'scene-siem-6': 0.001,
  'scene-siem-3-light': 0.002,
  'scene-opal-1': 0.001,
  'scene-opal-2': 0.001,
  'scene-opal-3': 0.001,
  'scene-opal-2-phone-390': 0.002,
};

// the consoles keep their own dark palette in both themes, like a screenshot, so only the captions are checked
const sceneText = '.scene-captions li span';
const sceneScenarios = [
  ...[1, 2, 3, 4].map(k => [ARC, 'arc', k, false]),
  ...[1, 2, 3, 4, 5, 6].map(k => [SIEM, 'siem', k, false]),
  [ARC, 'arc', 1, true],
  [ARC, 'arc', 2, true],
  [SIEM, 'siem', 3, true],
].map(([n, slug, k, light]) => {
  const name = `scene-${slug}-${k}${light ? '-light' : ''}`;
  return {
    name,
    viewport: desktop,
    waitMs: 1000,
    eval: light ? `${toggleTheme}; ${toStep(n, k)}` : toStep(n, k),
    check: allOf(pinned(n), showsStep(n, k), readable(row(n), sceneText), cloudInRow(n, slug, k)),
    cloudVisible: CLOUD_SEEN[name],
    step: `${slug} scene scrolled to step ${k} of ${slug === 'arc' ? 4 : 6}, ${light ? 'light' : 'dark'}: row pinned, only panel ${k} lit and its command in the box, only caption ${k} shown, text at 4.5:1 or more, the cloud on ${slug}-${k} beneath the title${CLOUD_SEEN[name] ? ' and visible' : ''}`,
  };
});
const opalScenarios = [[1, false], [2, false], [3, false], [4, false], [2, true]].map(([k, light]) => {
  const name = `scene-opal-${k}${light ? '-light' : ''}`;
  return {
    name,
    viewport: desktop,
    waitMs: 1000,
    eval: light ? `${toggleTheme}; ${toStep(OPAL, k)}` : toStep(OPAL, k),
    check: allOf(pinned(OPAL), showsScreen(OPAL, k), readable(row(OPAL), `${sceneText}, .phone-names li`), cloudInRow(OPAL, 'opal', k)),
    cloudVisible: CLOUD_SEEN[name],
    step: `opal scene scrolled to step ${k} of 4, ${light ? 'light' : 'dark'}: row pinned, only screen ${k} in the phone, only its name marked and its caption shown, text at 4.5:1 or more, the cloud on opal-${k} beneath the title${CLOUD_SEEN[name] ? ' and visible' : ''}`,
  };
});
const steadyScenarios = [[ARC, 'arc'], [SIEM, 'siem'], [OPAL, 'opal']].map(([n, slug]) => ({
  name: `scene-${slug}-steady`,
  viewport: desktop,
  waitMs: 1000,
  eval: toStep(n, 1),
  // steady is async, which allOf does not await
  check: `(async () => [${pinned(n)}, await ${steady(n)}].filter(Boolean).join('; '))()`,
  step: `${slug} scene pinned: the box holds still across every step, though the step captions differ in height`,
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
// a window shorter than the rows' content at 1280 wide; `unpinned` checks that it still is
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

// --- content: the hero proof line, one-line Experience bullets, About facts, Contact and the share preview.
// each check returns an error string or ''. offsetHeight measures layout, so the entrance transforms do not skew it
const linesKit = `
  const lines = el => Math.round(el.offsetHeight / parseFloat(getComputedStyle(el).lineHeight));
  const linkTo = '.inline-link[href="/projects/siem"]';
`;
const heroProof = maxLines => `(() => {
  ${linesKit}
  const pitch = document.querySelector('.intro-pitch');
  const p = pitch.querySelector('p');
  const button = pitch.querySelector('.button');
  const errors = [];
  if (lines(p) > ${maxLines}) errors.push('proof line is ' + lines(p) + ' lines, over ${maxLines}');
  if (!pitch.querySelector('a' + linkTo)) errors.push('proof line has no link to /projects/siem');
  if (button.getBoundingClientRect().top < p.getBoundingClientRect().bottom - 0.5) errors.push('Download CV is not below the proof line');
  return errors.join('; ');
})()`;
const oneLiners = maxLines => `(() => {
  ${linesKit}
  const errors = [];
  const long = [...document.querySelectorAll('.experience-body li')].find(li => lines(li) > ${maxLines});
  if (long) errors.push('bullet "' + long.textContent.trim() + '" is ' + lines(long) + ' lines, over ${maxLines}');
  const linked = document.querySelectorAll('.experience-role:first-of-type li ' + linkTo).length;
  if (linked !== 3) errors.push('the first role has ' + linked + ' bullets linked to /projects/siem, not 3');
  return errors.join('; ');
})()`;
const ABOUT_FACTS = ['Based in', 'Working on', 'Stack', 'Open to'];
const aboutLayout = stacked => `(() => {
  const errors = [];
  const paragraphs = document.querySelectorAll('#about .prose p').length;
  if (paragraphs !== 2) errors.push('about has ' + paragraphs + ' paragraphs, not 2');
  const labels = [...document.querySelectorAll('#about .about-facts dt')].map(dt => dt.textContent.trim());
  if (labels.join() !== ${JSON.stringify(ABOUT_FACTS.join())}) errors.push('about facts are [' + labels.join(', ') + '], not [${ABOUT_FACTS.join(', ')}]');
  const facts = document.querySelector('#about .about-facts')?.getBoundingClientRect();
  const prose = document.querySelector('#about .prose').getBoundingClientRect();
  if (!facts) return errors.concat('about has no .about-facts list').join('; ');
  if (${stacked}) {
    if (facts.top < prose.bottom - 0.5) errors.push('facts start at ' + Math.round(facts.top) + 'px, above the text end at ' + Math.round(prose.bottom) + 'px, not stacked');
  } else {
    if (facts.left < prose.right - 0.5) errors.push('facts start at ' + Math.round(facts.left) + 'px, left of the text end at ' + Math.round(prose.right) + 'px, not beside it');
    if (facts.top >= prose.bottom || prose.top >= facts.bottom) errors.push('facts and text do not share a row');
  }
  return errors.join('; ');
})()`;
// the contact pitch must not repeat what About already says: not its Open to fact, not one of its paragraphs
const contactTrimmed = `(() => {
  const label = [...document.querySelectorAll('#about dt')].find(dt => dt.textContent.trim() === 'Open to');
  const fact = label?.nextElementSibling?.textContent.trim().toLowerCase();
  if (!fact) return 'about has no Open to fact, so the contact pitch cannot be compared';
  const pitch = document.querySelector('.contact-pitch').textContent.trim().toLowerCase();
  const errors = [];
  if (pitch.includes(fact)) errors.push('contact pitch repeats the Open to fact');
  if ([...document.querySelectorAll('#about .prose p')].some(p => p.textContent.trim().toLowerCase() === pitch)) errors.push('contact pitch equals an about paragraph');
  return errors.join('; ');
})()`;
const shareTags = `(() => {
  const meta = selector => document.querySelector(selector)?.content;
  const errors = [];
  if (meta('meta[property="og:title"]') !== document.title) errors.push('og:title is ' + meta('meta[property="og:title"]') + ', not the page title ' + document.title);
  if (meta('meta[property="og:description"]') !== meta('meta[name="description"]')) errors.push('og:description is not the page description');
  if (meta('meta[name="twitter:card"]') !== 'summary_large_image') errors.push('twitter:card is ' + meta('meta[name="twitter:card"]') + ', not summary_large_image');
  const absolute = value => /^https?:\\/\\//.test(value ?? '') ? new URL(value) : undefined;
  const image = meta('meta[property="og:image"]');
  if (!image) errors.push('og:image missing; build with --site or set site in astro.config.mjs');
  else if (absolute(image)?.pathname !== '/og.png') errors.push('og:image is ' + image + ', not an absolute URL ending /og.png');
  const url = meta('meta[property="og:url"]');
  const trim = path => path.replace(/\\/+$/, '');
  if (!url) errors.push('og:url missing; build with --site or set site in astro.config.mjs');
  else if (!absolute(url) || trim(absolute(url).pathname) !== trim(location.pathname)) errors.push('og:url is ' + url + ', not an absolute URL for ' + location.pathname);
  return errors.join('; ');
})()`;
const shareImage = `(async () => {
  const img = new Image();
  img.src = new URL('/og.png', location.origin).href;
  try {
    await img.decode();
  } catch {
    return '/og.png does not load';
  }
  return img.naturalWidth === 1200 && img.naturalHeight === 630 ? '' : '/og.png is ' + img.naturalWidth + 'x' + img.naturalHeight + ', not 1200x630';
})()`;
const introPitchShown = `(() => {
  const opacity = getComputedStyle(document.querySelector('.intro-pitch')).opacity;
  return opacity === '1' ? '' : 'proof line opacity is ' + opacity + ', not 1';
})()`;

// --- nav: each check returns an error string or ''
const NAV_IDS = ['projects', 'experience', 'about', 'contact'];
const navKit = `
  const errors = [];
  const marked = selector => [...document.querySelectorAll(selector + '[aria-current]')].map(a => a.hash).join() || 'nothing';
  const expectMarked = (where, want) => ['.rail-link', '.menu-link'].forEach(selector => {
    if (marked(selector) !== want) errors.push(where + ': ' + selector + ' marks ' + marked(selector) + ', expected ' + want);
  });
  // the heading a jump lands on; projects has no visible one, so its first row's title
  const headingOf = id => document.querySelector('#' + id + ' .section-title') ?? document.querySelector('#' + id + ' .project:first-of-type .project-title');
`;
const navCurrent = `(async () => {
  ${navKit}
  window.scrollTo({ top: 0, behavior: 'instant' });
  await ${frames};
  expectMarked('top of the page', 'nothing');
  for (const id of ${JSON.stringify(NAV_IDS.slice(0, -1))}) {
    document.getElementById(id).scrollIntoView({ behavior: 'instant' });
    await ${frames};
    expectMarked('#' + id + ' in view', '#' + id);
  }
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
  await ${frames};
  expectMarked('end of the page', '#contact');
  return errors.join('; ');
})()`;
// clicks each link, through the menu when asked, and checks the jump: hash and :target set, no history stop added,
// the heading on screen and below the header, its cue wiping in
const navJumps = viaMenu => `(async () => {
  ${navKit}
  const start = history.length;
  const menu = document.querySelector('.menu');
  const headerBottom = parseFloat(getComputedStyle(document.querySelector('.rail'), '::before').height) || 0;
  for (const id of ${JSON.stringify(NAV_IDS)}) {
    if (${viaMenu}) {
      document.querySelector('.menu-toggle').click();
      if (!menu.matches(':popover-open')) errors.push('menu does not open from its button');
    }
    document.querySelector('${viaMenu ? '.menu-link' : '.rail-link'}[href$="#' + id + '"]').click();
    await ${frames};
    if (menu.matches(':popover-open')) errors.push('menu stays open after its ' + id + ' link');
    if (location.hash !== '#' + id || !document.getElementById(id).matches(':target')) errors.push(id + ' is not the target after its link: hash ' + location.hash);
    const heading = headingOf(id).getBoundingClientRect();
    const top = ${viaMenu} ? headerBottom : 0;
    if (heading.top < top || heading.bottom > innerHeight) errors.push(id + ' heading lands at ' + Math.round(heading.top) + 'px, outside ' + Math.round(top) + '-' + innerHeight + 'px');
    const cue = getComputedStyle(headingOf(id), '::after').animationName;
    if (cue !== 'reveal') errors.push(id + ' heading cue is ' + cue);
  }
  if (history.length !== start) errors.push('nav clicks added ' + (history.length - start) + ' history entries');
  // the screenshot follows the check, so let the strip and scroll cue finish their fades
  await new Promise(r => setTimeout(r, 1000));
  return errors.join('; ');
})()`;
const openMenu = "document.querySelector('.menu-toggle').click()";
const menuOpen = `(() => {
  const menu = document.querySelector('.menu');
  if (!menu.matches(':popover-open')) return 'menu is not open';
  const top = menu.getBoundingClientRect().top;
  const strip = parseFloat(getComputedStyle(document.querySelector('.rail'), '::before').height);
  if (Math.abs(top - strip) > 0.5) return 'menu starts at ' + top + 'px, not under the header strip at ' + strip + 'px';
  const off = [...menu.querySelectorAll('a')].find(a => a.getBoundingClientRect().bottom > innerHeight || a.getBoundingClientRect().right > innerWidth);
  return off ? 'menu link off screen: ' + (off.textContent.trim() || off.getAttribute('aria-label')) : '';
})()`;
const menuShown = shown => `(() => {
  const toggle = getComputedStyle(document.querySelector('.menu-toggle')).display !== 'none';
  const rail = getComputedStyle(document.querySelector('.rail-nav')).display !== 'none';
  if (toggle !== ${shown}) return 'menu button ${shown ? 'hidden' : 'shown'} at ' + innerWidth + 'x' + innerHeight;
  if (rail === ${shown}) return 'rail links ${shown ? 'shown' : 'hidden'} at ' + innerWidth + 'x' + innerHeight;
  return '';
})()`;
const skipLink = `(() => {
  const skip = document.querySelector('.skip-link');
  if (document.querySelector('a[href], button') !== skip) return 'skip link is not the first stop';
  if (skip.getBoundingClientRect().bottom > 0) return 'skip link shows before it has focus';
  skip.focus();
  const r = skip.getBoundingClientRect();
  if (r.top < 0 || r.bottom > innerHeight) return 'focused skip link is off screen at ' + Math.round(r.top) + 'px';
  return document.getElementById(new URL(skip.href).hash.slice(1))?.tagName === 'MAIN' ? '' : 'skip link does not target main';
})()`;
// on a case page the links go to Home: the click is left to the browser and no link is current
const caseNavPlain = `(() => {
  let prevented;
  window.addEventListener('click', e => { prevented = e.defaultPrevented; e.preventDefault(); }, { once: true });
  document.querySelector('.rail-link').click();
  if (prevented !== false) return 'case page rail link click was taken over';
  return document.querySelector('[aria-current]') ? 'a link is current on a case page' : '';
})()`;

// --- motion: smooth scroll, split headings, experience entrances
const HEADINGS = '.project-title, .section-title';
const ROLE_ITEMS = '.experience-dates, .experience-body h3, .experience-company, .experience-body li';
const motionKit = `
  const atRest = el => { const t = getComputedStyle(el).transform; return t === 'none' || new DOMMatrix(t).isIdentity; };
`;
// returns an error string unless every heading is split, opal's letters wait below their line, and each heading's
// accessible text is its text as served
const headingsWaiting = `(async () => {
  ${motionKit}
  const served = new DOMParser().parseFromString(await (await fetch(location.href)).text(), 'text/html');
  const headings = [...document.querySelectorAll('${HEADINGS}')];
  const errors = [];
  if (headings.length !== served.querySelectorAll('${HEADINGS}').length) errors.push('found ' + headings.length + ' headings, the page serves ' + served.querySelectorAll('${HEADINGS}').length);
  for (const h of headings) {
    if (!h.querySelector('.split-char')) errors.push('#' + h.id + ' is not split');
    const want = served.getElementById(h.id).textContent.trim();
    const name = h.getAttribute('aria-label') ?? h.textContent.trim();
    if (name !== want) errors.push('#' + h.id + ' reads "' + name + '", not "' + want + '"');
  }
  const opal = [...document.querySelectorAll('#project-opal .split-char')];
  if (!opal.length || opal.some(atRest)) errors.push('opal title letters are at rest before it is in view');
  return errors.join('; ');
})()`;
// scrolls to Experience once the entrances are set up, and records the first role's title offset every frame for 1s
const watchEntrance = `(async () => {
  for (let i = 0; i < 180 && !document.querySelector('.split-char'); i++) await ${frames};
  const title = document.querySelector('.experience-role h3');
  ${showExperience};
  window.lowest = Infinity;
  for (const end = performance.now() + 1000; performance.now() < end; await new Promise(r => requestAnimationFrame(r))) {
    window.lowest = Math.min(window.lowest, new DOMMatrix(getComputedStyle(title).transform).m42);
  }
})()`;

// --- the cloud's canvas, track and cost
// returns an error string unless there is one cloud canvas, fixed over the whole viewport and taking no pointer
// events, and the sphere's own canvas is gone
const cloudCanvas = `(() => {
  const clouds = document.querySelectorAll('[data-cloud]');
  if (clouds.length !== 1) return 'found ' + clouds.length + ' cloud canvases, not 1';
  const style = getComputedStyle(clouds[0]);
  const r = clouds[0].getBoundingClientRect();
  const errors = [];
  if (style.position !== 'fixed') errors.push('cloud is ' + style.position + ', not fixed');
  if (style.pointerEvents !== 'none') errors.push('cloud takes pointer events');
  if (r.left || r.top || r.width !== innerWidth || r.height !== innerHeight) {
    errors.push('cloud is ' + r.width + 'x' + r.height + ' at ' + r.left + ',' + r.top + ', not the ' + innerWidth + 'x' + innerHeight + ' viewport');
  }
  if (document.querySelector('[data-sphere]')) errors.push('the old sphere canvas is still there');
  return errors.join('; ');
})()`;
// scrolls from the top to past Experience a twelfth of the viewport at a time; returns an error string unless the
// shapes the cloud names, repeats dropped, are the whole track in order
const cloudSweep = `(async () => {
  await document.fonts.ready;
  await ${cloudStarted};
  const rows = [...document.querySelectorAll('#projects .project')].filter(r => r.querySelector('.scene'));
  const steps = r => Array.from({ length: Number(r.querySelector('.scene').dataset.steps) }, (_, k) => r.dataset.slug + '-' + (k + 1));
  const want = ['sphere', ...rows.flatMap(steps), 'settle'];
  const seen = [];
  const end = scrollY + document.getElementById('experience').getBoundingClientRect().bottom;
  for (let y = 0; y <= end; y += innerHeight / 12) {
    window.scrollTo({ top: y, behavior: 'instant' });
    await ${frames};
    const shape = ${cloudShape};
    if (seen.at(-1) !== shape) seen.push(shape);
  }
  return seen.join() === want.join() ? '' : 'cloud passed [' + seen.join(', ') + '], not [' + want.join(', ') + ']';
})()`;
// injected before load: canvases give no webgl context, and warnings are kept for the check
const noWebgl = `(() => {
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    return /^webgl2?$/.test(type) ? null : getContext.call(this, type, ...rest);
  };
  window.warnings = [];
  const warn = console.warn;
  console.warn = (...args) => (window.warnings.push(String(args[0])), warn(...args));
})()`;
const FPS_SWEEP_MS = 2500;
const MIN_FPS = 50;
// the name of what draws the page's webgl, so a gpu scenario can tell a gpu from swiftshader
const webglRenderer = `(() => {
  const gl = document.createElement('canvas').getContext('webgl');
  const info = gl?.getExtension('WEBGL_debug_renderer_info');
  return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'no webgl';
})()`;
// summed rgb difference over which a pixel counts as changed, above png and antialiasing noise
const PIXEL_CHANGED = 24;
// returns an error string unless at least `share` of the pixels differ between two base64 pngs, decoded in the page
const cloudChanges = (shown, bare, share) => `(async () => {
  const pixels = async src => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const ctx = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height }).getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, img.width, img.height).data;
  };
  const [a, b] = await Promise.all([${JSON.stringify(`data:image/png;base64,${shown}`)}, ${JSON.stringify(`data:image/png;base64,${bare}`)}].map(pixels));
  let changed = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > ${PIXEL_CHANGED}) changed++;
  }
  const got = changed / (a.length / 4);
  return got >= ${share} ? '' : 'the cloud changes ' + (got * 100).toFixed(2) + '% of the pixels, under ${share * 100}%';
})()`;

const SCENARIOS = [
  { name: 'desktop', viewport: desktop, waitMs: 7000, check: titleFits },
  // role words change every 5s; 6.2s lands inside the wipe of the second word
  { name: 'role-wipe', viewport: desktop, waitMs: 6200 },
  { name: 'light', viewport: desktop, waitMs: 6000, eval: toggleTheme },
  { name: 'phone-390', viewport: phone, waitMs: 6000, check: titleFits },
  { name: 'reduced-motion', viewport: desktop, waitMs: 1500, reduced: true, check: pulsesStill },
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
  { name: 'header-phone-top', viewport: phone, waitMs: 1000, check: headerBar(false), step: 'top of the page on a 390px phone: header strip clear, the intro whole' },
  ...[
    ['header-phone-scrolled', '', false],
    ['header-phone-scrolled-light', '', true],
    ['header-case-phone-scrolled', 'projects/arc', false],
  ].map(([name, page, light]) => ({
    name,
    viewport: phone,
    page,
    waitMs: 1000,
    eval: light ? `${toggleTheme}; ${showTitle}` : showTitle,
    check: headerBar(true),
    step: `${page || 'home'} scrolled on a 390px phone, ${light ? 'light' : 'dark'}: a title under the header, covered by a full-width strip in the page background below kt_ and the toggle`,
  })),
  { name: 'header-desktop-scrolled', viewport: desktop, waitMs: 500, eval: showTitle, check: noHeaderBar, step: 'scrolled at 1440px: no header strip' },
  { name: 'nav-current', viewport: desktop, waitMs: 1000, check: navCurrent, step: 'scrolling to each section marks only its rail and menu link current, none at the top, contact at the end' },
  { name: 'nav-current-tall', viewport: { ...desktop, height: 1300 }, waitMs: 1000, check: navCurrent, step: 'at 1440x1300: scrolling to each section marks only its rail and menu link current, none at the top, contact at the end' },
  { name: 'nav-jumps', viewport: desktop, waitMs: 1000, check: navJumps(false), step: 'each rail link jumps to its section: target set, heading on screen with its cue, no history entries added' },
  {
    name: 'nav-cue-reduced-motion',
    viewport: desktop,
    page: '#about',
    waitMs: 500,
    reduced: true,
    check: `getComputedStyle(document.querySelector('#about .section-title'), '::after').animationName === 'none' ? '' : 'arrival cue animates under reduced motion'`,
    step: 'opened at /#about under reduced motion: no arrival cue',
  },
  { name: 'nav-case-page', viewport: desktop, page: 'projects/arc', waitMs: 500, check: caseNavPlain, step: 'case page: rail links are plain links to Home, none current' },
  { name: 'skip-link', viewport: desktop, waitMs: 500, check: skipLink, step: 'skip link is the first stop, hidden until focused, on screen when focused, targets main' },
  { name: 'menu-desktop', viewport: desktop, waitMs: 500, check: menuShown(false), step: 'at 1440x900: rail links shown, no menu button' },
  { name: 'menu-short-window', viewport: { ...desktop, height: 650 }, waitMs: 500, check: menuShown(true), step: 'at 1440x650: rail links hidden, menu button shown' },
  {
    name: 'menu-phone-jumps',
    viewport: phone,
    waitMs: 1000,
    check: allOf(menuShown(true), navJumps(true)),
    step: 'each menu link on a 390px phone opens from the button, closes on the tap and jumps: heading below the header strip, no history entries added',
  },
  ...[
    ['menu-phone-open', false],
    ['menu-phone-open-light', true],
  ].map(([name, light]) => ({
    name,
    viewport: phone,
    waitMs: 800,
    eval: light ? `${toggleTheme}; ${showTitle}; ${openMenu}` : `${showTitle}; ${openMenu}`,
    check: allOf(menuOpen, readable('.menu', '.menu-link')),
    step: `menu open on a 390px phone, ${light ? 'light' : 'dark'}: under the header strip, every link on screen, text at 4.5:1 or more`,
  })),
  ...sceneScenarios,
  ...opalScenarios,
  ...steadyScenarios,
  {
    name: 'scene-opal-2-phone-390',
    viewport: phone,
    waitMs: 1000,
    eval: toRevealStep(OPAL, 2),
    check: allOf(
      `document.querySelector('${row(OPAL)}').hasAttribute('data-pinned') ? 'opal row is pinned' : ''`,
      showsScreen(OPAL, 2),
      readable(row(OPAL), `${sceneText}, .phone-names li`),
      cloudInRow(OPAL, 'opal', 2, CAPTIONS),
    ),
    cloudVisible: CLOUD_SEEN['scene-opal-2-phone-390'],
    step: 'opal scene scrolled to step 2 on a 390px phone: not pinned, only the Areas screen in the phone, its name marked and its caption shown, within the width, the cloud on opal-2 beneath the caption and visible',
  },
  {
    name: 'scene-siem-2-phone-390',
    viewport: phone,
    waitMs: 1000,
    eval: toRevealStep(SIEM, 2),
    check: allOf(cloudInRow(SIEM, 'siem', 2, CAPTIONS), `(() => {
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
    })()`),
    cloudVisible: 0.001,
    step: 'siem scene scrolled to step 2 on a 390px phone: not pinned, only the risk panel shows, the console inside its box and the width, above the caption and the row text, the cloud on siem-2 beneath the caption and visible',
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
      const shape = ${cloudShape};
      if (shape !== 'settle') errors.push('cloud shows ' + shape + ', not settle');
      return errors.join('; ');
    })()`,
    step: 'opened at /#experience: the arc and siem rows above show their last step, the heading is in view, the timeline drawn to the reading line, the cloud already settled',
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
    check: allOf(pulsesStill, `(() => {
      ${sceneKit}
      const projects = document.getElementById('projects');
      const errors = [];
      if (projects.querySelector('[data-step]')) errors.push('a row has a step under reduced motion');
      if (projects.querySelector('[data-pinned]')) errors.push('a row is pinned under reduced motion');
      if (document.querySelector('[data-drawing]')) errors.push('the timeline draws under reduced motion');
      const hidden = [...projects.querySelectorAll('.scene-captions li')].filter(el => !onScreen(el));
      if (hidden.length) errors.push(hidden.length + ' step captions are not listed');
      const unlit = [...projects.querySelectorAll('.console .p')].filter(el => !onScreen(el) || opacityOf(el) !== '1');
      if (unlit.length) errors.push(unlit.length + ' console panels are not shown fully lit');
      if ([...projects.querySelectorAll('.cmd')].some(onScreen)) errors.push('a command box shows');
      return errors.join('; ');
    })()`, showsScreen(OPAL, 0)),
    clip: '#projects',
    step: 'scenes under reduced motion: no steps, every console panel lit, pulses still, every caption listed, no command box, the phone on its first screen with no names',
  },
  ...[
    {
      id: 'experience',
      text: 'h2, h3, .experience-dates, .experience-company, .experience-body li, .inline-link',
      check: ({ width }) => oneLiners(width >= 1440 ? 1 : 2),
      claims: ({ width }) => `${width >= 1440 ? 'every bullet one line' : 'every bullet at most two lines'}, the three AI bullets link to the SIEM page`,
    },
    {
      id: 'about',
      text: 'h2, .prose p, .about-facts dt, .about-facts dd',
      check: ({ width }) => aboutLayout(width <= 1040),
      claims: ({ width }) => `two paragraphs, the four facts ${width <= 1040 ? 'stacked under' : 'beside'} the text`,
    },
    {
      id: 'contact',
      text: 'h2, .contact-pitch, .contact-links a, .contact-meta',
      check: () => contactTrimmed,
      claims: () => 'the pitch repeats nothing from About',
    },
  ].flatMap(({ id, text, check, claims }) => [
    [id, desktop, false],
    [`${id}-light`, desktop, true],
    [`${id}-phone-390`, phone, false],
    [`${id}-phone-390-light`, phone, true],
  ].map(([name, viewport, light]) => ({
    name,
    viewport,
    waitMs: 1500,
    eval: light ? `${toggleTheme}; ${show(id)}` : show(id),
    check: allOf(readable(`#${id}`, text), check(viewport)),
    clip: `#${id}`,
    step: `${id} section at ${viewport.width}px, ${light ? 'light' : 'dark'}: fits the width, text at 4.5:1 or more, ${claims(viewport)}`,
  }))),
  ...[
    ['hero-proof', desktop, false],
    ['hero-proof-light', desktop, true],
    ['hero-proof-phone-390', phone, false],
    ['hero-proof-phone-390-light', phone, true],
  ].map(([name, viewport, light]) => ({
    name,
    viewport,
    waitMs: 6000,
    eval: light ? toggleTheme : undefined,
    check: allOf(heroProof(viewport.width >= 1440 ? 2 : Infinity), readable('.intro-pitch', 'p, .inline-link')),
    step: `hero proof line at ${viewport.width}px, ${light ? 'light' : 'dark'}: at most two lines (1440 only), SIEM linked to /projects/siem, Download CV below it, text at 4.5:1 or more`,
  })),
  // :hover in the selector also fails the check when the mouse missed the link
  ...[
    ['hero-proof-hover', false],
    ['hero-proof-hover-light', true],
  ].map(([name, light]) => ({
    name,
    viewport: desktop,
    waitMs: 6000,
    eval: light ? toggleTheme : undefined,
    hover: '.intro-pitch .inline-link',
    check: readable('.intro-pitch', '.inline-link:hover'),
    step: `hero SIEM link hovered at 1440px, ${light ? 'light' : 'dark'}: its text stays at 4.5:1 or more`,
  })),
  ...[
    ['share-tags', ''],
    ['share-tags-case', 'projects/siem'],
  ].map(([name, page]) => ({
    name,
    viewport: desktop,
    page,
    waitMs: 300,
    check: shareTags,
    step: `${page || 'home'} head: og:title is the page title, og:description its description, twitter:card summary_large_image, og:image an absolute /og.png URL, og:url absolute for this page`,
  })),
  { name: 'share-image', viewport: desktop, waitMs: 300, check: shareImage, step: 'the served /og.png is a 1200x630 image' },
  {
    name: 'og',
    viewport: { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false },
    waitMs: 7000,
    check: allOf(titleFits, cloudShows('sphere'), introPitchShown),
    step: 'Home first screen at 1200x630 for the share image: title fits, sphere drawn, proof line shown',
  },
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
  {
    name: 'smooth-wheel',
    viewport: desktop,
    waitMs: 1500,
    wheel: { deltaY: 800 },
    after: `${frames}.then(() => (window.glided = scrollY))`,
    check: `(() => {
      if (!document.documentElement.classList.contains('lenis')) return 'html has no lenis class';
      if (!(window.glided > 0 && window.glided < 800)) return 'two frames after the wheel the page was at ' + window.glided + ', not part way to 800';
      return Math.abs(scrollY - 800) <= 2 ? '' : 'the glide settled at ' + scrollY + ', not 800';
    })()`,
    step: 'a real 800px wheel at 1440px: the page glides, part way two frames in, at 800 once settled',
  },
  {
    name: 'smooth-nav-jump',
    viewport: desktop,
    waitMs: 1500,
    wheel: { deltaY: 3000 },
    after: `document.querySelector('.rail-link[href$="#about"]').click()`,
    check: `(() => {
      if (location.hash !== '#about') return 'hash is ' + location.hash + ', not #about';
      const r = document.querySelector('#about .section-title').getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight ? '' : 'about heading at ' + Math.round(r.top) + 'px, outside the viewport';
    })()`,
    step: 'the about rail link clicked during a 3000px wheel glide: the page lands on about and stays',
  },
  {
    name: 'smooth-menu-wheel',
    // the menu's 292px of content overflows only below ~391px tall at this width
    viewport: { ...desktop, height: 360 },
    waitMs: 800,
    eval: `${openMenu}; window.startY = scrollY`,
    wheel: { at: '.menu', deltaY: 300 },
    check: `(() => {
      const menu = document.querySelector('.menu');
      if (menu.scrollHeight <= menu.clientHeight) return 'menu content (' + menu.scrollHeight + 'px) fits its ' + menu.clientHeight + 'px at ' + innerWidth + 'x' + innerHeight + ', so a wheel over it is untested';
      if (!menu.matches(':popover-open')) return 'menu is not open';
      if (menu.scrollTop <= 0) return 'menu did not scroll under the wheel';
      return scrollY === window.startY ? '' : 'the page moved from ' + window.startY + ' to ' + scrollY + ' under the menu';
    })()`,
    step: 'a 300px wheel over the open menu at 1440x360, where it overflows: the menu scrolls, the page stays',
  },
  {
    name: 'headings-waiting',
    viewport: desktop,
    waitMs: 1500,
    check: headingsWaiting,
    step: 'top of the page at 1440px: every project and section heading split into letters, opal’s waiting below its line, each heading read by its own text',
  },
  {
    name: 'headings-revealed',
    viewport: desktop,
    waitMs: 1500,
    eval: show('about'),
    check: `(() => {
      ${motionKit}
      const chars = [...document.querySelectorAll('#about .section-title .split-char')];
      if (!chars.length) return 'about title is not split';
      const moving = chars.filter(c => !atRest(c));
      return moving.length ? moving.length + ' about title letters are not at rest' : '';
    })()`,
    step: 'about scrolled into view: its title letters have risen to rest',
  },
  {
    name: 'experience-enter',
    viewport: desktop,
    waitMs: 1000,
    eval: watchEntrance,
    check: `(() => {
      ${motionKit}
      const errors = [];
      if (!(window.lowest < -0.5)) errors.push('first role title went no higher than ' + window.lowest + 'px, so it did not overshoot');
      const entered = [...document.querySelectorAll('.experience-role')].filter(role => role.getBoundingClientRect().top < innerHeight);
      const items = entered.flatMap(role => [...role.querySelectorAll('${ROLE_ITEMS}')]);
      if (!items.length) errors.push('no role entered the viewport');
      const unsettled = items.filter(el => !atRest(el) || getComputedStyle(el).opacity !== '1');
      if (unsettled.length) errors.push(unsettled.length + ' entered role items are not at rest and opaque');
      return errors.join('; ');
    })()`,
    clip: '#experience',
    step: 'experience scrolled into view: the first role springs in past its rest and settles within a second, every item opaque',
  },
  {
    name: 'motion-reduced',
    viewport: desktop,
    waitMs: 1000,
    reduced: true,
    eval: showExperience,
    check: `(() => {
      const errors = [];
      if (document.documentElement.classList.contains('lenis')) errors.push('smooth scroll is on');
      if (document.querySelector('.split-char')) errors.push('a heading is split');
      const styled = [...document.querySelectorAll('${ROLE_ITEMS}')].filter(el => el.style.transform || el.style.opacity);
      if (styled.length) errors.push(styled.length + ' experience items carry an inline transform or opacity');
      return errors.join('; ');
    })()`,
    step: 'experience under reduced motion: no smooth scroll, no split headings, no entrance styles',
  },
  ...[
    ['cloud-hero', desktop, false],
    ['cloud-hero-phone-390', phone, false],
    ['cloud-hero-light', desktop, true],
  ].map(([name, viewport, light]) => ({
    name,
    viewport,
    // the canvas fades in over 3s
    waitMs: 3500,
    eval: light ? toggleTheme : undefined,
    check: allOf(cloudCanvas, cloudShows('sphere'), hitsText('[data-intro-name]')),
    cloudVisible: 0.02,
    step: `top of the page at ${viewport.width}px, ${light ? 'light' : 'dark'}: one fixed, viewport-sized cloud canvas that takes no pointer events, showing the sphere and visible, no old sphere canvas, the intro name uncovered`,
  })),
  {
    name: 'cloud-dissolve',
    viewport: desktop,
    waitMs: 2500,
    eval: toStep(ARC, 1, 0.4),
    check: cloudShows('sphere'),
    cloudVisible: 0.005,
    step: 'scrolled 40% of the way to the first arc step at 1440px: the cloud still names the sphere, which breaks into dots',
  },
  ...[
    ['cloud-sweep', desktop],
    ['cloud-sweep-phone-390', phone],
  ].map(([name, viewport]) => ({
    name,
    viewport,
    waitMs: 500,
    check: cloudSweep,
    step: `scrolling from the top to past Experience at ${viewport.width}px, a twelfth of the viewport at a time: the cloud passes every track shape in order and never goes back`,
  })),
  { name: 'cloud-settle', viewport: desktop, waitMs: 1000, eval: showExperience, check: cloudShows('settle'), step: 'experience scrolled into view: the cloud settles' },
  {
    name: 'cloud-resize',
    viewport: desktop,
    eval: `${toStep(ARC, 2)}.then(() => (window.wasPinned = document.querySelector('${row(ARC)}').hasAttribute('data-pinned')))`,
    resize: shortWindow,
    waitMs: 1000,
    // the shorter page leaves the scroll position past the arc row, so the check scrolls back to its step 2, which
    // the cloud's old pinned anchors would place elsewhere
    check: `(async () => {
      const row = document.querySelector('${row(ARC)}');
      if (!window.wasPinned) return 'arc row was not pinned before the resize';
      if (row.hasAttribute('data-pinned')) return 'arc row is still pinned at ' + innerWidth + 'x' + innerHeight;
      await ${toRevealStep(ARC, 2)};
      const shape = ${cloudShape};
      if (row.dataset.step !== '2') return 'arc row is at step ' + row.dataset.step + ', not 2';
      return shape === 'arc-' + row.dataset.step ? '' : 'cloud shows ' + shape + ' with the arc row at step ' + row.dataset.step;
    })()`,
    step: 'arc row pinned at step 2, then the window made 1280x480 so it unpins, then scrolled back to its step 2: the cloud re-anchored and shows arc-2',
  },
  {
    name: 'cloud-reduced-motion',
    viewport: desktop,
    waitMs: 1000,
    reduced: true,
    eval: `(async () => {
      await ${cloudStarted};
      window.framesAsked = 0;
      const ask = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = callback => (window.framesAsked++, ask(callback));
      document.querySelector('${row(SIEM)} .project-visual').scrollIntoView({ block: 'center', behavior: 'instant' });
    })()`,
    check: `(() => {
      const shape = ${cloudShape};
      if (window.framesAsked) return window.framesAsked + ' animation frames requested under reduced motion';
      return shape?.startsWith('siem-') ? '' : 'cloud shows ' + shape + ' with the siem row in view';
    })()`,
    step: 'siem row scrolled into view under reduced motion: the cloud redraws on scroll with a siem shape, and nothing requests an animation frame for a second',
  },
  {
    name: 'cloud-opal-reduced-motion',
    viewport: desktop,
    waitMs: 1000,
    reduced: true,
    eval: `(async () => {
      await ${cloudStarted};
      document.querySelector('${row(OPAL)} .project-visual').scrollIntoView({ block: 'center', behavior: 'instant' });
    })()`,
    // cloudShows matches whole names only, and a still page may rest on any opal step
    check: `(() => { const shape = ${cloudShape}; return shape?.startsWith('opal-') ? '' : 'cloud shows ' + shape + ' with the opal row in view'; })()`,
    clip: row(OPAL),
    step: 'opal row under reduced motion: the cloud draws a still opal frame with no patch beside the phone',
  },
  {
    name: 'cloud-no-webgl',
    viewport: desktop,
    waitMs: 1000,
    init: noWebgl,
    eval: toStep(ARC, 2),
    check: allOf(
      `document.querySelector('[data-shape]') ? 'the cloud drew with no webgl' : ''`,
      `window.warnings.some(w => w.startsWith('cloud failed to start')) ? '' : 'no warning that the cloud failed to start'`,
      showsStep(ARC, 2),
      `document.querySelector('.split-char') ? '' : 'headings are not split'`,
    ),
    step: 'no webgl: no cloud and a warning, no error; the arc row still steps when scrolled and the headings still split',
  },
  {
    name: 'cloud-phone-fps',
    viewport: phone,
    gpu: true,
    throttle: 4,
    waitMs: 0,
    eval: `(async () => {
      await ${cloudStarted};
      const { top, bottom } = document.getElementById('projects').getBoundingClientRect();
      const from = scrollY + top;
      const begin = performance.now();
      let count = 0;
      for (let now = begin; now - begin < ${FPS_SWEEP_MS}; now = await new Promise(r => requestAnimationFrame(r))) {
        window.scrollTo({ top: from + (bottom - top) * (now - begin) / ${FPS_SWEEP_MS}, behavior: 'instant' });
        count++;
      }
      window.fps = count / ((performance.now() - begin) / 1000);
    })()`,
    check: `window.fps >= ${MIN_FPS} ? '' : 'scrolling the projects ran at ' + window.fps.toFixed(1) + ' fps, under ${MIN_FPS}'`,
    step: `projects scrolled one step per frame over ${FPS_SWEEP_MS / 1000}s on a 390px phone, cpu slowed 4x, on a gpu: ${MIN_FPS} fps or more`,
  },
];
// the viewport point at the centre of a selector, or of the viewport with none
const centreOf = selector => `(() => {
  const r = ${selector ? `document.querySelector('${selector}').getBoundingClientRect()` : '{ left: 0, top: 0, width: innerWidth, height: innerHeight }'};
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`;
// the page-space rect of a selector, for a screenshot of a section taller than the viewport
const clipOf = selector => `(() => {
  const r = document.querySelector('${selector}').getBoundingClientRect();
  return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height, scale: 1 };
})()`;

const only = process.env.SHOTS?.split(',');
const skipped = process.env.SHOTS_SKIP?.split(',').filter(Boolean) ?? [];
const unknownSkips = skipped.filter(name => !SCENARIOS.some(s => s.name === name));
if (unknownSkips.length) {
  console.error(`SHOTS_SKIP names no scenario: ${unknownSkips.join(', ')}`);
  process.exit(1);
}
const selected = SCENARIOS.filter(s => (!only || only.includes(s.name)) && !skipped.includes(s.name));

if (!CHROME) {
  console.log('no chrome found; set CHROME to its path');
  process.exit(3);
}
mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const preview = process.env.SHOTS_SERVE === '1' ? await startPreview() : undefined;
const BASE_URL = preview?.url ?? process.env.BASE_URL ?? 'http://localhost:4321/';

// the software renderer keeps screenshots alike on any machine; `gpu` scenarios run in a second chrome without it
const SOFTWARE_GL = ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'];
const browsers = [];
const errors = [];
// gpu steps that could not run because that chrome still drew in software
const unverified = [];

try {
  const software = await launch(SOFTWARE_GL);
  let gpu;
  const shots = [];
  for (const s of selected) {
    shots.push(await run(s.gpu ? (gpu ??= await launch([])) : software, s));
  }
  writeFileSync(join(OUT, 'shots.json'), JSON.stringify(shots, null, 2));
} finally {
  for (const { ws, chrome } of browsers) {
    ws?.close();
    chrome.kill();
  }
  preview?.server.kill();
}

if (errors.length) {
  console.error(`page errors:\n${errors.join('\n')}`);
  process.exit(1);
}
if (unverified.length) {
  console.log(`unverified, no gpu: ${unverified.join('; ')}`);
  process.exit(3);
}

// a headless chrome on a free devtools port, with `send` for its protocol and `listeners` for its events
async function launch(flags) {
  // port 0 lets chrome pick a free devtools port, which it writes to DevToolsActivePort in the profile
  const profile = mkdtempSync(join(tmpdir(), 'shots-profile-'));
  const chrome = spawn(CHROME, [
    '--headless=new',
    ...flags,
    '--hide-scrollbars',
    '--no-first-run',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ], { stdio: 'ignore' });
  const browser = { chrome, listeners: [] };
  browsers.push(browser);
  const ws = (browser.ws = await connect(profile));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(`${msg.error.message} (${msg.error.code})`)) : resolve(msg.result);
    } else {
      browser.listeners.forEach(fn => fn(msg));
    }
  });
  browser.send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      pending.set(++id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  return browser;
}

// runs one scenario in its own tab and returns its shots.json entry
async function run({ send, listeners }, s) {
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
  const evaluate = expression => send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
  // a check that throws must fail, not read as a pass
  const expectNoError = async (what, expression) => {
    const { result, exceptionDetails } = await evaluate(expression);
    if (exceptionDetails) errors.push(`${s.name}: ${what} threw ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
    else if (result.value) errors.push(`${s.name}: ${result.value}`);
  };
  const step = s.step ?? `open at ${s.viewport.width}px${s.reduced ? ', reduced motion' : ''}${s.eval ? ', theme toggled' : ''}${s.clip ? `, ${s.clip} captured` : ''}`;
  try {
    await send('Runtime.enable', {}, sessionId);
    await send('Page.enable', {}, sessionId);
    await send('Emulation.setDeviceMetricsOverride', s.viewport, sessionId);
    if (s.viewport.mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true }, sessionId);
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: s.reduced ? 'reduce' : 'no-preference' }],
    }, sessionId);
    if (s.init) await send('Page.addScriptToEvaluateOnNewDocument', { source: s.init }, sessionId);
    await send('Page.navigate', { url: new URL(s.page ?? '', BASE_URL).href }, sessionId);
    await sleep(800);
    if (s.gpu) {
      const renderer = (await evaluate(webglRenderer)).result.value;
      if (/swiftshader|no webgl/i.test(renderer)) {
        unverified.push(`${s.name} (${renderer})`);
        console.log(`skipped ${s.name}: chrome draws with ${renderer}`);
        return { name: s.name, files: [], steps: [{ step, state: 'skip', detail: `no gpu: chrome draws with ${renderer}` }] };
      }
    }
    // after load, so it slows what the scenario measures rather than the page's start
    if (s.throttle) await send('Emulation.setCPUThrottlingRate', { rate: s.throttle }, sessionId);
    if (s.eval) {
      const { exceptionDetails } = await send('Runtime.evaluate', { expression: s.eval, awaitPromise: true }, sessionId);
      if (exceptionDetails) errors.push(`${s.name}: eval threw ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
    }
    // a real wheel through the input pipeline: a synthetic WheelEvent never scrolls anything natively.
    // `after` runs at once, to act while the scroll it starts is still under way
    if (s.hover) {
      const { result } = await send('Runtime.evaluate', { expression: centreOf(s.hover), returnByValue: true }, sessionId);
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...result.value }, sessionId);
    }
    if (s.wheel) {
      const { result } = await send('Runtime.evaluate', { expression: centreOf(s.wheel.at), returnByValue: true }, sessionId);
      await send('Input.dispatchMouseEvent', { type: 'mouseWheel', ...result.value, deltaX: 0, deltaY: s.wheel.deltaY }, sessionId);
      if (s.after) {
        const { exceptionDetails } = await send('Runtime.evaluate', { expression: s.after, awaitPromise: true }, sessionId);
        if (exceptionDetails) errors.push(`${s.name}: after threw ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
      }
    }
    // a window resized mid-scenario, after the eval has set up the state before it
    if (s.resize) await send('Emulation.setDeviceMetricsOverride', s.resize, sessionId);
    await sleep(s.waitMs);
    if (s.check) await expectNoError('check', s.check);
    const clip = s.clip && (await evaluate(clipOf(s.clip))).result.value;
    const screenshot = clip ? { format: 'png', clip, captureBeyondViewport: true } : { format: 'png' };
    const { data } = await send('Page.captureScreenshot', screenshot, sessionId);
    const file = `${s.name}.png`;
    writeFileSync(join(OUT, file), Buffer.from(data, 'base64'));
    console.log(`wrote ${join(OUT, file)}`);
    // the same view without the cloud: only pixels can prove it is drawn where it can be seen
    if (s.cloudVisible) {
      await evaluate(`document.querySelector('[data-cloud]').style.visibility = 'hidden'; ${frames}`);
      const { data: bare } = await send('Page.captureScreenshot', screenshot, sessionId);
      await expectNoError('cloud comparison', cloudChanges(data, bare, s.cloudVisible));
    }
    const failed = errors.filter(e => e.startsWith(`${s.name}: `));
    return { name: s.name, files: [file], steps: [{ step, state: failed.length ? 'fail' : 'pass', detail: failed.join('; ') || undefined }] };
  } finally {
    listeners.splice(listeners.indexOf(onEvent), 1);
    await send('Target.closeTarget', { targetId });
    await send('Target.disposeBrowserContext', { browserContextId });
  }
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

async function connect(profile) {
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
