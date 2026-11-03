// headings rise in letter by letter and the experience roles spring in, each once, as they come into view.
// nothing is hidden until gsap has loaded and split, so a failed load leaves the content as it is
import { reduceMotion } from './motion';

const HEADINGS = '.project-title, .section-title';
// the role's contents, never the role: page.ts reads role rects to draw the timeline
const ROLE_ITEMS = '.experience-dates, .experience-body h3, .experience-company, .experience-body li';

type Gsap = typeof import('gsap').gsap;

// plays `play` once, the first time `el` comes into view
function onceInView(el: Element, play: () => void) {
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    play();
  });
  observer.observe(el);
}

function revealHeadings(gsap: Gsap, SplitText: typeof import('gsap/SplitText').SplitText) {
  for (const heading of document.querySelectorAll<HTMLElement>(HEADINGS)) {
    const { chars } = SplitText.create(heading, { type: 'words,chars', mask: 'chars', charsClass: 'split-char', aria: 'auto' });
    gsap.set(chars, { yPercent: 100 });
    onceInView(heading, () => gsap.to(chars, { yPercent: 0, duration: 0.7, ease: 'power3.out', stagger: 0.025 }));
  }
}

// a role's longest list, 8 items, ends at 0.5 + 7 * 0.06 = 0.92s: inside the 1s the screenshot waits allow
function enterRoles(gsap: Gsap) {
  for (const role of document.querySelectorAll<HTMLElement>('.experience-role')) {
    const items = role.querySelectorAll<HTMLElement>(ROLE_ITEMS);
    gsap.set(items, { y: 40, opacity: 0 });
    onceInView(role, () =>
      gsap.to(items, { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.6)', stagger: 0.06, clearProps: 'transform,opacity' }),
    );
  }
}

if (!reduceMotion) {
  // the split measures glyphs, so it waits for the web font
  Promise.all([import('gsap'), import('gsap/SplitText'), document.fonts.ready])
    .then(([{ gsap }, { SplitText }]) => {
      gsap.registerPlugin(SplitText);
      revealHeadings(gsap, SplitText);
      enterRoles(gsap);
    })
    .catch(error => console.error('reveal failed to load; headings and experience show without it', error));
}
