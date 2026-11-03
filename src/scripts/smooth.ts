// wheel scrolling glides; touch stays native so phones keep their own inertia
import 'lenis/dist/lenis.css';
import Lenis from 'lenis';
import { reduceMotion } from './motion';

if (!reduceMotion) {
  const lenis = new Lenis({
    autoRaf: true,
    // the open menu is its own scroll container on short windows, so a wheel over it scrolls the menu natively
    prevent: node => node.closest('[data-nav-menu]') !== null,
  });
  // a nav or skip-link jump during a glide would otherwise be dragged back to the glide's target. hashchange alone
  // is a task late, and a lenis frame before it scrolls back, so the click stops the glide too. a nav link has
  // already jumped when the click reaches window; the skip link jumps after it, and hashchange then catches up
  const stopGlide = () => lenis.scrollTo(window.scrollY, { immediate: true, force: true });
  window.addEventListener('click', event => {
    if ((event.target as Element).closest('a[href*="#"]')) stopGlide();
  });
  window.addEventListener('hashchange', stopGlide);
}
