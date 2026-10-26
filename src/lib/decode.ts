// port of hamishw.com's decoder-text shuffle (MIT, Hamish Williams), with code glyphs in place of katakana

export const GLYPHS = '0123456789ABCDEF<>/\\{}[]#$%&*+=_'.split('');

export type Char = { type: 'glyph' | 'value'; value: string };

// characters before `position` are settled; the rest alternate between fresh and held glyphs,
// which gives the flicker its uneven rhythm
export function shuffle(
  content: string[],
  previous: Char[],
  position: number,
  random: () => number = Math.random,
): Char[] {
  return content.map((value, index) => {
    if (index < position) return { type: 'value', value };
    if (position % 1 < 0.5) {
      return { type: 'glyph', value: GLYPHS[Math.floor(random() * GLYPHS.length)] };
    }
    return { type: 'glyph', value: previous[index]?.value ?? GLYPHS[0] };
  });
}

// same feel as framer-motion's useSpring({ stiffness: 8, damping: 5 }) that drives the original
export const DECODE_SPRING = { stiffness: 8, damping: 5, mass: 1 };

export type Spring = { value: number; velocity: number };

export function stepSpring(
  spring: Spring,
  target: number,
  dt: number,
  { stiffness, damping, mass } = DECODE_SPRING,
): Spring {
  const force = -stiffness * (spring.value - target) - damping * spring.velocity;
  const velocity = spring.velocity + (force / mass) * dt;
  return { value: spring.value + velocity * dt, velocity };
}

export function isSettled(spring: Spring, target: number): boolean {
  return Math.abs(spring.value - target) < 0.01 && Math.abs(spring.velocity) < 0.01;
}
