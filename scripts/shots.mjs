// screenshots of the running dev server through the chrome devtools protocol.
// headless chrome's window cannot go below ~500px wide, so phone sizes need device emulation.
// usage: node scripts/shots.mjs [outDir]   (dev server on http://localhost:4321, or set BASE_URL;
// SHOTS=phone-390,role-wipe runs only those)
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4321/';
const OUT = process.argv[2] ?? process.env.ARC_FINAL_OUT ?? join(tmpdir(), 'portfolio-shots');
const PORT = 9333;
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

const SCENARIOS = [
  { name: 'desktop', viewport: desktop, waitMs: 7000, check: titleFits },
  // role words change every 5s; 6.2s lands inside the wipe of the second word
  { name: 'role-wipe', viewport: desktop, waitMs: 6200 },
  { name: 'light', viewport: desktop, waitMs: 6000, eval: toggleTheme },
  { name: 'phone-390', viewport: phone, waitMs: 6000, check: titleFits },
  { name: 'reduced-motion', viewport: desktop, waitMs: 1500, reduced: true },
];

const only = process.env.SHOTS?.split(',');
const selected = only ? SCENARIOS.filter(s => only.includes(s.name)) : SCENARIOS;

if (!CHROME) {
  console.log('no chrome found; set CHROME to its path');
  process.exit(3);
}
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new',
  '--enable-unsafe-swiftshader',
  '--use-angle=swiftshader',
  '--hide-scrollbars',
  '--no-first-run',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'shots-profile-'))}`,
  'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
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
    await send('Page.navigate', { url: BASE_URL }, sessionId);
    await sleep(800);
    if (s.eval) await send('Runtime.evaluate', { expression: s.eval }, sessionId);
    await sleep(s.waitMs);
    if (s.check) {
      const { result } = await send('Runtime.evaluate', { expression: s.check, returnByValue: true }, sessionId);
      if (result.value) errors.push(`${s.name}: ${result.value}`);
    }
    const { data } = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    const file = `${s.name}.png`;
    writeFileSync(join(OUT, file), Buffer.from(data, 'base64'));
    shots.push({ name: s.name, files: [file], steps: [{ step: `open at ${s.viewport.width}px${s.reduced ? ', reduced motion' : ''}${s.eval ? ', theme toggled' : ''}`, state: 'pass' }] });
    listeners.splice(listeners.indexOf(onEvent), 1);
    await send('Target.closeTarget', { targetId });
    await send('Target.disposeBrowserContext', { browserContextId });
    console.log(`wrote ${join(OUT, file)}`);
  }
  writeFileSync(join(OUT, 'shots.json'), JSON.stringify(shots, null, 2));
  ws.close();
} finally {
  chrome.kill();
}

if (errors.length) {
  console.error(`page errors:\n${errors.join('\n')}`);
  process.exit(1);
}

async function connect() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
      const ws = new WebSocket(webSocketDebuggerUrl);
      await new Promise((resolve, reject) => {
        ws.addEventListener('open', resolve, { once: true });
        ws.addEventListener('error', reject, { once: true });
      });
      return ws;
    } catch {
      await sleep(200);
    }
  }
  throw new Error(`chrome devtools did not come up on port ${PORT}`);
}
