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
  /** Alt text for the product preview screenshot */
  readonly previewAlt: string;
  /** Accessible caption label for the preview image region */
  readonly previewCaption: string;
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

/* ── Product preview UI labels ───────────────────────────────────────────── */
export interface ProductPreviewContent {
  /** Label for the workout/program name area, e.g. "Workout" */
  readonly programLabel: string;
  /** Label for the day counter, e.g. "Day 1" */
  readonly dayLabel: string;
  /** Label for the week counter, e.g. "Week 4" */
  readonly weekLabel: string;
  /** Status badge text, e.g. "Active" */
  readonly statusLabel: string;
  /** Name of the exercise shown in the preview card, e.g. "Main Lift" */
  readonly exerciseLabel: string;
  /** Weight display, e.g. "80 kg" */
  readonly weightLabel: string;
  /** Aria label for the set grid, e.g. "Sets: 3 completed, 2 remaining" */
  readonly setsAriaLabel: string;
  /** Aria label for a completed set, receives set number, e.g. "Set 1 complete" */
  readonly setCompletedAriaFn: (n: number) => string;
  /** Aria label for a pending set, receives set number, e.g. "Set 2 pending" */
  readonly setPendingAriaFn: (n: number) => string;
  /** Aria label for the progress bar, e.g. "Strength progress" */
  readonly progressAriaLabel: string;
  /** Progress note shown next to the bar, e.g. "+10 kg since start" */
  readonly progressNote: string;
  /** Feature icon alt texts (4 items, matching feature order) */
  readonly featureIconAlts: readonly [string, string, string, string];
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
  readonly productPreview: ProductPreviewContent;
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
      'Sigue programas probados de fuerza e hipertrofia sin hojas de cálculo ni adivinanzas. La app calcula el peso, las series y las repeticiones — tú solo entrenas.',
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
    previewAlt: 'Captura de pantalla de Gravity Room mostrando un entrenamiento activo',
    previewCaption: 'Vista previa de la aplicación',
  },
  metrics: {
    ariaLabel: 'Prueba del catálogo',
    programs: {
      label: 'Programas en el Catálogo',
      sub: 'Fuerza e hipertrofia, todos con progresión automática',
    },
    free: {
      label: 'Gratis',
      sub: 'Sin tarjeta. Sin suscripción. Sin anuncios.',
    },
    days: {
      prefix: 'Desde',
      label: 'Días por Semana',
      sub: 'Horarios flexibles para cualquier estilo de vida',
    },
    workouts: {
      label: 'Entrenamientos en el Catálogo',
      sub: 'Cobertura completa de sesiones estructuradas',
    },
  },
  problem: {
    sectionLabel: 'El Problema',
    eyebrow: '¿Te suena familiar?',
    title: 'Entrenar sin un plan es perder el tiempo.',
    body: 'La mayoría de las personas que van al gimnasio no progresan porque improvisan. Sin estructura, sin progresión, sin resultados.',
    items: [
      {
        label: 'Hojas de cálculo imposibles',
        desc: 'Calcular pesos y progresiones a mano es tedioso y propenso a errores.',
      },
      {
        label: 'Programas en PDF que no se adaptan',
        desc: 'Un PDF no sabe si fallaste las repeticiones ni ajusta el peso por ti.',
      },
      {
        label: 'Apps genéricas sin progresión real',
        desc: 'Registrar pesos está bien, pero sin reglas de progresión integradas no avanzas.',
      },
      {
        label: 'Motivación que se agota',
        desc: 'Sin ver progreso claro, es fácil perder el rumbo y abandonar.',
      },
    ],
    resolution:
      'Gravity Room automatiza todo eso. Elige un programa, registra tus entrenamientos y deja que la app gestione la progresión.',
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
    subtitle: 'Cada función existe para quitarte trabajo — no para añadirte pasos.',
    items: [
      {
        title: 'Nunca calcules el peso otra vez',
        desc: 'La app sube el peso cuando completas las series y lo reduce si fallas. Tú solo registras el resultado.',
      },
      {
        title: 'Empieza a entrenar en 2 minutos',
        desc: 'Elige un programa del catálogo, introduce tus pesos de partida y tu plan completo está listo al instante.',
      },
      {
        title: 'Ve exactamente cuánto has mejorado',
        desc: 'Cada sesión queda registrada. La gráfica de fuerza muestra tu progreso real semana a semana.',
      },
      {
        title: 'Tu historial te sigue a todas partes',
        desc: 'Abre la app en el móvil o en el ordenador — tus datos y tu progresión están siempre sincronizados.',
      },
    ],
  },
  howItWorks: {
    sectionLabel: 'Cómo Funciona',
    title: 'De cero a entrenando en tres pasos.',
    subtitle:
      'Elige un programa, introduce tus pesos de partida y registra cada sesión. La app calcula lo que toca la próxima vez.',
    steps: [
      {
        num: '01',
        title: 'Elige tu programa e introduce tus pesos',
        desc: 'Selecciona el programa que encaje con tus objetivos y escribe los pesos con los que empiezas. La app genera tu plan completo al instante — sin hojas de cálculo.',
        quote: 'Gravity Room construye el plan; tú solo apareces.',
        source: '\u2014 Gravity Room',
        image: '/howit-choose.webp',
      },
      {
        num: '02',
        title: 'Sigue las instrucciones de cada sesión',
        desc: 'Cada entrenamiento te indica el ejercicio, las series, las repeticiones y el peso exacto. Registra el resultado — completado, fallado o AMRAP — en segundos.',
        quote: 'Sin adivinar. Sin calcular. Solo entrenar.',
        source: '\u2014 Gravity Room',
        image: '/howit-train.webp',
      },
      {
        num: '03',
        title: 'La app ajusta la siguiente sesión',
        desc: 'Completaste las reps → el peso sube. Fallaste → la carga se reduce automáticamente. El programa siempre sabe qué toca después.',
        quote: 'Progresión real, sin intervención manual.',
        source: '\u2014 Gravity Room',
        image: '/howit-progress.webp',
      },
    ],
  },
  science: {
    sectionLabel: 'Por Qué Funciona',
    title: 'El método detrás de los programas.',
    body: 'Los programas del catálogo están construidos sobre tres principios que llevan décadas funcionando en el entrenamiento de fuerza. No son teoría — son las reglas que la app aplica automáticamente en cada sesión.',
    cards: [
      {
        title: 'Sobrecarga Progresiva',
        desc: 'El peso sube solo cuando completas las series. Sin saltar pasos, sin estancarte por subir demasiado rápido.',
      },
      {
        title: 'Manejo del Fallo',
        desc: 'Si no completas las repeticiones, el programa reduce la carga y retoma la progresión desde ahí. No pierdes el hilo — el programa lo gestiona.',
      },
      {
        title: 'Sin Fatiga de Decisión',
        desc: 'Cada sesión ya tiene el ejercicio, el peso y las repeticiones calculados. Entras al gimnasio y ejecutas — sin improvisar ni calcular.',
      },
    ],
  },
  midPageCta: {
    eyebrow: 'Empieza hoy',
    title: 'Tu primera semana puede estar lista en 2 minutos.',
    body: 'Elige un programa, introduce tus pesos de partida y la app genera tu plan completo al instante — gratis, sin tarjeta.',
    cta: 'Crear mi plan gratis →',
    microcopy: 'Sin tarjeta · Sin suscripción',
  },
  programs: {
    sectionLabel: 'Catálogo de Programas',
    title: 'Programas probados, listos para empezar.',
    subtitle:
      'Cada programa del catálogo incluye reglas de progresión integradas. Elige el que encaje con tu nivel y frecuencia — la app hace el resto.',
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
    body: 'Gravity Room no vende tus datos y no tiene anuncios. Es una herramienta construida por y para atletas.',
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
        desc: 'Sin tarjeta de crédito. Sin suscripción para empezar. Accede a todos los programas disponibles.',
      },
      {
        title: 'Sin anuncios',
        desc: 'La app no tiene publicidad. Tu experiencia de entrenamiento no se interrumpe.',
      },
      {
        title: 'Tus datos son tuyos',
        desc: 'No vendemos ni compartimos tu información. Puedes exportar o eliminar tu cuenta en cualquier momento.',
      },
      {
        title: 'Código abierto',
        desc: 'El código es público. Puedes auditarlo, contribuir o hacer un fork si quieres.',
      },
    ],
  },
  comparison: {
    sectionLabel: 'Comparativa',
    eyebrow: 'Gravity Room vs. el resto',
    title: '¿Por qué no usar una hoja de cálculo?',
    body: 'Notas, hojas de cálculo y trackers genéricos no se adaptan a tu rendimiento. Gravity Room sí.',
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
  productPreview: {
    programLabel: 'Entrenamiento · 5×5+',
    dayLabel: 'Día 1',
    weekLabel: 'Semana 4',
    statusLabel: 'Activo',
    exerciseLabel: 'Ejercicio Principal',
    weightLabel: '80 kg',
    setsAriaLabel: 'Series: 3 completadas, 2 pendientes',
    setCompletedAriaFn: (n) => `Serie ${n} completada`,
    setPendingAriaFn: (n) => `Serie ${n} pendiente`,
    progressAriaLabel: 'Progreso de fuerza',
    progressNote: '+10 kg desde el inicio',
    featureIconAlts: [
      'Icono de progresión automática',
      'Icono de seguimiento de ejercicios',
      'Icono de estadísticas',
      'Icono de sincronización',
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
    subtitle:
      'Follow proven strength and hypertrophy programs without spreadsheets or guesswork. The app calculates weight, sets, and reps — you just train.',
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
    previewAlt: 'Gravity Room screenshot showing an active workout session',
    previewCaption: 'App preview',
  },
  metrics: {
    ariaLabel: 'Catalog proof',
    programs: {
      label: 'Programs in Catalog',
      sub: 'Strength & hypertrophy, all with automatic progression',
    },
    free: {
      label: 'Free',
      sub: 'No card. No subscription. No ads.',
    },
    days: {
      prefix: 'From',
      label: 'Days Per Week',
      sub: 'Flexible schedules for any lifestyle',
    },
    workouts: {
      label: 'Workouts in Catalog',
      sub: 'Full coverage of structured sessions',
    },
  },
  problem: {
    sectionLabel: 'The Problem',
    eyebrow: 'Sound familiar?',
    title: 'Training without a plan is wasted effort.',
    body: "Most people who go to the gym don't make progress because they improvise. No structure, no progression, no results.",
    items: [
      {
        label: 'Impossible spreadsheets',
        desc: 'Calculating weights and progressions by hand is tedious and error-prone.',
      },
      {
        label: "PDF programs that don't adapt",
        desc: "A PDF doesn't know if you missed reps or adjust the weight for you.",
      },
      {
        label: 'Generic apps with no real progression',
        desc: "Logging weights is fine, but without built-in progression rules you don't advance.",
      },
      {
        label: 'Motivation that runs out',
        desc: "Without seeing clear progress, it's easy to lose direction and quit.",
      },
    ],
    resolution:
      'Gravity Room automates all of that. Pick a program, log your workouts, and let the app handle progression.',
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
    subtitle: 'Every feature exists to remove work from your plate — not add steps.',
    items: [
      {
        title: 'Never calculate a weight again',
        desc: 'The app adds weight when you hit your sets and drops it when you miss. You just log the result.',
      },
      {
        title: 'Go from zero to training in 2 minutes',
        desc: 'Pick a program from the catalog, enter your starting weights, and your full plan is ready instantly.',
      },
      {
        title: "See exactly how much stronger you've gotten",
        desc: 'Every session is logged. Your strength chart shows real progress week by week — no guessing.',
      },
      {
        title: 'Your history follows you everywhere',
        desc: 'Open the app on your phone or laptop — your data and progression are always in sync.',
      },
    ],
  },
  howItWorks: {
    sectionLabel: 'How It Works',
    title: 'From zero to training in three steps.',
    subtitle:
      'Pick a program, enter your starting weights, and log each session. The app calculates what comes next.',
    steps: [
      {
        num: '01',
        title: 'Pick your program and enter starting weights',
        desc: "Choose the program that fits your goals and type in the weights you're starting with. The app builds your full plan instantly — no spreadsheet needed.",
        quote: 'Gravity Room builds the plan; you just show up.',
        source: '\u2014 Gravity Room',
        image: '/howit-choose.webp',
      },
      {
        num: '02',
        title: "Follow each session's instructions",
        desc: 'Every workout shows you the exercise, sets, reps, and exact weight. Log the result — completed, failed, or AMRAP — in seconds.',
        quote: 'No guessing. No calculating. Just training.',
        source: '\u2014 Gravity Room',
        image: '/howit-train.webp',
      },
      {
        num: '03',
        title: 'The app adjusts your next session',
        desc: 'Hit your reps → weight goes up. Miss them → load drops automatically. The program always knows what comes next.',
        quote: 'Real progression, zero manual intervention.',
        source: '\u2014 Gravity Room',
        image: '/howit-progress.webp',
      },
    ],
  },
  science: {
    sectionLabel: 'Why It Works',
    title: 'The method behind the programs.',
    body: 'The programs in the catalog are built on three principles that have worked in strength training for decades. Not theory — these are the rules the app applies automatically every session.',
    cards: [
      {
        title: 'Progressive Overload',
        desc: 'Weight goes up only when you complete your sets. No skipping steps, no stalling from jumping too fast.',
      },
      {
        title: 'Failure Handling',
        desc: "Miss your reps? The program drops the load and resumes progression from there. You don't lose your place — the program manages it.",
      },
      {
        title: 'No Decision Fatigue',
        desc: 'Every session already has the exercise, weight, and reps calculated. Walk in and execute — no improvising, no calculating.',
      },
    ],
  },
  midPageCta: {
    eyebrow: 'Start today',
    title: 'Your first week can be ready in 2 minutes.',
    body: 'Pick a program, enter your starting weights, and the app builds your full plan instantly — free, no card needed.',
    cta: 'Create my free plan →',
    microcopy: 'No card · No subscription',
  },
  programs: {
    sectionLabel: 'Program Catalog',
    title: 'Proven programs, ready to start.',
    subtitle:
      'Every program in the catalog has built-in progression rules. Pick the one that fits your level and schedule — the app handles the rest.',
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
    body: "Gravity Room doesn't sell your data and has no ads. It's a tool built by and for athletes.",
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
        desc: 'No credit card. No subscription to get started. Access all available programs.',
      },
      {
        title: 'No ads',
        desc: 'The app has no advertising. Your training experience is never interrupted.',
      },
      {
        title: 'Your data is yours',
        desc: "We don't sell or share your information. You can export or delete your account at any time.",
      },
      {
        title: 'Open source',
        desc: 'The code is public. You can audit it, contribute, or fork it if you want.',
      },
    ],
  },
  comparison: {
    sectionLabel: 'Comparison',
    eyebrow: 'Gravity Room vs. the rest',
    title: 'Why not just use a spreadsheet?',
    body: "Notes, spreadsheets, and generic trackers don't adapt to your performance. Gravity Room does.",
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
  productPreview: {
    programLabel: 'Workout · 5×5+',
    dayLabel: 'Day 1',
    weekLabel: 'Week 4',
    statusLabel: 'Active',
    exerciseLabel: 'Main Lift',
    weightLabel: '80 kg',
    setsAriaLabel: 'Sets: 3 completed, 2 remaining',
    setCompletedAriaFn: (n) => `Set ${n} complete`,
    setPendingAriaFn: (n) => `Set ${n} pending`,
    progressAriaLabel: 'Strength progress',
    progressNote: '+10 kg since start',
    featureIconAlts: [
      'Automatic progression icon',
      'Exercise tracking icon',
      'Statistics icon',
      'Synchronization icon',
    ],
  },
  skipLabel: 'Skip to content',
  langSwitch: { label: 'Versión en Español →', href: '/' },
};
