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
  readonly badge: string;
  /** Eyebrow / kicker line above the headline */
  readonly kicker: string;
  readonly line1: string;
  readonly line2: string;
  readonly subtitle: string;
  readonly primaryCta: string;
  readonly secondaryCta: string;
  /** Tertiary CTA that enters guest mode directly (no account) */
  readonly guestCta: string;
  /** Small reassurance text below the primary CTA button */
  readonly microcopy: string;
  /** Social-proof pills rendered beneath the hero copy */
  readonly proofItems: readonly ProofItem[];
  /** Accessible label for the proof-pills list region */
  readonly proofListAriaLabel: string;
  /** Alt text for the hero transformation artwork */
  readonly transformationAlt: string;
  /** Visible caption under the hero artwork */
  readonly transformationCaption: string;
}

export interface MetricsContent {
  readonly ariaLabel: string;
  /** Catalog depth — driven by live programCount prop */
  readonly programs: { readonly label: string; readonly sub: string };
  /** Free access — static "100%" value */
  readonly free: { readonly label: string; readonly sub: string };
  /** Schedule flexibility — driven by live minDaysPerWeek prop */
  readonly days: { readonly prefix: string; readonly label: string; readonly sub: string };
  /** Workout coverage — driven by live totalWorkouts prop */
  readonly workouts: { readonly label: string; readonly sub: string };
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
  /** Alt text for the features artwork */
  readonly artworkAlt: string;
  /** Visible caption for the features artwork */
  readonly artworkCaption: string;
}

export interface StepItem {
  readonly num: string;
  readonly title: string;
  readonly desc: string;
  readonly quote: string;
  readonly source: string;
  readonly image: string;
}

export interface HowItWorksContent {
  readonly sectionLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly steps: readonly StepItem[];
}

export interface ScienceCardItem {
  readonly title: string;
  readonly desc: string;
}

