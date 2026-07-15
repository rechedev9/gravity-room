/* ── Landing page content types ─────────────────────────────────────────────
 * All translatable strings for every section are defined here.
 * ES_CONTENT and EN_CONTENT are consumed by LandingPage (/) and
 * LandingPageEn (/en) respectively. Section components accept these as props.
 *
 * FAQ items live in `./faq-content` — single source of truth shared between
 * the rendered FAQ section and the FAQPage JSON-LD generator.
 * ─────────────────────────────────────────────────────────────────────────── */

import { FAQ_ITEMS_EN, FAQ_ITEMS_ES } from './faq-content';

export interface NavLink {
  readonly label: string;
  readonly href: string;
}

export interface NavContent {
  readonly navLabel: string;
  readonly links: readonly NavLink[];
  readonly discordAriaLabel: string;
  readonly signInLabel: string;
  readonly openMenuLabel: string;
  readonly closeMenuLabel: string;
}

/* ── Proof / social-proof pill shown in hero ─────────────────────────────── */
export interface ProofItem {
  /** Short numeric or symbolic value, e.g. "500+" */
  readonly value: string;
  /** Human-readable label, e.g. "athletes tracking" */
  readonly label: string;
}

export interface HeroContent {
  /** Eyebrow / kicker line above the headline */
  readonly kicker: string;
  readonly line1: string;
  readonly line2: string;
  readonly subtitle: string;
  readonly primaryCta: string;
  readonly secondaryCta: string;
  /** Small reassurance text below the primary CTA button */
  readonly microcopy: string;
  /** Social-proof pills rendered beneath the hero copy */
  readonly proofItems: readonly ProofItem[];
  /** Accessible label for the proof-pills list region */
  readonly proofListAriaLabel: string;
  /** Accessible label and visible copy for the interactive physique comparison */
  readonly transformationControlLabel: string;
  readonly transformationHint: string;
  readonly transformationBefore: string;
  readonly transformationAfter: string;
}

export interface MetricsContent {
  readonly ariaLabel: string;
  /** Catalog depth — driven by live programCount prop */
  readonly programs: { readonly label: string };
  /** Free access — static "100%" value */
  readonly free: { readonly label: string };
  /** Schedule flexibility — driven by live minDaysPerWeek prop */
  readonly days: { readonly prefix: string; readonly label: string };
  /** Workout coverage — driven by live totalWorkouts prop */
  readonly workouts: { readonly label: string };
}

export interface FeatureItem {
  readonly title: string;
  readonly desc: string;
}

export interface FeaturesContent {
  readonly sectionLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly items: readonly FeatureItem[];
}

export interface StepItem {
  readonly num: string;
  readonly title: string;
  readonly desc: string;
}

export interface HowItWorksContent {
  readonly sectionLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly steps: readonly StepItem[];
}

export interface ProgramsContent {
  readonly sectionLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly by: string;
  readonly levelLabels: {
    readonly beginner: string;
    readonly intermediate: string;
    readonly advanced: string;
  };
  readonly daysPerWeek: string;
  readonly weeks: string;
  readonly errorText: string;
  readonly moreProgramsFn: (count: number) => string;
}

/* ── Problem / pain-point narrative section ──────────────────────────────── */
export interface ProblemItem {
  /** Short pain-point label */
  readonly label: string;
  /** One-sentence elaboration */
  readonly desc: string;
}

export interface ProblemContent {
  readonly sectionLabel: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
  /** 3–4 pain-point bullets */
  readonly items: readonly ProblemItem[];
  /** Transition / resolution statement at the bottom of the section */
  readonly resolution: string;
  /** Label for the "before" pill in the before→after transition row */
  readonly beforeLabel: string;
  /** Label for the "after" pill in the before→after transition row */
  readonly afterLabel: string;
  /** Heading above the solution bullet list */
  readonly solutionLabel: string;
  /** Solution bullet items (same length as items) */
  readonly solutionItems: readonly string[];
}

/* ── Free / trust reassurance section ───────────────────────────────────── */
export interface FreeTrustItem {
  readonly title: string;
  readonly desc: string;
}

export interface FreeTrustContent {
  readonly sectionLabel: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
  /** 3–4 trust pillars (free, open-source, no ads, etc.) */
  readonly items: readonly FreeTrustItem[];
}

/* ── FAQ section ─────────────────────────────────────────────────────────── */
export interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

export interface FaqContent {
  readonly sectionLabel: string;
  readonly title: string;
  readonly items: readonly FaqItem[];
}

