import { describe, expect, it } from 'vitest';
import { GLYPHS, isSettled, shuffle, stepSpring, type Spring } from './decode';

const content = 'KHANG TRAN'.split('');

describe('shuffle', () => {
  it('scrambles every character before the decode starts', () => {
    const out = shuffle(content, [], 0, () => 0);
    expect(out.every(c => c.type === 'glyph' && GLYPHS.includes(c.value))).toBe(true);
  });

  it('settles characters left of the position and scrambles the rest', () => {
    const out = shuffle(content, [], 3.2, () => 0);
    expect(out.slice(0, 4).map(c => c.value).join('')).toBe('KHAN');
    expect(out.slice(0, 4).every(c => c.type === 'value')).toBe(true);
    expect(out.slice(4).every(c => c.type === 'glyph')).toBe(true);
  });

  it('holds the previous glyphs in the second half of each step', () => {
    const previous = shuffle(content, [], 0, () => 0.5);
    const out = shuffle(content, previous, 2.7, () => 0);
    expect(out.slice(3).map(c => c.value)).toEqual(previous.slice(3).map(c => c.value));
  });

  it('shows the real text once the position reaches the end', () => {
    const out = shuffle(content, [], content.length, Math.random);
    expect(out.map(c => c.value).join('')).toBe('KHANG TRAN');
  });
});

describe('decode spring', () => {
  it('reaches the target and settles', () => {
    let spring: Spring = { value: 0, velocity: 0 };
    let frames = 0;
    while (!isSettled(spring, content.length) && frames < 2000) {
      spring = stepSpring(spring, content.length, 1 / 60);
      frames++;
    }
    expect(isSettled(spring, content.length)).toBe(true);
    // the original decodes in a couple of seconds, not instantly and not forever
    expect(frames / 60).toBeGreaterThan(1);
    expect(frames / 60).toBeLessThan(8);
  });
});
