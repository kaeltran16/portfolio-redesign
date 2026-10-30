// shared by Home and the case-study pages. case-study copy is a draft until khang finalizes it.
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

// a drawing of a product's screen in the 680-wide box every visual sits in: one panel lights per scroll step while
// its command types in the box below. a step's panel is the one it lights, counted from 1; one caption per step
type ConsoleStep<Panel> = { panel: Panel; verb: string; query: string; caption: string };
export type SiemPanel = 'agent' | 'risk' | 'intel' | 'chain' | 'alerts' | 'events';
export type ArcPanel = 'run' | 'worker' | 'ask' | 'diff';
export type Visual =
  | { kind: 'console'; product: 'siem'; label: string; steps: ConsoleStep<SiemPanel>[] }
  | { kind: 'console'; product: 'arc'; label: string; steps: ConsoleStep<ArcPanel>[] }
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
      kind: 'console',
      product: 'arc',
      label: 'Arc: the cockpit, with a run’s task graph, an agent at work, its question and its change in a diff',
      // one run told in order, on this site's own code; drawn after the dev app's cockpit
      steps: [
        { panel: 'run', verb: 'Run', query: 'Reading time on case pages', caption: 'A run starts from a goal. The engine plans it into tasks and hands each ready one to its own agent.' },
        { panel: 'worker', verb: 'Watch', query: 'reading-time', caption: 'Each agent works in its own terminal, and its card shows what it read, ran and changed.' },
        { panel: 'ask', verb: 'Answer', query: '4 min read', caption: 'A decision it should not make alone comes back as a card, answered in place.' },
        { panel: 'diff', verb: 'Review', query: 'src/lib/reading-time.ts', caption: 'Its change opens in a diff and lands only after review and the run’s checks.' },
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
      {
        heading: 'Why I built it',
        body: [
          'Running more agents did not mean less work. It meant a different kind: knowing which agent was waiting on a decision, which task was blocked on another, what actually landed and whether anyone checked it. That context lived in a dozen terminal tabs and transcripts.',
          'Arc puts it next to the work. Questions and review requests surface in one place instead of disappearing into scrollback, and a run’s changes open in a diff view in the same window.',
        ],
      },
      {
        heading: 'How it works',
        body: [
          'The main design call is a hard line between code and model. A deterministic engine owns scheduling, worktrees, merges and command execution. Agents do implementation and judgment. Anything they cannot safely decide comes to me.',
          'A planned run starts with a review of the plan itself: requirements, dependencies, file ownership, how each task will be verified. The engine then dispatches dependency-ready tasks into isolated git worktrees, reviews each change, merges the lanes into the run’s own branch and runs the checks before anything lands.',
        ],
      },
      {
        heading: 'What I learned',
        body: [
          'The useful question with agents is not what a model can do, but what it should never be asked to do. Once retries, merges and routing moved into plain code, runs became repeatable and failures became something I could read instead of something I had to reproduce.',
        ],
      },
    ],
  },
  {
    slug: 'siem',
    title: 'SIEM',
    description: 'A multi-tenant security platform at MozoX that collects logs from many vendors, detects threats and explains them to analysts.',
    visual: {
      kind: 'console',
      product: 'siem',
      label: 'SIEM: one console dashboard with a panel per stage, from events arriving to the AI assistant explaining the alert',
      // one attack told in order. it is invented: a documentation-range ip and a reserved domain, not customer data
      steps: [
        { panel: 'events', verb: 'Search', query: 'VPN logins, last 24 hours', caption: 'Logs arrive from firewalls, AD, VPN and EDR. The AI parser maps each new source onto one schema, with no hand-written parser.' },
        { panel: 'risk', verb: 'Score', query: '203.0.113.61', caption: 'Anomaly detection scores 203.0.113.61 against the tenant’s baseline: off-hours, one service, one country.' },
        { panel: 'intel', verb: 'Look up', query: '203.0.113.61', caption: 'Threat intelligence checks the address, domain and file hash it touched.' },
        { panel: 'chain', verb: 'Link', query: 'j.doe', caption: 'The correlation engine joins night probes, failed logins and a j.doe login into one VPN break-in.' },
        { panel: 'alerts', verb: 'Filter', query: 'Today’s alerts', caption: 'The analyst gets one high warning. Whitelists, dedup and suppression keep the rest out.' },
        { panel: 'agent', verb: 'Ask', query: 'Why was this raised?', caption: 'Asked why it was raised, the AI assistant answers in plain language.' },
      ],
    },
    facts: [
      { label: 'Role', value: 'Full-stack engineer, MozoX' },
      { label: 'When', value: 'July 2023 – now' },
      { label: 'Stack', value: 'Next.js and React, Java, Python, PostgreSQL, Elasticsearch' },
    ],
    sections: [
      {
        heading: 'What it is',
        body: [
          'A security information and event management platform for enterprise customers. It takes logs from sources such as Check Point, F5, CrowdStrike and VMware ESXi, maps them onto one schema and flags the activity worth an analyst’s time, at around a thousand events a second across tenants.',
        ],
      },
      {
        heading: 'What I worked on',
        body: [
          'The AI log parser: a model maps a new log source onto the platform’s schema, so onboarding a source no longer starts with a hand-written parser.',
          'Anomaly detection: a correlation engine that combines Isolation Forest, an autoencoder and Z-scores, and maps what it finds to MITRE ATT&CK techniques.',
          'Analyst-facing AI: natural-language search that turns a question into a query, and generated executive reports in several languages.',
          'Full-stack work across the management panel, vendor log integrations and MITRE ATT&CK dashboards, plus a modernization effort I started that upgraded the web app without disrupting the live system.',
        ],
      },
      {
        heading: 'How it works',
        body: [
          'The model is used where the input is unpredictable and kept out of the hot path. Mapping an unfamiliar log format is a judgment call, so the model does it once per source; parsing a thousand events a second is not, so that stays deterministic.',
        ],
      },
      {
        heading: 'Outcome',
        body: [
          'Onboarding a new log source went from about a week to minutes, and around a fifth of all log volume now goes through the AI parsing pipeline.',
        ],
      },
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
      {
        heading: 'Why I built it',
        body: [
          'I tracked spending in one app, workouts in another and habits in a third, and none of them knew about the others. The interesting questions sit between them: whether a rainy day should move leg day, or what a heavy week did to sleep.',
          'One app with one assistant that can read across all of it was the simplest way to ask those questions.',
        ],
      },
      {
        heading: 'How it works',
        body: [
          'opal is local-first: everything lives on the phone in SQLite through Drift and works offline. The Worker only holds what the phone cannot, so it stays small and the app still runs against a mock backend.',
          'Live Activities, Siri shortcuts and notifications are native iOS. The app is sideloaded with a free Apple ID, which rules out HealthKit, so health features degrade gracefully without it.',
          'The design follows Oura’s approach rather than a dashboard: Today leads with the one thing that matters right now, and detail is always one tap away.',
        ],
      },
      {
        heading: 'What I learned',
        body: [
          'Designing for one user, me, made the trade-offs honest. Every feature had to earn a place on a screen I open every morning, and most of the work turned out to be cutting things.',
        ],
      },
    ],
  },
];
