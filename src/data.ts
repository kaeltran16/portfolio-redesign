// shared by Home and the case-study pages. bracketed text is a placeholder until khang supplies the real copy and media.
import type { ImageMetadata } from 'astro';
import opalToday from './assets/opal-today.png';

export const name = 'Khang Tran';
export const role = 'Full-stack';
export const nav = ['Projects', 'Experience', 'About', 'Contact'];

export const social = [
  {
    label: 'GitHub',
    href: 'https://github.com/kaeltran16',
    path: 'M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z',
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/khangtranx',
    path: 'M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45Z',
  },
  {
    label: 'Email',
    href: 'mailto:cktran16x2@gmail.com',
    path: 'M3 4.5h18A1.5 1.5 0 0 1 22.5 6v12a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 18V6A1.5 1.5 0 0 1 3 4.5Zm.5 3V17.5h17V7.5l-8.5 6-8.5-6Zm1.6-1 6.9 4.9 6.9-4.9H5.1Z',
  },
];

// diagrams are drawn in a 680x520 viewBox, the same box every visual sits in
type Label = { x: number; y: number; text: string; tone?: 'primary' | 'caption' };
export type Visual =
  | { kind: 'diagram'; label: string; edges: string[]; boxes: [number, number, number, number][]; labels: Label[] }
  | { kind: 'phone'; image: ImageMetadata; alt: string };
type Project = {
  slug: string;
  title: string;
  description: string;
  visual: Visual;
  facts: { label: string; value: string }[];
  sections: { heading: string; body: string[] }[];
};

export const projects: Project[] = [
  {
    slug: 'arc',
    title: 'Arc',
    description: 'A cockpit for Claude Code. Start and watch agent runs, track multi-week initiatives, and review designs beside the terminal.',
    visual: {
      kind: 'diagram',
      label: 'Arc: agent tabs and runs call wsh, which records runs, initiatives and notes in Arc, shown in the cockpit',
      edges: [
        'M130 84 C130 112 340 112 340 140',
        'M340 84 L340 140',
        'M550 84 C550 112 340 112 340 140',
        'M340 184 L340 240',
        'M340 370 L340 436',
      ],
      boxes: [
        [40, 40, 180, 44],
        [250, 40, 180, 44],
        [460, 40, 180, 44],
        [280, 140, 120, 44],
        [120, 240, 440, 130],
        [138, 300, 124, 44],
        [278, 300, 124, 44],
        [418, 300, 124, 44],
        [280, 436, 120, 44],
      ],
      labels: [
        { x: 40, y: 24, text: 'agents', tone: 'caption' },
        { x: 130, y: 62, text: 'claude code' },
        { x: 340, y: 62, text: 'claude code' },
        { x: 550, y: 62, text: 'run' },
        { x: 340, y: 162, text: 'wsh' },
        { x: 340, y: 270, text: 'arc', tone: 'primary' },
        { x: 200, y: 322, text: 'runs' },
        { x: 340, y: 322, text: 'initiatives' },
        { x: 480, y: 322, text: 'notes' },
        { x: 340, y: 458, text: 'cockpit' },
      ],
    },
    facts: [
      { label: 'Role', value: 'Solo, personal project' },
      { label: 'When', value: 'June 2026 – now' },
      { label: 'Stack', value: 'Go, TypeScript and React, Rust (Tauri), xterm.js' },
    ],
    sections: [
      {
        heading: 'What it is',
        body: [
          'A desktop app for supervising coding agents. Agent terminals, their questions, task graphs, git diffs and run history sit in one workspace, so I can see what is running, answer what is blocked and review what changed without hopping between terminal windows.',
          'It wraps existing agent CLIs (Claude Code or pi) rather than replacing them. It began as a fork of Wave Terminal; I moved the desktop shell from Electron to Tauri.',
        ],
      },
      { heading: 'Why I built it', body: ['[The problem running several agents at once created, in your words]'] },
      { heading: 'How it works', body: ['[Runs, the orchestrator DAG, worktree isolation and review gates: the two or three design calls worth explaining]'] },
      { heading: 'What I learned', body: ['[What changed in how you work, or what you would do differently]'] },
    ],
  },
  {
    slug: 'siem',
    title: 'SIEM',
    description: '[SIEM: one line on what the platform does and who uses it]',
    visual: {
      kind: 'diagram',
      label: 'SIEM, a draft: [log sources] flow through [collectors and parsers] into [detection and ai], shown in [management panel]',
      edges: ['M340 84 L340 172', 'M340 216 L340 304', 'M340 348 L340 436'],
      boxes: [
        [200, 40, 280, 44],
        [200, 172, 280, 44],
        [200, 304, 280, 44],
        [200, 436, 280, 44],
      ],
      labels: [
        { x: 340, y: 62, text: '[log sources]' },
        { x: 340, y: 194, text: '[collectors and parsers]' },
        { x: 340, y: 326, text: '[detection and ai]', tone: 'primary' },
        { x: 340, y: 458, text: '[management panel]' },
      ],
    },
    facts: [
      { label: 'Role', value: '[Your title], [Company]' },
      { label: 'When', value: 'July 2023 – now' },
      { label: 'Stack', value: '[Languages and infrastructure you are comfortable naming publicly]' },
    ],
    sections: [
      {
        heading: 'What it is',
        body: ['[The platform in two sentences, at a level your employer is comfortable with]'],
      },
      {
        heading: 'What I worked on',
        body: [
          '[The management panel, anomaly detection, the AI assistant, parser config generation, log collectors: pick the ones to feature and say what you owned in each]',
        ],
      },
      { heading: 'How it works', body: ['[One design decision worth explaining, without internal details]'] },
      { heading: 'Outcome', body: ['[What changed for users or the team, ideally with a number you can stand behind]'] },
    ],
  },
  {
    slug: 'opal',
    title: 'opal',
    description: 'One app for money, movement, and the little rituals that hold your day together.',
    // captured from the web build with seed data (dart_defines/dev.json), not real personal data
    visual: {
      kind: 'phone',
      image: opalToday,
      alt: "opal's Today screen: Pal suggests moving leg day to Friday because of rain, above the day's rituals",
    },
    facts: [
      { label: 'Role', value: 'Solo, personal project' },
      { label: 'When', value: 'June 2026 – now' },
      { label: 'Stack', value: 'Flutter, Riverpod, Drift; a Cloudflare Worker and D1 backend in TypeScript' },
    ],
    sections: [
      {
        heading: 'What it is',
        body: [
          'An iOS app that keeps spending, workouts, nutrition, mood, sleep and daily rituals in one place, with Pal, an assistant that reads across them.',
          'A small Cloudflare Worker holds what the phone cannot: the model API key and a little server-side state for the widget, the Health shortcut and Pal’s memory.',
        ],
      },
      { heading: 'Why I built it', body: ['[What you were tracking in separate apps, and why one app]'] },
      { heading: 'How it works', body: ['[Local-first storage, the Pal backend, iOS Live Activities and Siri: the calls worth explaining]'] },
      { heading: 'What I learned', body: ['[What changed in how you work, or what you would do differently]'] },
    ],
  },
];
