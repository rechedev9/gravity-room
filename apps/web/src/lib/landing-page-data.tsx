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

/* ── Data ──────────────────────────────────────── */

export const FEATURES: readonly Feature[] = [
  {
    icon: (
      <img
        src="/feature-progression.webp"
        alt="Automatic progression icon"
        width={48}
        height={48}
      />
    ),
    title: 'Progresión Inteligente',
    desc: 'La app decide cuándo agregar peso y cómo manejar el fallo. Tú solo apareces y entrenas.',
  },
  {
    icon: <img src="/feature-tracking.webp" alt="Exercise tracking icon" width={48} height={48} />,
    title: 'Programas Probados',
    desc: 'Programas de entrenamiento respaldados por la ciencia con periodización estructurada. Nuevos programas agregados regularmente.',
  },
  {
    icon: <img src="/feature-stats.webp" alt="Statistics icon" width={48} height={48} />,
    title: 'Estadísticas y Gráficas',
    desc: 'Ve tu curva de fuerza a lo largo del tiempo. Datos reales, no suposiciones.',
  },
  {
    icon: <img src="/feature-sync.webp" alt="Synchronization icon" width={48} height={48} />,
    title: 'Sincronización en la Nube',
    desc: 'Tus datos se sincronizan automáticamente. Entrena desde cualquier dispositivo sin perder el progreso.',
  },
];

export const STEPS: readonly Step[] = [
  {
    num: '01',
    title: 'Elige tu Programa',
    desc: 'Selecciona el programa que se adapte a tus objetivos y configura tus pesos iniciales. La app construye tu plan completo al instante.',
    quote: '"El primer paso siempre es el más importante. Después, la gravedad hace el resto."',
    source: '\u2014 Gravity Room',
  },
  {
    num: '02',
    title: 'Sigue el Programa',
    desc: 'Cada entrenamiento te dice exactamente qué hacer \u2014 ejercicio, series, repeticiones, peso. Sin adivinar.',
    quote: '"La disciplina es entrenar cuando la motivación ya no está. El programa nunca falla."',
    source: '\u2014 Gravity Room',
  },
  {
    num: '03',
    title: 'Progresa Automáticamente',
    desc: 'Completa tus reps y el peso sube. El programa se adapta a tu rendimiento para mantenerte avanzando.',
    quote: '"Cada kilo extra en la barra es gravedad que has conquistado."',
    source: '\u2014 Gravity Room',
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
    title: 'Sobrecarga Progresiva',
    desc: 'El peso sube cuando estás listo. Ni antes, ni después. El programa decide.',
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
    title: 'Adaptación Inteligente',
    desc: '¿No completaste las repeticiones? El programa ajusta la carga automáticamente para que sigas progresando sin estancarte.',
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
    title: 'Cero Pensar',
    desc: 'Entra al gimnasio sabiendo exactamente qué hacer. Sin planeación, sin hojas de cálculo, sin tiempo perdido.',
  },
];