export interface ScienceContent {
  readonly sectionLabel: string;
  readonly title: string;
  readonly body: string;
  readonly cards: readonly ScienceCardItem[];
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

/* ── Mid-page CTA banner ─────────────────────────────────────────────────── */
export interface MidPageCtaContent {
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
  readonly cta: string;
  readonly microcopy: string;
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
  /** Pricing highlight rows shown in the card table */
  readonly highlights: readonly { readonly label: string; readonly value: string }[];
  /** CTA button label */
  readonly cta: string;
  /** Microcopy below the CTA */
  readonly microcopy: string;
}

/* ── Comparison / vs-spreadsheet section ────────────────────────────────── */
export interface ComparisonRow {
  /** Feature being compared */
  readonly feature: string;
  /** Whether Gravity Room has this (true = yes, false = no) */
  readonly gravityRoom: boolean;
  /**
   * Whether each alternative has this feature.
   * Index matches `ComparisonContent.alternatives`.
   */
  readonly alternatives: readonly boolean[];
}

export interface ComparisonAlternative {
  /** Column header label, e.g. "Notas / papel" */
  readonly label: string;
  /** Short descriptor shown below the label on mobile cards */
  readonly sublabel?: string;
}

export interface ComparisonContent {
  readonly sectionLabel: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
  /** Column header for Gravity Room */
  readonly colGravityRoom: string;
  /** Screen-reader label for the "Feature" column header (visually hidden) */
  readonly featureColLabel: string;
  /** Accessible label for a "yes / available" cell */
  readonly yesLabel: string;
  /** Accessible label for a "no / not available" cell */
  readonly noLabel: string;
  /** One or more alternatives to compare against */
  readonly alternatives: readonly ComparisonAlternative[];
  readonly rows: readonly ComparisonRow[];
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
  readonly discordText: string;
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
  readonly science: ScienceContent;
  readonly midPageCta: MidPageCtaContent;
  readonly programs: ProgramsContent;
  readonly freeTrust: FreeTrustContent;
  readonly comparison: ComparisonContent;
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
    badge: '100% Gratis · Sincroniza entre Dispositivos',
    kicker: 'Tracker de fuerza e hipertrofia',
    line1: 'Tu plan de fuerza con',
    line2: 'progresión automática, gratis.',
    subtitle:
      'Programas probados. La app calcula el peso, las series y las reps. Tú solo entrenas.',
    primaryCta: 'Crear mi plan gratis →',
    secondaryCta: 'Cómo Funciona',
    guestCta: 'Pruébalo ahora, sin cuenta',
    microcopy: 'Sin tarjeta. Sin suscripción. Sin anuncios.',
    proofItems: [
      { value: '✓', label: 'Programas probados' },
      { value: '✓', label: 'Progresión automática' },
      { value: '0 €', label: 'Sin tarjeta' },
    ],
    proofListAriaLabel: 'Beneficios clave',
    transformationAlt:
      'El mismo atleta entra delgado en la Gravity Room y sale fuerte y musculoso, envuelto en un aura dorada',
    transformationCaption: 'Entra. Entrena. Sal más fuerte.',
  },
  metrics: {
    ariaLabel: 'Prueba del catálogo',
    programs: {
      label: 'Programas en el Catálogo',
      sub: 'Todos con progresión automática',
    },
    free: {
      label: 'Gratis',
      sub: 'Sin tarjeta. Sin suscripción. Sin anuncios.',
    },
    days: {
      prefix: 'Desde',
      label: 'Días por Semana',
      sub: 'Horarios que se adaptan a ti',
    },
    workouts: {
      label: 'Entrenamientos en el Catálogo',
      sub: 'Sesiones listas para ejecutar',
    },
  },
  problem: {
    sectionLabel: 'El Problema',
    eyebrow: '¿Te suena familiar?',
    title: 'Entrenar sin un plan es perder el tiempo.',
    body: 'La mayoría improvisa. Por eso no progresa.',
    items: [
      {
        label: 'Hojas de cálculo imposibles',
        desc: 'Calcular a mano es lento y falla.',
      },
      {
        label: 'Programas en PDF que no se adaptan',
        desc: 'Un PDF no se entera si fallas.',
      },
      {
        label: 'Apps genéricas sin progresión real',
        desc: 'Registrar no es progresar.',
      },
      {
        label: 'Motivación que se agota',
        desc: 'Sin progreso visible, abandonas.',
      },
    ],
    resolution: 'Gravity Room lo automatiza todo: elige programa, registra y progresa.',
    beforeLabel: 'Improvisar',
    afterLabel: 'Programa calculado',
    solutionLabel: 'Con Gravity Room',
    solutionItems: [
      'Progresión automática según tu rendimiento',
      'Sin hojas de cálculo ni cálculos manuales',
      'El programa se adapta si fallas repeticiones',
      'Historial y gráficas de fuerza en tiempo real',
    ],
  },
  features: {
    sectionLabel: 'Características',
    title: 'Entrena más. Piensa menos.',
    subtitle: 'Cada función te quita trabajo.',
    items: [
      {
        title: 'Nunca calcules el peso otra vez',
        desc: 'La app sube el peso si completas y lo baja si fallas.',
      },
      {
        title: 'Empieza a entrenar en 2 minutos',
        desc: 'Elige programa, pon tus pesos y listo.',
      },
      {
        title: 'Ve exactamente cuánto has mejorado',
        desc: 'Tu gráfica de fuerza, semana a semana.',
      },
      {
        title: 'Tu historial te sigue a todas partes',
        desc: 'Móvil u ordenador, siempre sincronizado.',
      },
    ],
    artworkAlt:
      'El atleta entrena a máximo esfuerzo con la barra dentro de la cámara de gravedad, envuelto en luz dorada',
    artworkCaption: 'Tú solo entrenas.',
  },
  howItWorks: {
    sectionLabel: 'Cómo Funciona',
    title: 'De cero a entrenando en tres pasos.',
    subtitle: 'Tú registras. La app calcula lo siguiente.',
    steps: [
      {
        num: '01',
        title: 'Elige tu programa e introduce tus pesos',
        desc: 'Elige el programa que encaje contigo y escribe tus pesos de partida. Tu plan aparece al instante.',
        quote: 'Gravity Room construye el plan; tú solo apareces.',
        source: '\u2014 Gravity Room',
        image: '/howit-choose.webp',
      },
      {
        num: '02',
        title: 'Sigue las instrucciones de cada sesión',
        desc: 'Cada sesión te dice ejercicio, series, reps y peso. Registra el resultado en segundos.',
        quote: 'Sin adivinar. Sin calcular. Solo entrenar.',
        source: '\u2014 Gravity Room',
        image: '/howit-train.webp',
      },
      {
        num: '03',
        title: 'La app ajusta la siguiente sesión',
        desc: '¿Completaste? El peso sube. ¿Fallaste? Se ajusta. El programa siempre sabe qué toca.',
        quote: 'Progresión real, sin intervención manual.',
        source: '\u2014 Gravity Room',
        image: '/howit-progress.webp',
      },
    ],
  },
  science: {
    sectionLabel: 'Por Qué Funciona',
    title: 'El método detrás de los programas.',
    body: 'Tres principios con décadas de resultados. La app los aplica por ti en cada sesión.',
    cards: [
      {
        title: 'Sobrecarga Progresiva',
        desc: 'El peso sube solo cuando completas. Sin atajos, sin estancarte.',
      },
      {
        title: 'Manejo del Fallo',
        desc: '¿Fallas? La carga baja y la progresión continúa desde ahí.',
      },
      {
        title: 'Sin Fatiga de Decisión',
        desc: 'Ejercicio, peso y reps ya calculados. Entra y ejecuta.',
      },
    ],
  },
  midPageCta: {
    eyebrow: 'Empieza hoy',
    title: 'Tu primera semana puede estar lista en 2 minutos.',
    body: 'Elige programa, pon tus pesos y entrena. Gratis, sin tarjeta.',
    cta: 'Crear mi plan gratis →',
    microcopy: 'Sin tarjeta · Sin suscripción',
  },
  programs: {
    sectionLabel: 'Catálogo de Programas',
    title: 'Programas probados, listos para empezar.',
    subtitle: 'Elige el que encaje con tu nivel. La app hace el resto.',
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
    title: 'Gratis de verdad. Sin trampa.',
    body: 'Sin anuncios y sin vender tus datos. Hecha por y para atletas.',
    highlights: [
      { label: 'Precio', value: '0 €' },
      { label: 'Tarjeta de crédito', value: 'No' },
      { label: 'Suscripción', value: 'No' },
      { label: 'Listo en', value: '2 minutos' },
    ],
    cta: 'Crear mi plan gratis →',
    microcopy: 'Sin tarjeta · Sin suscripción · Sin anuncios',
    items: [
      {
        title: 'Gratis de verdad',
        desc: 'Todos los programas, sin tarjeta ni suscripción.',
      },
      {
        title: 'Sin anuncios',
        desc: 'Nada interrumpe tu entrenamiento.',
      },
      {
        title: 'Tus datos son tuyos',
        desc: 'Exporta o borra tu cuenta cuando quieras.',
      },
      {
        title: 'Código abierto',
        desc: 'Código público: audítalo o haz un fork.',
      },
    ],
  },
  comparison: {
    sectionLabel: 'Comparativa',
    eyebrow: 'Gravity Room vs. el resto',
    title: '¿Por qué no usar una hoja de cálculo?',
    body: 'Notas, hojas y trackers no se adaptan a ti. Gravity Room sí.',
    colGravityRoom: 'Gravity Room',
    featureColLabel: 'Característica',
    yesLabel: 'Sí',
    noLabel: 'No',
    alternatives: [
      { label: 'Notas / papel', sublabel: 'Cuaderno o app de notas' },
      { label: 'Hoja de cálculo', sublabel: 'Excel, Google Sheets…' },
      { label: 'Tracker genérico', sublabel: 'Apps de registro sin progresión' },
    ],
    rows: [
      {
        feature: 'Te dice qué hacer hoy',
        gravityRoom: true,
        alternatives: [false, false, false],
      },
      {
        feature: 'Ajusta la carga tras un fallo',
        gravityRoom: true,
        alternatives: [false, false, false],
      },
      {
        feature: 'Incluye programas probados',
        gravityRoom: true,
        alternatives: [false, false, false],
      },
      {
        feature: 'Historial y sincronización entre dispositivos',
        gravityRoom: true,
        alternatives: [false, false, false],
      },
      {
        feature: 'Gratis, sin tarjeta ni suscripción',
        gravityRoom: true,
        alternatives: [true, true, false],
      },
    ],
  },
  faq: {
    sectionLabel: 'Dudas comunes',
    title: 'Preguntas Frecuentes',
    items: FAQ_ITEMS_ES,
  },
  finalCta: {
    eyebrow: '¿Listo para subir la gravedad?',
    line1: 'Tu plan de fuerza,',
    line2: 'gratis y listo en 2 minutos.',
    discordText: 'Únete a la comunidad en',
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
    badge: '100% Free · Syncs Across Devices',
    kicker: 'Strength & hypertrophy tracker',
    line1: 'Your strength plan with',
    line2: 'automatic progression, free.',
    subtitle: 'Proven programs. The app calculates weight, sets, and reps. You just train.',
    primaryCta: 'Create my free plan →',
    secondaryCta: 'How It Works',
    guestCta: 'Try it now, no account',
    microcopy: 'No card. No subscription. No ads.',
    proofItems: [
      { value: '✓', label: 'Proven programs' },
      { value: '✓', label: 'Auto progression' },
      { value: '$0', label: 'No card needed' },
    ],
    proofListAriaLabel: 'Key benefits',
    transformationAlt:
      'The same athlete walks into the Gravity Room skinny and walks out strong and muscular, surrounded by a golden aura',
    transformationCaption: 'Walk in. Train. Walk out stronger.',
  },
  metrics: {
    ariaLabel: 'Catalog proof',
    programs: {
      label: 'Programs in Catalog',
      sub: 'All with automatic progression',
    },
    free: {
      label: 'Free',
      sub: 'No card. No subscription. No ads.',
    },
    days: {
      prefix: 'From',
      label: 'Days Per Week',
      sub: 'Schedules that fit your life',
    },
    workouts: {
      label: 'Workouts in Catalog',
      sub: 'Sessions ready to run',
    },
  },
  problem: {
    sectionLabel: 'The Problem',
    eyebrow: 'Sound familiar?',
    title: 'Training without a plan is wasted effort.',
    body: "Most people improvise. That's why they don't progress.",
    items: [
      {
        label: 'Impossible spreadsheets',
        desc: 'Calculating by hand is slow and error-prone.',
      },
      {
        label: "PDF programs that don't adapt",
        desc: "A PDF doesn't know when you fail.",
      },
      {
        label: 'Generic apps with no real progression',
        desc: "Logging isn't progressing.",
      },
      {
        label: 'Motivation that runs out',
        desc: 'Without visible progress, you quit.',
      },
    ],
    resolution: 'Gravity Room automates all of it: pick a program, log, progress.',
    beforeLabel: 'Improvising',
    afterLabel: 'Calculated program',
    solutionLabel: 'With Gravity Room',
    solutionItems: [
      'Automatic progression based on your performance',
      'No spreadsheets or manual calculations',
      'Program adapts when you miss reps',
      'Strength history and charts in real time',
    ],
  },
  features: {
    sectionLabel: 'Features',
    title: 'Train more. Think less.',
    subtitle: 'Every feature removes work.',
    items: [
      {
        title: 'Never calculate a weight again',
        desc: 'The app adds weight when you hit and drops it when you miss.',
      },
      {
        title: 'Go from zero to training in 2 minutes',
        desc: 'Pick a program, enter your weights, done.',
      },
      {
        title: "See exactly how much stronger you've gotten",
        desc: 'Your strength chart, week by week.',
      },
      {
        title: 'Your history follows you everywhere',
        desc: 'Phone or laptop, always in sync.',
      },
    ],
    artworkAlt:
      'The athlete trains at maximum effort with a barbell inside the gravity chamber, bathed in golden light',
    artworkCaption: 'You just train.',
  },
  howItWorks: {
    sectionLabel: 'How It Works',
    title: 'From zero to training in three steps.',
    subtitle: "You log. The app calculates what's next.",
    steps: [
      {
        num: '01',
        title: 'Pick your program and enter starting weights',
        desc: 'Choose the program that fits you and enter your starting weights. Your plan appears instantly.',
        quote: 'Gravity Room builds the plan; you just show up.',
        source: '\u2014 Gravity Room',
        image: '/howit-choose.webp',
      },
      {
        num: '02',
        title: "Follow each session's instructions",
        desc: 'Each session shows exercise, sets, reps, and weight. Log the result in seconds.',
        quote: 'No guessing. No calculating. Just training.',
        source: '\u2014 Gravity Room',
        image: '/howit-train.webp',
      },
      {
        num: '03',
        title: 'The app adjusts your next session',
        desc: "Hit your reps? Weight goes up. Miss? It adjusts. The program always knows what's next.",
        quote: 'Real progression, zero manual intervention.',
        source: '\u2014 Gravity Room',
        image: '/howit-progress.webp',
      },
    ],
  },
  science: {
    sectionLabel: 'Why It Works',
    title: 'The method behind the programs.',
    body: 'Three principles with decades of results. The app applies them for you every session.',
    cards: [
      {
        title: 'Progressive Overload',
        desc: 'Weight goes up only when you complete. No shortcuts, no stalling.',
      },
      {
        title: 'Failure Handling',
        desc: 'Miss? The load drops and progression continues from there.',
      },
      {
        title: 'No Decision Fatigue',
        desc: 'Exercise, weight, and reps already calculated. Walk in and execute.',
      },
    ],
  },
  midPageCta: {
    eyebrow: 'Start today',
    title: 'Your first week can be ready in 2 minutes.',
    body: 'Pick a program, enter your weights, train. Free, no card.',
    cta: 'Create my free plan →',
    microcopy: 'No card · No subscription',
  },
  programs: {
    sectionLabel: 'Program Catalog',
    title: 'Proven programs, ready to start.',
    subtitle: 'Pick the one that fits your level. The app does the rest.',
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
    title: 'Actually free. No catch.',
    body: "No ads, and we don't sell your data. Built by and for athletes.",
    highlights: [
      { label: 'Price', value: '$0' },
      { label: 'Credit card', value: 'No' },
      { label: 'Subscription', value: 'No' },
      { label: 'Ready in', value: '2 minutes' },
    ],
    cta: 'Create my free plan →',
    microcopy: 'No card · No subscription · No ads',
    items: [
      {
        title: 'Actually free',
        desc: 'Every program, no card or subscription.',
      },
      {
        title: 'No ads',
        desc: 'Nothing interrupts your training.',
      },
      {
        title: 'Your data is yours',
        desc: 'Export or delete your account anytime.',
      },
      {
        title: 'Open source',
        desc: 'Public code: audit it or fork it.',
      },
    ],
  },
  comparison: {
    sectionLabel: 'Comparison',
    eyebrow: 'Gravity Room vs. the rest',
    title: 'Why not just use a spreadsheet?',
    body: "Notes, sheets, and trackers don't adapt to you. Gravity Room does.",
    colGravityRoom: 'Gravity Room',
    featureColLabel: 'Feature',
    yesLabel: 'Yes',
    noLabel: 'No',
    alternatives: [
      { label: 'Notes / paper', sublabel: 'Notebook or notes app' },
      { label: 'Spreadsheet', sublabel: 'Excel, Google Sheets…' },
      { label: 'Generic tracker', sublabel: 'Log apps without progression' },
    ],
    rows: [
      {
        feature: 'Tells you what to do today',
        gravityRoom: true,
        alternatives: [false, false, false],
      },
      {
        feature: 'Adjusts load after a missed set',
        gravityRoom: true,
        alternatives: [false, false, false],
      },
      {
        feature: 'Includes proven programs',
        gravityRoom: true,
        alternatives: [false, false, false],
      },
      {
        feature: 'History & cross-device sync',
        gravityRoom: true,
        alternatives: [false, false, false],
      },
      {
        feature: 'Free, no card or subscription',
        gravityRoom: true,
        alternatives: [true, true, false],
      },
    ],
  },
  faq: {
    sectionLabel: 'Common questions',
    title: 'Frequently Asked Questions',
    items: FAQ_ITEMS_EN,
  },
  finalCta: {
    eyebrow: 'Ready to raise the gravity?',
    line1: 'Your strength plan,',
    line2: 'free and ready in 2 minutes.',
    discordText: 'Join the community on',
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
