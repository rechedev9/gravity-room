/* ── Landing page content types ─────────────────────────────────────────────
 * All translatable strings for every section are defined here.
 * ES_CONTENT and EN_CONTENT are consumed by LandingPage (/) and
 * LandingPageEn (/en) respectively. Section components accept these as props.
 * ─────────────────────────────────────────────────────────────────────────── */

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

export interface HeroContent {
  readonly badge: string;
  readonly line1: string;
  readonly line2: string;
  readonly subtitle: string;
  readonly primaryCta: string;
  readonly secondaryCta: string;
}

export interface MetricsContent {
  readonly ariaLabel: string;
  readonly programs: { readonly label: string };
  readonly free: { readonly label: string };
  readonly days: { readonly prefix: string; readonly label: string };
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

export interface FinalCtaContent {
  readonly eyebrow: string;
  readonly line1: string;
  readonly line2: string;
  readonly discordText: string;
  readonly cta: string;
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
  readonly features: FeaturesContent;
  readonly howItWorks: HowItWorksContent;
  readonly science: ScienceContent;
  readonly programs: ProgramsContent;
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
      { label: 'Características', href: '#features' },
      { label: 'Cómo Funciona', href: '#how-it-works' },
      { label: 'Programas', href: '#programs' },
    ],
    discordAriaLabel: 'Únete a la comunidad en Discord',
    signInLabel: 'Iniciar Sesión →',
    openMenuLabel: 'Abrir menú',
    closeMenuLabel: 'Cerrar menú',
  },
  hero: {
    badge: '100% Gratis · Sincroniza entre Dispositivos',
    line1: 'Entrena Mejor.',
    line2: 'Progresa Más Rápido.',
    subtitle:
      'Deja de adivinar en el gimnasio. Sigue programas probados que ajustan automáticamente el peso, series y repeticiones — para que cada sesión te haga avanzar.',
    primaryCta: 'Comenzar →',
    secondaryCta: 'Cómo Funciona',
  },
  metrics: {
    ariaLabel: 'Métricas del programa',
    programs: { label: 'Programas Disponibles' },
    free: { label: 'Gratis' },
    days: { prefix: 'Desde', label: 'Días por Semana' },
    workouts: { label: 'Entrenamientos' },
  },
  features: {
    sectionLabel: 'Características',
    title: 'Todo lo que Necesitas',
    subtitle: 'Sin relleno. Solo herramientas enfocadas que hacen que cada repetición cuente.',
    items: [
      {
        title: 'Progresión Inteligente',
        desc: 'La app decide cuándo agregar peso y cómo manejar el fallo. Tú solo apareces y entrenas.',
      },
      {
        title: 'Programas Probados',
        desc: 'Programas de entrenamiento respaldados por la ciencia con periodización estructurada. Nuevos programas agregados regularmente.',
      },
      {
        title: 'Estadísticas y Gráficas',
        desc: 'Ve tu curva de fuerza a lo largo del tiempo. Datos reales, no suposiciones.',
      },
      {
        title: 'Sincronización en la Nube',
        desc: 'Tus datos se sincronizan automáticamente. Entrena desde cualquier dispositivo sin perder el progreso.',
      },
    ],
  },
  howItWorks: {
    sectionLabel: 'Cómo Funciona',
    title: 'Tres Pasos. Eso es Todo.',
    subtitle: 'Sin configuración complicada. Sin hojas de cálculo. Solo elige tus pesos y entrena.',
    steps: [
      {
        num: '01',
        title: 'Elige tu Programa',
        desc: 'Selecciona el programa que se adapte a tus objetivos y configura tus pesos iniciales. La app construye tu plan completo al instante.',
        quote: '"El primer paso siempre es el más importante. Después, la gravedad hace el resto."',
        source: '\u2014 Gravity Room',
        image: '/howit-choose.webp',
      },
      {
        num: '02',
        title: 'Sigue el Programa',
        desc: 'Cada entrenamiento te dice exactamente qué hacer \u2014 ejercicio, series, repeticiones, peso. Sin adivinar.',
        quote:
          '"La disciplina es entrenar cuando la motivación ya no está. El programa nunca falla."',
        source: '\u2014 Gravity Room',
        image: '/howit-train.webp',
      },
      {
        num: '03',
        title: 'Progresa Automáticamente',
        desc: 'Completa tus reps y el peso sube. El programa se adapta a tu rendimiento para mantenerte avanzando.',
        quote: '"Cada kilo extra en la barra es gravedad que has conquistado."',
        source: '\u2014 Gravity Room',
        image: '/howit-progress.webp',
      },
    ],
  },
  science: {
    sectionLabel: 'La Ciencia',
    title: 'Por Qué el Entrenamiento Inteligente Gana',
    body: 'La mayoría se estanca porque entrena aleatoriamente. Los programas estructurados con reglas de progresión integradas son cómo realmente te vuelves más fuerte — de forma consistente.',
    cards: [
      {
        title: 'Sobrecarga Progresiva',
        desc: 'El peso sube cuando estás listo. Ni antes, ni después. El programa decide.',
      },
      {
        title: 'Adaptación Inteligente',
        desc: '¿No completaste las repeticiones? El programa ajusta la carga automáticamente para que sigas progresando sin estancarte.',
      },
      {
        title: 'Cero Pensar',
        desc: 'Entra al gimnasio sabiendo exactamente qué hacer. Sin planeación, sin hojas de cálculo, sin tiempo perdido.',
      },
    ],
  },
  programs: {
    sectionLabel: 'Catálogo',
    title: 'Elige Tu Programa',
    subtitle:
      'Programas de entrenamiento con progresión automática. Elige el que se adapte a tus objetivos.',
    by: 'por',
    levelLabels: { beginner: 'Principiante', intermediate: 'Intermedio', advanced: 'Avanzado' },
    daysPerWeek: 'días/semana',
    weeks: 'semanas',
    errorText: 'No se pudieron cargar los programas.',
    moreProgramsFn: (n) => `Ver los ${n} programas →`,
  },
  finalCta: {
    eyebrow: '¿Listo para subir la gravedad?',
    line1: 'Entra a la Gravity Room.',
    line2: 'Comienza a Entrenar Hoy.',
    discordText: 'Únete a la comunidad en',
    cta: 'Comienza Gratis →',
  },
  footer: {
    tagline: 'Para atletas que se niegan a estancarse.',
    navLabel: 'Navegación',
    communityLabel: 'Comunidad',
    githubLabel: 'GitHub',
    privacyLabel: 'Privacidad',
    cookiesLabel: 'Cookies',
    links: [
      { label: 'Características', href: '#features' },
      { label: 'Cómo Funciona', href: '#how-it-works' },
      { label: 'Programas', href: '#programs' },
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
      { label: 'Features', href: '#features' },
      { label: 'How It Works', href: '#how-it-works' },
      { label: 'Programs', href: '#programs' },
    ],
    discordAriaLabel: 'Join the community on Discord',
    signInLabel: 'Sign In →',
    openMenuLabel: 'Open menu',
    closeMenuLabel: 'Close menu',
  },
  hero: {
    badge: '100% Free · Syncs Across Devices',
    line1: 'Train Smarter.',
    line2: 'Progress Faster.',
    subtitle:
      'Stop guessing at the gym. Follow proven programs that automatically adjust weight, sets, and reps — so every session moves you forward.',
    primaryCta: 'Get Started →',
    secondaryCta: 'How It Works',
  },
  metrics: {
    ariaLabel: 'Program metrics',
    programs: { label: 'Programs Available' },
    free: { label: 'Free' },
    days: { prefix: 'From', label: 'Days Per Week' },
    workouts: { label: 'Workouts' },
  },
  features: {
    sectionLabel: 'Features',
    title: 'Everything You Need',
    subtitle: 'No fluff. Just focused tools that make every rep count.',
    items: [
      {
        title: 'Smart Progression',
        desc: 'The app decides when to add weight and how to handle failure. You just show up and train.',
      },
      {
        title: 'Proven Programs',
        desc: 'Science-backed training programs with structured periodization. New programs added regularly.',
      },
      {
        title: 'Stats & Charts',
        desc: 'See your strength curve over time. Real data, not guesses.',
      },
      {
        title: 'Cloud Sync',
        desc: 'Your data syncs automatically. Train from any device without losing progress.',
      },
    ],
  },
  howItWorks: {
    sectionLabel: 'How It Works',
    title: "Three Steps. That's It.",
    subtitle: 'No complex setup. No spreadsheets. Just pick your weights and train.',
    steps: [
      {
        num: '01',
        title: 'Choose Your Program',
        desc: 'Pick the program that fits your goals and set your starting weights. The app builds your full plan instantly.',
        quote: '"The first step is always the most important. After that, gravity does the rest."',
        source: '\u2014 Gravity Room',
        image: '/howit-choose.webp',
      },
      {
        num: '02',
        title: 'Follow the Program',
        desc: 'Every workout tells you exactly what to do \u2014 exercise, sets, reps, weight. No guessing.',
        quote: '"Discipline is training when motivation is gone. The program never fails."',
        source: '\u2014 Gravity Room',
        image: '/howit-train.webp',
      },
      {
        num: '03',
        title: 'Progress Automatically',
        desc: 'Complete your reps and the weight goes up. The program adapts to your performance to keep you moving forward.',
        quote: '"Every extra kilo on the bar is gravity you\'ve conquered."',
        source: '\u2014 Gravity Room',
        image: '/howit-progress.webp',
      },
    ],
  },
  science: {
    sectionLabel: 'The Science',
    title: 'Why Smart Training Wins',
    body: 'Most people plateau because they train randomly. Structured programs with built-in progression rules are how you actually get stronger \u2014 consistently.',
    cards: [
      {
        title: 'Progressive Overload',
        desc: "Weight goes up when you're ready. Not before, not after. The program decides.",
      },
      {
        title: 'Smart Adaptation',
        desc: "Didn't complete your reps? The program automatically adjusts the load so you keep progressing without stalling.",
      },
      {
        title: 'Zero Mental Load',
        desc: 'Walk into the gym knowing exactly what to do. No planning, no spreadsheets, no wasted time.',
      },
    ],
  },
  programs: {
    sectionLabel: 'Catalog',
    title: 'Choose Your Program',
    subtitle: 'Training programs with automatic progression. Pick the one that fits your goals.',
    by: 'by',
    levelLabels: { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' },
    daysPerWeek: 'days/week',
    weeks: 'weeks',
    errorText: 'Could not load programs.',
    moreProgramsFn: (n) => `See all ${n} programs →`,
  },
  finalCta: {
    eyebrow: 'Ready to raise the gravity?',
    line1: 'Enter the Gravity Room.',
    line2: 'Start Training Today.',
    discordText: 'Join the community on',
    cta: 'Start for Free →',
  },
  footer: {
    tagline: 'For athletes who refuse to plateau.',
    navLabel: 'Navigation',
    communityLabel: 'Community',
    githubLabel: 'GitHub',
    privacyLabel: 'Privacy',
    cookiesLabel: 'Cookies',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'How It Works', href: '#how-it-works' },
      { label: 'Programs', href: '#programs' },
    ],
  },
  skipLabel: 'Skip to content',
  langSwitch: { label: 'Versión en Español →', href: '/' },
};
