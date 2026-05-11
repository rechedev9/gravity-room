/* ── FAQ canonical source of truth ────────────────────────────────────────
 * Single source consumed by both the rendered FAQ section and the
 * FAQPage JSON-LD generator. Keep the rendered text and the JSON-LD
 * answer text in sync at all times (Google policy requirement).
 * ─────────────────────────────────────────────────────────────────────── */

export interface FaqEntry {
  readonly question: string;
  readonly answer: string;
}

export const FAQ_ITEMS_EN: readonly FaqEntry[] = [
  {
    question: 'What is Gravity Room?',
    answer:
      'Gravity Room is a free web app for structured weightlifting programs with automatic progression. It tells you exactly what to lift each session and adjusts weight, sets, and reps based on your performance. No spreadsheets, no guessing.',
  },
  {
    question: 'What is GZCLP?',
    answer:
      'GZCLP is a linear progression weightlifting program that uses a tier system (T1, T2, T3) with different set/rep schemes per tier. When you fail a lift, the program automatically adjusts through stages before deloading, keeping you progressing longer than simple 5x5 programs.',
  },
  {
    question: 'Is Gravity Room free?',
    answer:
      'Yes, Gravity Room is 100% free. All features including cloud sync, strength statistics, and all training programs are available at no cost — no premium tier, no ads.',
  },
  {
    question: 'How does automatic progression work?',
    answer:
      'When you complete all prescribed reps for a lift, the app automatically increases the weight for next session. If you fail, the program adapts by changing the set/rep scheme (e.g., from 5x3 to 6x2) before eventually deloading. This is based on the progressive overload principle.',
  },
  {
    question: 'What is progressive overload?',
    answer:
      'Progressive overload is the gradual increase of stress placed on the body during exercise. For weightlifting, this means consistently adding more weight, reps, or sets over time. It is the foundational principle behind all effective strength training programs.',
  },
  {
    question: 'What is the best beginner weightlifting program?',
    answer:
      'For beginners, GZCLP and StrongLifts 5x5 are two of the most recommended programs. GZCLP has a more nuanced progression system with tier-based exercises, while StrongLifts 5x5 is simpler with alternating A/B workouts. Both are available in Gravity Room with automatic progression tracking.',
  },
  {
    question: 'GZCLP vs StrongLifts 5x5 — which is better?',
    answer:
      'GZCLP handles progression failures more intelligently through a staged system (5x3 → 6x2 → deload) before resetting weight, so you progress longer. StrongLifts 5x5 resets weight by 10% after three failed attempts. GZCLP also uses a three-tier exercise structure that trains more muscle groups per session. For most beginners, GZCLP is the better long-term choice.',
  },
  {
    question: 'How do I track gym progress effectively?',
    answer:
      'The most effective way to track gym progress is to log every workout with weights, sets, and reps, and follow a structured program with built-in progression rules. Apps like Gravity Room automate this — they tell you what to lift and automatically increase the weight when you hit your targets.',
  },
  {
    question: 'Is it suitable for beginners?',
    answer:
      'Yes. The catalog includes programs designed specifically for beginners that guide you step by step from day one. There are also options for intermediate and advanced athletes.',
  },
  {
    question: 'Can I use Gravity Room on both mobile and desktop?',
    answer:
      'Yes. There is a mobile app available in addition to the web version. Your data and progression sync across all your devices in real time.',
  },
  {
    question: 'Is Gravity Room open source?',
    answer:
      'Yes. Gravity Room is open source under the AGPL-3.0 license. The full source code lives at https://github.com/rechedev9/gravity-room. The product is free, hosted on a small VPS, and built by a solo developer.',
  },
];

