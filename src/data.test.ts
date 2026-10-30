import { describe, expect, it } from 'vitest';
import { projects, type Visual } from './data';

const consoleOf = <P extends 'siem' | 'arc'>(product: P) => {
  const visual = projects.find(p => p.slug === product)?.visual;
  if (visual?.kind !== 'console' || visual.product !== product) throw new Error(`${product} has no console`);
  return visual as Extract<Visual, { product: P }>;
};

describe('scene steps', () => {
  it('gives arc 4 steps and siem 6', () => {
    expect(consoleOf('arc').steps).toHaveLength(4);
    expect(consoleOf('siem').steps).toHaveLength(6);
  });

  it('lights each arc panel in exactly one step, telling the run in order', () => {
    expect(consoleOf('arc').steps.map(s => s.panel)).toEqual(['run', 'worker', 'ask', 'diff']);
  });

  it('lights each siem panel in exactly one step, telling the attack in order', () => {
    expect(consoleOf('siem').steps.map(s => s.panel)).toEqual(['events', 'risk', 'intel', 'chain', 'alerts', 'agent']);
  });

  it.each(['arc', 'siem'] as const)('gives every %s step a command and a caption', product => {
    for (const { verb, query, caption } of consoleOf(product).steps) {
      for (const text of [verb, query, caption]) expect(text.trim()).not.toBe('');
    }
  });

  it('tells siem about the invented attack only', () => {
    const text = consoleOf('siem').steps.flatMap(s => [s.query, s.caption]).join('\n');
    const ips = new Set(text.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g));
    expect([...ips]).toEqual(['203.0.113.61']);
  });
});
