// the header on every page: the phone strip fills in once the page leaves the top, nav links jump without adding a
// history stop, and the link for the section in view is marked current. on case pages the sections live on Home, so
// their links stay plain navigations and none is current
import { currentSection } from '../lib/nav';

const root = document.documentElement;
const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-nav-link]')];
const menu = document.querySelector<HTMLElement>('[data-nav-menu]')!;
const idOf = (link: HTMLAnchorElement) => new URL(link.href).hash.slice(1);
const sections = [...new Set(links.map(idOf))]
  .map(id => document.getElementById(id))
  .filter((section): section is HTMLElement => section !== null);

for (const link of links) {
  link.addEventListener('click', event => {
    const id = idOf(link);
    const newTab = event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (newTab || !document.getElementById(id)) return;
    event.preventDefault();
    if (menu.matches(':popover-open')) menu.hidePopover();
    // location.replace, not history.replaceState: only a navigation updates :target, which the arrival cue keys off
    location.replace(`#${id}`);
  });
}

function update() {
  root.dataset.scrolled = String(window.scrollY > 0);
  if (!sections.length) return;
  const atEnd = window.scrollY + innerHeight >= root.scrollHeight - 1;
  const current = sections[currentSection(sections.map(s => s.getBoundingClientRect().top), innerHeight, atEnd)];
  for (const link of links) {
    if (current && idOf(link) === current.id) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  }
}

window.addEventListener('scroll', update, { passive: true });
window.addEventListener('resize', update);
update();
