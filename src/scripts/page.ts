import { decode } from './decoder';
import type { Sphere, Theme } from './sphere';

// timings from hamishw.com's intro.jsx: words cycle every 5s, enter over 3s, exit over 2s
const ROLE_INTERVAL = 5000;
const ENTER_MS = 3000;
const EXIT_MS = 2000;
const NAME_DECODE_DELAY = 500;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

// --- intro -------------------------------------------------------------------------------------

const name = $('[data-intro-name]');
const decodeTarget = $('[data-decode]');
const nameText = decodeTarget.textContent!.trim();
const staged = document.querySelectorAll<HTMLElement>('[data-stage]');
const roles = [...document.querySelectorAll<HTMLElement>('[data-role]')];
let roleIndex = 0;
let roleTimer = 0;
let cancelDecode = () => {};
const timers = new Set<number>();

const later = (fn: () => void, ms: number) => {
  const id = window.setTimeout(() => {
    timers.delete(id);
    fn();
  }, ms);
  timers.add(id);
};

// restarting a css animation needs the attribute removed and a reflow before it is set again
const enter = (el: HTMLElement) => {
  el.dataset.status = '';
  void el.offsetWidth;
  el.dataset.status = 'entering';
  later(() => el.dataset.status === 'entering' && (el.dataset.status = 'entered'), ENTER_MS);
};

const showRole = (next: number) => {
  const current = roles[roleIndex];
  if (next !== roleIndex && current.dataset.status) {
    current.dataset.status = 'exiting';
    later(() => current.dataset.status === 'exiting' && (current.dataset.status = ''), EXIT_MS);
  }
  roleIndex = next;
  enter(roles[next]);
};

function playIntro() {
  cancelDecode();
  clearInterval(roleTimer);
  timers.forEach(clearTimeout);
  timers.clear();
  roles.forEach(r => (r.dataset.status = ''));
  roleIndex = 0;

  if (reduceMotion) {
    name.dataset.visible = 'true';
    staged.forEach(el => (el.dataset.status = 'entered'));
    roles[0].dataset.status = 'entered';
    return;
  }

  name.dataset.visible = 'false';
  void name.offsetWidth;
  name.dataset.visible = 'true';
  cancelDecode = decode(decodeTarget, nameText, NAME_DECODE_DELAY);
  staged.forEach(enter);
  showRole(0);
  roleTimer = window.setInterval(() => showRole((roleIndex + 1) % roles.length), ROLE_INTERVAL);
}

// --- title fit ---------------------------------------------------------------------------------

// hamish's words are short enough to never need this; "+ Frontend engineer" overflows a phone
const title = $('[data-title]');
const sizers = [...document.querySelectorAll<HTMLElement>('[data-title-sizer] > *')];

function fitTitle() {
  title.style.setProperty('--titleFit', '1');
  const outer = parseFloat(getComputedStyle(root).getPropertyValue('--spaceOuter'));
  const available = root.clientWidth - title.getBoundingClientRect().left - outer;
  const widest = Math.max(...sizers.map(s => s.getBoundingClientRect().width));
  title.style.setProperty('--titleFit', String(Math.min(1, available / widest)));
}

window.addEventListener('resize', fitTitle);
// the web font arrives after first layout and is wider than the fallback
document.fonts.addEventListener('loadingdone', fitTitle);
fitTitle();

// --- sphere ------------------------------------------------------------------------------------

let theme = (root.dataset.theme as Theme) || 'dark';
let sphere: Sphere | undefined;

// lazy, as in the original: three.js stays out of the first paint
import('./sphere')
  .then(({ startSphere }) => {
    const canvas = $<HTMLCanvasElement>('[data-sphere]');
    sphere = startSphere(canvas, theme, !reduceMotion);
    requestAnimationFrame(() => (canvas.dataset.visible = 'true'));
  })
  .catch(error => console.error('sphere failed to start; the intro shows without it', error));

// --- theme -------------------------------------------------------------------------------------

$('[data-theme-toggle]').addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = theme;
  localStorage.setItem('theme', theme);
  sphere?.setTheme(theme);
  // the original replays the whole intro on a theme change
  playIntro();
});

// --- scroll cue --------------------------------------------------------------------------------

const cues = document.querySelectorAll<HTMLElement>('[data-scroll-cue]');
const updateCue = () => cues.forEach(c => (c.dataset.hidden = String(window.scrollY > 0)));
window.addEventListener('scroll', updateCue, { passive: true });
updateCue();

playIntro();
