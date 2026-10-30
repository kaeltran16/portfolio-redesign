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
  const wide = [...document.querySelectorAll('#projects *')].find(el => el.getBoundingClientRect().right > innerWidth + 0.5);
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
// steps are forced by hand: the row scrolled into view, then its step set
const atStep = (n, k) => `(() => {
  const row = document.querySelector('${row(n)}');
  row.scrollIntoView();
  row.dataset.step = '${k}';
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
// returns an error string unless the row shows step k: elements ahead faint, packets on the right edges,
// only the k-th caption and, for siem, only the k-th card and tick, with the card inside the figure and the viewport
const showsStep = (n, k) => `(() => {
  ${sceneKit}
  const row = document.querySelector('${row(n)}');
  const siem = ${n === SIEM};
  const errors = [];
  if (row.dataset.step !== '${k}') errors.push('row is at step ' + row.dataset.step);
  for (const el of litOf(row)) {
    const want = at(el) > ${k} ? '0.12' : '1';
    if (opacityOf(el) !== want) errors.push(el.tagName + ' of step ' + at(el) + ' has opacity ' + opacityOf(el) + ', not ' + want);
  }
  for (const el of row.querySelectorAll('.diagram-packets [data-at]')) {
    const want = (siem ? at(el) === ${k} : at(el) <= ${k}) ? '1' : '0';
    if (opacityOf(el) !== want) errors.push('packet of step ' + at(el) + ' has opacity ' + opacityOf(el) + ', not ' + want);
  }
  const parts = siem ? ['.scene-captions li', '.scene-card', '.scene-tick'] : ['.scene-captions li'];
  for (const part of parts) {
    const shown = [...row.querySelectorAll(part)].filter(onScreen).map(at);
    if (shown.join() !== '${k}') errors.push(part + ' shows steps [' + shown.join(', ') + '], not only ${k}');
  }
  const card = row.querySelector('.scene-card[data-at="${k}"]')?.getBoundingClientRect();
  if (card && !within(card, row.querySelector('.scene').getBoundingClientRect())) errors.push('card runs out of its figure');
  if (card && !within(card, { left: 0, top: 0, right: innerWidth, bottom: innerHeight })) errors.push('card runs out of the viewport');
  return errors.join('; ');
})()`;
const sceneText = n => `.scene-captions li span${n === SIEM ? ', .scene-card span' : ''}`;
const sceneScenarios = [
  ...[1, 2, 3].map(k => [ARC, 'arc', k, false]),
  ...[1, 2, 3, 4].map(k => [SIEM, 'siem', k, false]),
  [ARC, 'arc', 2, true],
  [SIEM, 'siem', 3, true],
].map(([n, slug, k, light]) => ({
  name: `scene-${slug}-${k}${light ? '-light' : ''}`,
  viewport: desktop,
  waitMs: 1000,
  eval: light ? `${toggleTheme}; ${atStep(n, k)}` : atStep(n, k),
  check: allOf(showsStep(n, k), readable(row(n), sceneText(n))),
  clip: row(n),
  step: `${slug} scene at step ${k} of ${slug === 'arc' ? 3 : 4}, ${light ? 'light' : 'dark'}: elements ahead faint, packets on the reached edges${slug === 'siem' ? ' (only the one into the lit stage), the stage’s card and tick beside it' : ''}, only caption ${k} shown, text at 4.5:1 or more`,
}));

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
    eval: atStep(SIEM, 2),
    check: `(() => {
      ${sceneKit}
      const row = document.querySelector('${row(SIEM)}');
      const cards = [...row.querySelectorAll('.scene-card')].filter(onScreen);
      if (cards.map(at).join() !== '2') return 'cards shown for steps [' + cards.map(at).join(', ') + '], not only 2';
      const card = cards[0].getBoundingClientRect();
      const box = row.querySelector('.project-visual').getBoundingClientRect();
      const text = row.querySelector('.project-text').getBoundingClientRect();
      const caption = [...row.querySelectorAll('.scene-captions li')].find(onScreen)?.getBoundingClientRect();
      if (card.top < box.bottom - 0.5) return 'card overlaps the diagram box';
      if (card.left < -0.5 || card.right > innerWidth + 0.5) return 'card runs past the viewport width';
      if (caption && card.bottom > caption.top + 0.5) return 'card overlaps the step caption';
      return card.bottom > text.top + 0.5 ? 'card overlaps the row text' : '';
    })()`,
    clip: row(SIEM),
    step: 'siem scene at step 2 on a 390px phone: the card sits under the diagram box, inside the width, above the caption and the row text',
  },
  {
    name: 'scenes-reduced-motion',
    viewport: desktop,
    waitMs: 1000,
    reduced: true,
    eval: show('projects'),
    check: allOf(packetsStill, `(() => {
      ${sceneKit}
      const projects = document.getElementById('projects');
      const errors = [];
      if (projects.querySelector('[data-step]')) errors.push('a row has a step under reduced motion');
      const dim = [...litOf(projects), ...projects.querySelectorAll('.diagram-packets [data-at]')].filter(el => opacityOf(el) !== '1');
      if (dim.length) errors.push(dim.length + ' diagram elements are not fully lit');
      const hidden = [...projects.querySelectorAll('.scene-captions li')].filter(el => !onScreen(el));
      if (hidden.length) errors.push(hidden.length + ' step captions are not listed');
      if ([...projects.querySelectorAll('.scene-card, .scene-tick')].some(onScreen)) errors.push('a siem card or tick shows');
      return errors.join('; ');
    })()`),
    clip: '#projects',
    step: 'scenes under reduced motion: no steps, every diagram lit, packets still, every caption listed, no siem card',
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
    if (s.eval) await send('Runtime.evaluate', { expression: s.eval }, sessionId);
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
