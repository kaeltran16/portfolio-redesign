import { isSettled, shuffle, stepSpring, type Char, type Spring } from '../lib/decode';

// longest step the spring takes, so slow frames still finish the decode on time
const MAX_STEP_S = 0.1;

// decodes `el`'s text in place; returns a cancel function
export function decode(el: HTMLElement, text: string, delayMs: number): () => void {
  const content = text.split('');
  let output: Char[] = [];
  let spring: Spring = { value: 0, velocity: 0 };
  let frame = 0;
  let last = 0;

  const render = () => {
    el.innerHTML = output
      .map(c => `<span class="decode-${c.type}">${c.value === ' ' ? '&nbsp;' : c.value}</span>`)
      .join('');
  };

  const tick = (now: number) => {
    // clamp so a backgrounded tab does not jump the spring on return
    const dt = Math.min((now - (last || now)) / 1000, MAX_STEP_S);
    last = now;
    spring = stepSpring(spring, content.length, dt);
    output = shuffle(content, output, spring.value);
    render();
    if (isSettled(spring, content.length)) {
      el.textContent = text;
      return;
    }
    frame = requestAnimationFrame(tick);
  };

  output = shuffle(content, output, 0);
  render();
  const timer = window.setTimeout(() => (frame = requestAnimationFrame(tick)), delayMs);

  return () => {
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    el.textContent = text;
  };
}