export const FAQ_ITEMS_ES: readonly FaqEntry[] = [
  {
    question: '¿Qué es Gravity Room?',
    answer:
      'Gravity Room es una app web gratuita para seguir programas de entrenamiento con progresión automática. Te dice exactamente qué levantar en cada sesión y ajusta el peso, series y repeticiones según tu rendimiento. Sin hojas de cálculo, sin adivinar.',
  },
  {
    question: '¿Qué es GZCLP?',
    answer:
      'GZCLP es un programa de progresión lineal que usa un sistema de tiers (T1, T2, T3) con diferentes esquemas de series y repeticiones por tier. Cuando fallas un levantamiento, el programa ajusta automáticamente las etapas antes de hacer deload, manteniéndote progresando más tiempo que un programa 5x5 simple.',
  },
  {
    question: '¿Gravity Room es gratis?',
    answer:
      'Sí, Gravity Room es 100% gratis. Todas las funciones — incluyendo sincronización en la nube, estadísticas de fuerza y todos los programas de entrenamiento — están disponibles sin coste, sin nivel premium y sin anuncios.',
  },
  {
    question: '¿Cómo funciona la progresión automática?',
    answer:
      'Cuando completas todas las repeticiones prescritas de un levantamiento, la app sube automáticamente el peso para la siguiente sesión. Si fallas, el programa adapta el esquema de series y repeticiones (por ejemplo, de 5x3 a 6x2) antes de hacer deload. Está basado en el principio de sobrecarga progresiva.',
  },
  {
    question: '¿Qué es la sobrecarga progresiva?',
    answer:
      'La sobrecarga progresiva es el aumento gradual del estrés aplicado al cuerpo durante el ejercicio. En el entrenamiento de fuerza significa añadir peso, repeticiones o series de forma consistente a lo largo del tiempo. Es el principio fundamental detrás de cualquier programa de fuerza efectivo.',
  },
  {
    question: '¿Cuál es el mejor programa para principiantes?',
    answer:
      'Para principiantes, GZCLP y StrongLifts 5x5 son dos de los más recomendados. GZCLP tiene un sistema de progresión más matizado con ejercicios por tiers, mientras que StrongLifts 5x5 es más simple con entrenamientos A/B alternos. Ambos están disponibles en Gravity Room con seguimiento de progresión automático.',
  },
  {
    question: 'GZCLP vs StrongLifts 5x5 — ¿cuál es mejor?',
    answer:
      'GZCLP maneja los fallos de progresión de forma más inteligente mediante un sistema por etapas (5x3 → 6x2 → deload) antes de resetear el peso, así progresas más tiempo. StrongLifts 5x5 resetea el peso un 10% tras tres intentos fallidos. GZCLP también usa una estructura de tres tiers que trabaja más grupos musculares por sesión. Para la mayoría de principiantes, GZCLP es la mejor opción a largo plazo.',
  },
  {
    question: '¿Cómo registro mi progreso en el gimnasio de forma efectiva?',
    answer:
      'La forma más efectiva de registrar tu progreso es anotar cada entrenamiento con pesos, series y repeticiones, y seguir un programa estructurado con reglas de progresión integradas. Apps como Gravity Room lo automatizan — te dicen qué levantar y suben el peso cuando alcanzas tus objetivos.',
  },
  {
    question: '¿Es adecuado para principiantes?',
    answer:
      'Sí. El catálogo incluye programas diseñados específicamente para principiantes que te guían paso a paso desde el primer día. También hay opciones para niveles intermedio y avanzado.',
  },
  {
    question: '¿Puedo usar Gravity Room en el móvil y en el ordenador?',
    answer:
      'Sí. Hay una app móvil disponible además de la versión web. Tus datos y tu progresión se sincronizan entre todos tus dispositivos en tiempo real.',
  },
  {
    question: '¿Gravity Room es open source?',
    answer:
      'Sí. Gravity Room es open source bajo licencia AGPL-3.0. El código completo está disponible en https://github.com/rechedev9/gravity-room. El producto es gratuito, está alojado en un VPS pequeño y desarrollado por un único desarrollador.',
  },
];

/* ── JSON-LD generator ──────────────────────────────────────────────────── */

interface FaqJsonLd {
  readonly '@context': 'https://schema.org';
  readonly '@type': 'FAQPage';
  readonly mainEntity: ReadonlyArray<{
    readonly '@type': 'Question';
    readonly name: string;
    readonly acceptedAnswer: {
      readonly '@type': 'Answer';
      readonly text: string;
    };
  }>;
}

export function buildFaqJsonLd(items: readonly FaqEntry[]): FaqJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}
