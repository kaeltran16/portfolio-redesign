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
  // a nav or skip-link jump during a glide would otherwise be dragged back to the glide's target
  window.addEventListener('hashchange', () => lenis.scrollTo(window.scrollY, { immediate: true, force: true }));
}
