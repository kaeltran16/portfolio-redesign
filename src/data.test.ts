import { describe, expect, it } from 'vitest';
import { projects, type Visual } from './data';

const diagram = (slug: string) => {
  const visual = projects.find(p => p.slug === slug)?.visual;
  if (visual?.kind !== 'diagram') throw new Error(`${slug} has no diagram`);
  return visual as Extract<Visual, { kind: 'diagram' }>;
};
const at = (items: { at: number }[]) => items.map(i => i.at);

describe('scene steps', () => {
  it('gives arc 3 steps and siem 4', () => {
    expect(diagram('arc').captions).toHaveLength(3);
    expect(diagram('siem').captions).toHaveLength(4);
  });

  it('lights arc in the order of its flow', () => {
    const arc = diagram('arc');
    expect(at(arc.edges)).toEqual([2, 2, 2, 2, 3]);
    expect(at(arc.boxes)).toEqual([1, 1, 1, 2, 2, 2, 2, 2, 3]);
    expect(at(arc.labels)).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 2, 3]);
  });

  it('lights siem one stage per step, each edge with the stage it enters', () => {
    const siem = diagram('siem');
    expect(at(siem.edges)).toEqual([2, 3, 4]);
    expect(at(siem.boxes)).toEqual([1, 2, 3, 4]);
    expect(at(siem.labels)).toEqual([1, 2, 3, 4]);
    expect(siem.packets).toBe('current');
  });

  it.each(['arc', 'siem'])('keeps every %s step in range and gives each step a box', slug => {
    const { edges, boxes, labels, captions } = diagram(slug);
    for (const step of at([...edges, ...boxes, ...labels])) {
      expect(step).toBeGreaterThanOrEqual(1);
      expect(step).toBeLessThanOrEqual(captions.length);
    }
    captions.forEach((_, i) => expect(at(boxes)).toContain(i + 1));
  });

  it('gives siem one card per step about the invented sample event only', () => {
    const { cards, captions } = diagram('siem');
    expect(cards).toHaveLength(captions.length);
    const text = cards!.flatMap(c => [c.title, ...c.lines]).join('\n');
    for (const s of ['10.0.4.12', '203.0.113.9', 'T1110']) expect(text).toContain(s);
    const ips = new Set(text.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g));
    expect([...ips].sort()).toEqual(['10.0.4.12', '203.0.113.9']);
  });
});
