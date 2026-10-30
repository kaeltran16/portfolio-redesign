import { describe, expect, it } from 'vitest';
import { projects, type Visual } from './data';

const diagram = (slug: string) => {
  const visual = projects.find(p => p.slug === slug)?.visual;
  if (visual?.kind !== 'diagram') throw new Error(`${slug} has no diagram`);
  return visual as Extract<Visual, { kind: 'diagram' }>;
};
const at = (items: { at: number }[]) => items.map(i => i.at);
const siem = () => {
  const visual = projects.find(p => p.slug === 'siem')?.visual;
  if (visual?.kind !== 'console') throw new Error('siem has no console');
  return visual;
};

describe('scene steps', () => {
  it('gives arc 3 steps and siem 6', () => {
    expect(diagram('arc').captions).toHaveLength(3);
    expect(siem().steps).toHaveLength(6);
  });

  it('lights arc in the order of its flow', () => {
    const arc = diagram('arc');
    expect(at(arc.edges)).toEqual([2, 2, 2, 2, 3]);
    expect(at(arc.boxes)).toEqual([1, 1, 1, 2, 2, 2, 2, 2, 3]);
    expect(at(arc.labels)).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 2, 3]);
  });

  it('lights each siem panel in exactly one step, telling the attack in order', () => {
    expect(siem().steps.map(s => s.panel)).toEqual(['events', 'risk', 'intel', 'chain', 'alerts', 'agent']);
  });

  it('keeps every arc step in range and gives each step a box', () => {
    const { edges, boxes, labels, captions } = diagram('arc');
    for (const step of at([...edges, ...boxes, ...labels])) {
      expect(step).toBeGreaterThanOrEqual(1);
      expect(step).toBeLessThanOrEqual(captions.length);
    }
    captions.forEach((_, i) => expect(at(boxes)).toContain(i + 1));
  });

  it('gives siem a command and caption per step about the invented attack only', () => {
    for (const { verb, query, caption } of siem().steps) for (const text of [verb, query, caption]) expect(text.trim()).not.toBe('');
    const text = siem().steps.flatMap(s => [s.query, s.caption]).join('\n');
    const ips = new Set(text.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g));
    expect([...ips]).toEqual(['203.0.113.61']);
  });
});