export interface FinalCtaContent {
  readonly eyebrow: string;
  readonly line1: string;
  readonly line2: string;
  readonly cta: string;
  /** Small reassurance text below the primary CTA button */
  readonly microcopy: string;
}

export interface FooterContent {
  readonly tagline: string;
  readonly navLabel: string;
  readonly communityLabel: string;
  readonly githubLabel: string;
  readonly privacyLabel: string;
  readonly cookiesLabel: string;
  readonly links: readonly NavLink[];
}

export interface LandingContent {
  readonly nav: NavContent;
  readonly hero: HeroContent;
  readonly metrics: MetricsContent;
  readonly problem: ProblemContent;
  readonly features: FeaturesContent;
  readonly howItWorks: HowItWorksContent;
  readonly programs: ProgramsContent;
  readonly freeTrust: FreeTrustContent;
  readonly faq: FaqContent;
  readonly finalCta: FinalCtaContent;
  readonly footer: FooterContent;
  readonly skipLabel: string;
  readonly langSwitch: { readonly label: string; readonly href: string };
}

/* ── Spanish content ───────────────────────────────────────────────────────── */

export const ES_CONTENT: LandingContent = {
  nav: {
    navLabel: 'Navegación principal',
    links: [
      { label: 'Cómo Funciona', href: '#how-it-works' },
      { label: 'Programas', href: '#programs' },
      { label: 'Es Gratis', href: '#free-trust' },
      { label: 'FAQ', href: '#faq' },
    ],
    discordAriaLabel: 'Únete a la comunidad en Discord',
    signInLabel: 'Iniciar Sesión →',
    openMenuLabel: 'Abrir menú',
    closeMenuLabel: 'Cerrar menú',
  },
  hero: {
    kicker: 'Tu siguiente sesión ya está calculada',
    line1: 'Entra. Entrena.',
    line2: 'Sal más fuerte.',
    subtitle:
      'Elige un programa probado. Gravity Room calcula tus pesos, series y progresión. Tú solo entrenas.',
    primaryCta: 'Crear mi plan gratis →',
    secondaryCta: 'Probar sin cuenta',
    microcopy: '0 € · Sin tarjeta · Sin anuncios',
    proofItems: [
      { value: '✓', label: 'Programas probados' },
      { value: '✓', label: 'Progresión automática' },
      { value: '0 €', label: 'Sin tarjeta' },
    ],
    proofListAriaLabel: 'Beneficios clave',
    transformationControlLabel: 'Mostrar el físico entrenado',
    transformationHint: 'Pasa el cursor o toca para ver el cambio',
    transformationBefore: 'Punto de partida',
    transformationAfter: 'Físico entrenado',
  },
  metrics: {
    ariaLabel: 'Prueba del catálogo',
    programs: {
      label: 'Programas en el Catálogo',
    },
    free: {
      label: 'Gratis',
    },
    days: {
      prefix: 'Desde',
      label: 'Días por Semana',
    },
    workouts: {
      label: 'Entrenamientos en el Catálogo',
    },
  },
  problem: {
    sectionLabel: 'Sin improvisar',
    eyebrow: 'Deja de adivinar',
    title: 'No necesitas más motivación. Necesitas saber qué toca.',
    body: 'Una hoja registra lo que hiciste. Gravity Room decide qué haces después.',
    items: [
      {
        label: 'Improvisar cada sesión',
        desc: 'Entrenas, pero no sabes si avanzas.',
      },
      {
        label: 'Calcular pesos a mano',
        desc: 'Más decisiones justo cuando deberías entrenar.',
      },
      {
        label: 'No saber si progresas',
        desc: 'Registrar números no construye un plan.',
      },
    ],
    resolution: 'Abre la app. Haz lo que toca. Sal sabiendo que avanzaste.',
    beforeLabel: '¿Qué hago hoy?',
    afterLabel: 'Tu sesión lista',
    solutionLabel: 'La diferencia',
    solutionItems: [
      'Ejercicio, series, repeticiones y peso ya calculados',
      'Si completas, sube. Si fallas, se adapta.',
      'Tu progreso queda claro semana a semana',
    ],
  },
  features: {
    sectionLabel: 'Lo importante',
    title: 'Tú solo entrenas.',
    subtitle: 'La app elimina las decisiones que frenan tu progreso.',
    items: [
      {
        title: 'Sabes qué hacer hoy',
        desc: 'Ejercicio, peso, series y repeticiones aparecen listos.',
      },
      {
        title: 'El plan se adapta contigo',
        desc: 'La carga sube cuando completas y se ajusta cuando fallas.',
      },
      {
        title: 'Ves la fuerza que has ganado',
        desc: 'Tu historial convierte cada sesión en progreso visible.',
      },
    ],
  },
  howItWorks: {
    sectionLabel: 'Cómo Funciona',
    title: 'Tu plan, listo en tres pasos.',
    subtitle: 'Tú registras. Gravity Room calcula lo siguiente.',
    steps: [
      {
        num: '01',
        title: 'Elige tu programa e introduce tus pesos',
        desc: 'Escoge el que encaja con tu nivel y tus días disponibles.',
      },
      {
        num: '02',
        title: 'Sigue las instrucciones de cada sesión',
        desc: 'La sesión te dice ejercicio, series, repeticiones y peso.',
      },
      {
        num: '03',
        title: 'La app ajusta la siguiente sesión',
        desc: 'Registra el resultado. La próxima sesión se recalcula sola.',
      },
    ],
  },
  programs: {
    sectionLabel: 'Catálogo de Programas',
    title: 'Elige tu camino. Empieza hoy.',
    subtitle: 'Programas probados para tu nivel y tus días disponibles.',
    by: 'por',
    levelLabels: { beginner: 'Principiante', intermediate: 'Intermedio', advanced: 'Avanzado' },
    daysPerWeek: 'días/semana',
    weeks: 'semanas',
    errorText: 'No se pudieron cargar los programas.',
    moreProgramsFn: (n) => `Ver los ${n} programas →`,
  },
  freeTrust: {
    sectionLabel: 'Por Qué Confiar',
    eyebrow: 'Sin letra pequeña',
    title: 'Gratis. Sin letra pequeña.',
    body: 'Sin anuncios, sin vender tus datos y sin una suscripción esperando después.',
    items: [
      {
        title: '0 €',
        desc: 'Todos los programas, sin tarjeta.',
      },
      {
        title: 'Sin anuncios',
        desc: 'Nada interrumpe tu entrenamiento.',
      },
      {
        title: 'Tus datos',
        desc: 'Exporta o borra tu cuenta cuando quieras.',
      },
      {
        title: 'Código abierto',
        desc: 'Código público: audítalo o haz un fork.',
      },
    ],
  },
  faq: {
    sectionLabel: 'Dudas comunes',
    title: 'Antes de empezar',
    items: FAQ_ITEMS_ES.filter(
      (_, index) => index === 0 || index === 2 || index === 3 || index === 8
    ),
  },
  finalCta: {
    eyebrow: 'Empieza hoy',
    line1: 'Tu próximo entrenamiento',
    line2: 'puede estar listo en 2 minutos.',
    cta: 'Crear mi plan gratis →',
    microcopy: 'Sin tarjeta · Sin suscripción · Sin anuncios',
  },
  footer: {
    tagline: 'Para atletas que se niegan a estancarse.',
    navLabel: 'Navegación',
    communityLabel: 'Comunidad',
    githubLabel: 'GitHub',
    privacyLabel: 'Privacidad',
    cookiesLabel: 'Cookies',
    links: [
      { label: 'Cómo Funciona', href: '#how-it-works' },
      { label: 'Programas', href: '#programs' },
      { label: 'Es Gratis', href: '#free-trust' },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  skipLabel: 'Ir al contenido',
  langSwitch: { label: 'English version →', href: '/en' },
};

/* ── English content ───────────────────────────────────────────────────────── */

export const EN_CONTENT: LandingContent = {
  nav: {
    navLabel: 'Main navigation',
    links: [
      { label: 'How It Works', href: '#how-it-works' },
      { label: 'Programs', href: '#programs' },
      { label: "It's Free", href: '#free-trust' },
      { label: 'FAQ', href: '#faq' },
    ],
    discordAriaLabel: 'Join the community on Discord',
    signInLabel: 'Sign In →',
    openMenuLabel: 'Open menu',
    closeMenuLabel: 'Close menu',
  },
  hero: {
    kicker: 'Your next session is already calculated',
    line1: 'Walk in. Train.',
    line2: 'Walk out stronger.',
    subtitle:
      'Pick a proven program. Gravity Room calculates your weights, sets, reps, and progression. You just train.',
    primaryCta: 'Create my free plan →',
    secondaryCta: 'Try without an account',
    microcopy: '$0 · No card · No ads',
    proofItems: [
      { value: '✓', label: 'Proven programs' },
      { value: '✓', label: 'Auto progression' },
      { value: '$0', label: 'No card needed' },
    ],
    proofListAriaLabel: 'Key benefits',
    transformationControlLabel: 'Show the trained physique',
    transformationHint: 'Hover or tap to reveal the change',
    transformationBefore: 'Starting point',
    transformationAfter: 'Trained physique',
  },
  metrics: {
    ariaLabel: 'Catalog proof',
    programs: {
      label: 'Programs in Catalog',
    },
    free: {
      label: 'Free',
    },
    days: {
      prefix: 'From',
      label: 'Days Per Week',
    },
    workouts: {
      label: 'Workouts in Catalog',
    },
  },
  problem: {
    sectionLabel: 'No more guessing',
    eyebrow: 'Stop improvising',
    title: "You don't need more motivation. You need to know what's next.",
    body: 'A spreadsheet records what you did. Gravity Room decides what you do next.',
    items: [
      {
        label: 'Improvising every session',
        desc: "You train, but you don't know whether you're moving forward.",
      },
      {
        label: 'Calculating weights by hand',
        desc: 'More decisions when you should be training.',
      },
      {
        label: "Not knowing if you're progressing",
        desc: "Logging numbers doesn't build a plan.",
      },
    ],
    resolution: 'Open the app. Do the work. Leave knowing you moved forward.',
    beforeLabel: 'What do I do today?',
    afterLabel: 'Your session is ready',
    solutionLabel: 'The difference',
    solutionItems: [
      'Exercise, sets, reps, and weight already calculated',
      'Hit your reps and it goes up. Miss and it adapts.',
      'Your progress stays clear, week after week',
    ],
  },
  features: {
    sectionLabel: 'What matters',
    title: 'You just train.',
    subtitle: 'The app removes the decisions that slow your progress.',
    items: [
      {
        title: 'Know what to do today',
        desc: 'Exercise, weight, sets, and reps are ready when you arrive.',
      },
      {
        title: 'A plan that adapts with you',
        desc: 'Load rises when you hit and adjusts when you miss.',
      },
      {
        title: "See the strength you've built",
        desc: 'Your history turns every session into visible progress.',
      },
    ],
  },
  howItWorks: {
    sectionLabel: 'How It Works',
    title: 'Your plan, ready in three steps.',
    subtitle: 'You log. Gravity Room calculates what comes next.',
    steps: [
      {
        num: '01',
        title: 'Pick your program and enter starting weights',
        desc: 'Choose one that fits your level and the days you can train.',
      },
      {
        num: '02',
        title: "Follow each session's instructions",
        desc: 'Each session gives you the exercise, sets, reps, and weight.',
      },
      {
        num: '03',
        title: 'The app adjusts your next session',
        desc: 'Log the result. Your next session recalculates itself.',
      },
    ],
  },
  programs: {
    sectionLabel: 'Program Catalog',
    title: 'Choose your path. Start today.',
    subtitle: 'Proven programs for your level and the days you can train.',
    by: 'by',
    levelLabels: { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' },
    daysPerWeek: 'days/week',
    weeks: 'weeks',
    errorText: 'Could not load programs.',
    moreProgramsFn: (n) => `See all ${n} programs →`,
  },
  freeTrust: {
    sectionLabel: 'Why Trust Us',
    eyebrow: 'No fine print',
    title: 'Free. No fine print.',
    body: 'No ads, no selling your data, and no subscription waiting for you later.',
    items: [
      {
        title: '$0',
        desc: 'Every program, no card required.',
      },
      {
        title: 'No ads',
        desc: 'Nothing interrupts your training.',
      },
      {
        title: 'Your data',
        desc: 'Export or delete your account anytime.',
      },
      {
        title: 'Open source',
        desc: 'Public code: audit it or fork it.',
      },
    ],
  },
  faq: {
    sectionLabel: 'Common questions',
    title: 'Before you start',
    items: FAQ_ITEMS_EN.filter(
      (_, index) => index === 0 || index === 2 || index === 3 || index === 8
    ),
  },
  finalCta: {
    eyebrow: 'Start today',
    line1: 'Your next workout',
    line2: 'can be ready in 2 minutes.',
    cta: 'Create my free plan →',
    microcopy: 'No card · No subscription · No ads',
  },
  footer: {
    tagline: 'For athletes who refuse to plateau.',
    navLabel: 'Navigation',
    communityLabel: 'Community',
    githubLabel: 'GitHub',
    privacyLabel: 'Privacy',
    cookiesLabel: 'Cookies',
    links: [
      { label: 'How It Works', href: '#how-it-works' },
      { label: 'Programs', href: '#programs' },
      { label: "It's Free", href: '#free-trust' },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  skipLabel: 'Skip to content',
  langSwitch: { label: 'Versión en Español →', href: '/' },
};
