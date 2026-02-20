import type React from 'react';

/* ── Types ──────────────────────────────────────── */

export interface Feature {
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly desc: string;
}

export interface Step {
  readonly num: string;
  readonly title: string;
  readonly desc: string;
  readonly quote: string;
  readonly source: string;
}

export interface Metric {
  readonly value: string;
  readonly label: string;
  readonly suffix: string;
}

export interface Persona {
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly desc: string;
}

/* ── Data ──────────────────────────────────────── */

export const FEATURES: readonly Feature[] = [
  {
    icon: (
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Smart Progression',
    desc: 'The app decides when to add weight and how to handle failure. You just show up and lift.',
  },
  {
    icon: (
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" />
        <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
      </svg>
    ),
    title: 'Proven Programs',
    desc: 'Science-backed training programs with structured periodization. New programs added regularly.',
  },
  {
    icon: (
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Stats & Charts',
    desc: 'See your strength curve over time. Real data, not guesswork.',
  },
  {
    icon: (
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path
          d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: 'Offline First',
    desc: 'Works without internet. Your data stays on your device. Optional cloud sync if you want it.',
  },
];

export const STEPS: readonly Step[] = [
  {
    num: '01',
    title: 'Set Your Weights',
    desc: 'Enter your starting weights for each lift. The program builds your entire 90-workout plan instantly.',
    quote: '"I\'ll surpass my limits right here, right now."',
    source: '\u2014 Goku, entering the Hyperbolic Time Chamber',
  },
  {
    num: '02',
    title: 'Follow the Program',
    desc: 'Each workout tells you exactly what to do \u2014 exercise, sets, reps, weight. No guessing.',
    quote: '"A year in here is only a day outside. Let\'s make every second count."',
    source: '\u2014 Vegeta, Hyperbolic Time Chamber',
  },
  {
    num: '03',
    title: 'Progress Automatically',
    desc: 'Hit your reps and weight goes up. Miss and the program adapts \u2014 adjusting volume to keep you moving.',
    quote: '"The real training begins when you push past what you think is your limit."',
    source: '\u2014 Goku, training Gohan',
  },
];

export const SCIENCE_CARDS: readonly Feature[] = [
  {
    icon: (
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="mx-auto"
      >
        <path d="M23 6l-9.5 9.5-5-5L1 18" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17 6h6v6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Progressive Overload',
    desc: "Weight goes up when you're ready. Not before, not after. The program decides.",
  },
  {
    icon: (
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="mx-auto"
      >
        <path d="M12 20V10M18 20V4M6 20v-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Failure Management',
    desc: 'Missed a lift? The program adapts \u2014 adjusting volume and intensity to keep you progressing.',
  },
  {
    icon: (
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="mx-auto"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Zero Thinking',
    desc: 'Walk into the gym knowing exactly what to do. No planning, no spreadsheets, no wasted time.',
  },
];

export const METRICS: readonly Metric[] = [
  { value: '90', label: 'Workouts Planned', suffix: '' },
  { value: '6', label: 'Core Lifts Tracked', suffix: '' },
  { value: '3', label: 'Tier System', suffix: 'tiers' },
];

export const PERSONAS: readonly Persona[] = [
  {
    icon: (
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M12 2a10 10 0 1 0 10 10" strokeLinecap="round" />
        <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Beginners',
    desc: 'No experience needed. The program tells you exactly what to do every session \u2014 just follow along.',
  },
  {
    icon: (
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M6 18L18 6M8 6h10v10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Intermediate Lifters',
    desc: 'Break through plateaus with structured periodization. The tier system adapts when you stall.',
  },
  {
    icon: (
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path
          d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: 'Program Hoppers',
    desc: 'Stop jumping between programs. Stick with one proven system and watch the numbers climb.',
  },
];
