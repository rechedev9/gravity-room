/**
 * Static catalog of all Gravity Room preset programs.
 * Single source of truth for program metadata — consumed by the API seed,
 * the Discord bot, and any other tooling that needs the program list.
 *
 * JSONB definitions live in apps/api/src/db/seeds/programs/ and are
 * intentionally kept separate (DB-layer concern).
 */

export type ProgramCategory = 'strength' | 'hypertrophy' | 'powerlifting';

export const PROGRAM_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

export type ProgramLevel = (typeof PROGRAM_LEVELS)[number];

export type ProgramMeta = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly author: string;
  readonly category: ProgramCategory;
  readonly level: ProgramLevel;
  readonly isActive: boolean;
};

export const PROGRAM_CATALOG: readonly ProgramMeta[] = [
  {
    id: 'gzclp',
    name: 'GZCLP',
    description:
      'Como entrenar en el planeta de Kaio-sama: progresión lineal bajo presión constante. ' +
      'Rotación de 4 días con ejercicios T1, T2 y T3. Si fallas, cambias de etapa y ' +
      'sigues luchando. Inspirado en el método GZCL de Cody LeFever.',
    author: 'Gravity Room',
    category: 'strength',
    level: 'beginner',
    isActive: true,
  },
  {
    id: 'hexan-ppl',
    name: 'HeXaN PPL',
    description:
      'Seis días de Kaioken: empuja tu cuerpo al máximo con fuerza y volumen. ' +
      'Push/Pull/Legs combinando 5/3/1 para los compuestos principales con doble ' +
      'progresión en accesorios. Inspirado en la metodología de HeXaN.',
    author: 'Gravity Room',
    category: 'hypertrophy',
    level: 'intermediate',
    isActive: true,
  },
  {
    id: 'stronglifts-5x5',
    name: 'StrongLifts 5x5',
    description:
      'Programa clásico de fuerza para principiantes. ' +
      'Dos entrenamientos alternos (A/B), 3 días por semana. ' +
      'Sentadilla en cada sesión, progresión lineal de +2.5 kg por entrenamiento (+5 kg en peso muerto). ' +
      'Tres fallos consecutivos provocan una descarga del 10%.',
    author: 'Mehdi Hadim',
    category: 'strength',
    level: 'beginner',
    isActive: true,
  },
  {
    id: 'phraks-greyskull-lp',
    name: "Phrak's Greyskull LP",
    description:
      'Programa de fuerza para principiantes de Phrakture. ' +
      'Dos entrenamientos alternos (A/B), 3 días por semana. ' +
      'Cada ejercicio termina con una serie AMRAP (al fallo técnico). ' +
      'Progresión lineal con descarga del 10% al fallar.',
    author: 'Phrakture (r/Fitness)',
    category: 'strength',
    level: 'beginner',
    isActive: true,
  },
  {
    id: '531-boring-but-big',
    name: '5/3/1 Boring But Big',
    description:
      'El secreto de la fuerza según el Maestro Roshi: repeticiones aburridas pero ' +
      'enormes resultados. Ciclos de 4 semanas (5s, 3s, 5/3/1, descarga) con 5×10 ' +
      'de volumen suplementario. 4 días por semana. Inspirado en 5/3/1 BBB de Jim Wendler.',
    author: 'Gravity Room',
    category: 'strength',
    level: 'intermediate',
    isActive: true,
  },
  {
    id: '531-for-beginners',
    name: '5/3/1 for Beginners',
    description:
      'Entrenamiento de cuerpo completo en el Palacio Celeste: 3 días por semana, ' +
      'dos levantamientos principales por sesión. Ciclos de 3 semanas (5s, 3s, 5/3/1) ' +
      'con FSL 5×5 como suplemento. Metódico y equilibrado. ' +
      'Inspirado en 5/3/1 for Beginners de Jim Wendler.',
    author: 'Gravity Room',
    category: 'strength',
    level: 'beginner',
    isActive: true,
  },
  {
    id: 'phul',
    name: 'PHUL',
    description:
      'Fuerza y tamaño como Vegeta en su cámara de gravedad: dos días de poder puro ' +
      '(compuestos pesados 3-5 reps) y dos de hipertrofia (8-12 reps). ' +
      '4 días por semana. Inspirado en PHUL de Brandon Campbell.',
    author: 'Gravity Room',
    category: 'hypertrophy',
    level: 'intermediate',
    isActive: true,
  },
  {
    id: 'nivel-7',
    name: 'Nivel 7',
    description:
      'Programa de fuerza de 12 semanas con periodización inversa. ' +
      'Configuras el récord objetivo (semana 6) y los pesos se calculan hacia atrás. ' +
      'Bloque 1 (5×5) con descarga en semana 3, Bloque 2 (3×3) culminando en récord. ' +
      'Ciclo 2 repite la onda con +2.5kg. Accesorios con doble progresión 3×8-12. ' +
      '4 días/semana: hombros/tríceps, espalda/gemelo, pecho/bíceps, pierna.',
    author: 'nivel7 (musclecoop)',
    category: 'strength',
    level: 'intermediate',
    isActive: true,
  },
  {
    id: 'caparazon-de-tortuga',
    name: 'Caparazón de Tortuga',
    description:
      'Tu entrenamiento en la Kame House: empieza desde cero con tu peso corporal ' +
      'y poco a poco añade la barra. 200 sesiones, 3 días/semana. ' +
      '4 bloques por sesión: Core, Activación, Propiocepción y el Ejercicio Fundamental. ' +
      'Inspirado en la metodología de Amerigo Brunetti.',
    author: 'Gravity Room',
    category: 'strength',
    level: 'beginner',
    isActive: true,
  },
  {
    id: '365-programmare-lipertrofia',
    name: "365 Programmare l'Ipertrofia",
    description:
      'Programa anual de hipertrofia de Amerigo Brunetti estructurado en 5 fases y 212 sesiones. ' +
      'Fase Zero (8 semanas): técnica con cargas mínimas. ' +
      'Fase T1 (6 semanas): introducción de carga en los tres levantamientos fundamentales. ' +
      'Fase PN (13 semanas): ramping progresivo con sobrecargas específicas. ' +
      'Fase JAW (18 semanas): 3 bloques independientes de intensificación con TM propios y test de 1RM al final de cada bloque. ' +
      'Fase IS (12 semanas): trabajo de aislamiento y consolidación, 12–30 repeticiones. ' +
      '4 días por semana.',
    author: 'Amerigo Brunetti',
    category: 'hypertrophy',
    level: 'intermediate',
    isActive: false,
  },
  {
    id: 'la-sala-del-tiempo',
    name: 'La Sala del Tiempo',
    description:
      'Inspirado en la metodología de Amerigo Brunetti. Tu año en la Sala del Tiempo: ' +
      '196 sesiones de hipertrofia estructurada en 4 fases de intensidad creciente ' +
      '(T1, PN, JAW, IS). Solo para guerreros que ya dominan sentadilla, press banca ' +
      'y peso muerto. 4 días por semana.',
    author: 'Gravity Room',
    category: 'hypertrophy',
    level: 'intermediate',
    isActive: false,
  },
  {
    id: 'sala-del-tiempo-1',
    name: 'La Sala del Tiempo 1',
    description:
      'Fase T1 — Perfezionamento Tecnico: 24 sesiones de técnica con cargas ligeras (40-70% TM). ' +
      'Isométricos, tempos y control del movimiento en sentadilla, press banca y peso muerto. ' +
      '6 semanas, 4 días/semana. Inspirado en la metodología de Amerigo Brunetti.',
    author: 'Gravity Room',
    category: 'hypertrophy',
    level: 'intermediate',
    isActive: true,
  },
  {
    id: 'sala-del-tiempo-2',
    name: 'La Sala del Tiempo 2',
    description:
      'Fase PN — Potenziamento Neurale: 52 sesiones de potenciación neural progresiva (60-95% TM). ' +
      'Ramping de cargas y series de fuerza para transferir técnica a pesos pesados. ' +
      '13 semanas, 4 días/semana. Inspirado en la metodología de Amerigo Brunetti.',
    author: 'Gravity Room',
    category: 'hypertrophy',
    level: 'intermediate',
    isActive: true,
  },
  {
    id: 'sala-del-tiempo-3',
    name: 'La Sala del Tiempo 3',
    description:
      'Fase JAW Mod — 72 sesiones de intensificación en 3 bloques de 6 semanas (60→70→80% TM). ' +
      'Cada bloque termina con test de 1RM que alimenta el TM del siguiente. ' +
      '18 semanas, 4 días/semana. Inspirado en la metodología de Amerigo Brunetti.',
    author: 'Gravity Room',
    category: 'hypertrophy',
    level: 'intermediate',
    isActive: true,
  },
  {
    id: 'tenkaichi-budokai-sentadilla',
    name: 'Tenkaichi Budokai — Sentadilla',
    description:
      'Preparación de 16 semanas para el torneo con énfasis en sentadilla. ' +
      'Porcentajes exactos de tu 1RM, periodización por mesociclos, deload antes de competir. ' +
      '4 días por semana. Inspirado en la metodología de Boris Sheiko.',
    author: 'Gravity Room',
    category: 'powerlifting',
    level: 'advanced',
    isActive: true,
  },
  {
    id: 'tenkaichi-budokai-press-banca',
    name: 'Tenkaichi Budokai — Press Banca',
    description:
      'Preparación de 16 semanas para el torneo con énfasis en press banca. ' +
      'Porcentajes exactos de tu 1RM, múltiples variaciones de banca. ' +
      '4 días por semana. Inspirado en la metodología de Boris Sheiko.',
    author: 'Gravity Room',
    category: 'powerlifting',
    level: 'advanced',
    isActive: true,
  },
  {
    id: 'tenkaichi-budokai-peso-muerto',
    name: 'Tenkaichi Budokai — Peso Muerto',
    description:
      'Preparación de 16 semanas para el torneo con énfasis en peso muerto. ' +
      'Déficit, bloques, cadenas, bandas — todas las variaciones de peso muerto. ' +
      '4 días por semana. Inspirado en la metodología de Boris Sheiko.',
    author: 'Gravity Room',
    category: 'powerlifting',
    level: 'advanced',
    isActive: true,
  },
  {
    id: 'tenkaichi-budokai-solo-banca',
    name: 'Tenkaichi Budokai — Solo Banca',
    description:
      'Preparación de 18 semanas exclusiva para press banca. ' +
      'Sin sentadilla ni peso muerto de competición — toda la energía en un solo golpe. ' +
      '4 días por semana. Inspirado en la metodología de Boris Sheiko.',
    author: 'Gravity Room',
    category: 'powerlifting',
    level: 'advanced',
    isActive: true,
  },
  {
    id: 'tenkaichi-budokai-veterano',
    name: 'Tenkaichi Budokai — Veterano',
    description:
      'El programa más popular de Sheiko para guerreros experimentados. ' +
      '4 mesociclos de preparación con volumen medio y test de 1RM integrado. ' +
      'Usa tu experiencia de combate para llegar al torneo en tu mejor forma. ' +
      '4 días por semana. Inspirado en la metodología de Boris Sheiko.',
    author: 'Gravity Room',
    category: 'powerlifting',
    level: 'advanced',
    isActive: true,
  },
  {
    id: 'furia-oscura',
    name: 'Furia Oscura',
    description:
      'Entrena como un Saiyajin: Push/Pull/Legs con alternancia A/B semanal. 3 dias/semana al estilo Sala del Tiempo, doble progresion hasta superar tus limites.',
    author: 'Gravity Room',
    category: 'hypertrophy',
    level: 'intermediate',
    isActive: true,
  },
] as const satisfies readonly ProgramMeta[];
