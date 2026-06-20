import type { ExerciseArticle } from '@gzclp/domain/schemas/exercise-article';

export const benchArticle: ExerciseArticle = {
  exerciseId: 'bench',
  slug: { es: 'press-banca', en: 'bench-press' },
  muscleGroupId: 'chest',
  equipment: 'barbell',
  level: 'beginner',
  primaryMuscles: ['pectoralis major', 'triceps brachii'],
  secondaryMuscles: ['anterior deltoid', 'serratus anterior', 'coracobrachialis'],
  references: [
    {
      doi: '10.3390/ijerph18126444',
      pmid: '34198674',
      title:
        'The Effect of Grip Width on Muscle Strength and Electromyographic Activity in Bench Press among Novice- and Resistance-Trained Men',
      authors: 'Saeterbakken AH, Stien N, Pedersen H, Solstad TEJ, Cumming KT, Andersen V',
      year: 2021,
      url: 'https://doi.org/10.3390/ijerph18126444',
    },
    {
      doi: '10.3389/fspor.2020.637066',
      pmid: '33554113',
      title:
        'A Biomechanical Analysis of Wide, Medium, and Narrow Grip Width Effects on Kinematics, Horizontal Kinetics, and Muscle Activity on the Sticking Region in Recreationally Trained Males During 1-RM Bench Pressing',
      authors: 'Larsen S, Gomo O, van den Tillaar R',
      year: 2020,
      url: 'https://doi.org/10.3389/fspor.2020.637066',
    },
    {
      doi: '10.3390/ijerph17197339',
      pmid: '33049982',
      title:
        'Effect of Five Bench Inclinations on the Electromyographic Activity of the Pectoralis Major, Anterior Deltoid, and Triceps Brachii during the Bench Press Exercise',
      authors: 'Rodríguez-Ridao D, Antequera-Vique JA, Martín-Fuentes I, Muyor JM',
      year: 2020,
      url: 'https://doi.org/10.3390/ijerph17197339',
    },
    {
      doi: '10.1080/17461391.2015.1022605',
      pmid: '25799093',
      title:
        'Influence of bench angle on upper extremity muscular activation during bench press exercise',
      authors: 'Lauver JD, Cayot TE, Scheuermann BW',
      year: 2016,
      url: 'https://doi.org/10.1080/17461391.2015.1022605',
    },
    {
      doi: '10.3389/fphys.2024.1393235',
      pmid: '38974522',
      title:
        'Effects of bench press technique variations on musculoskeletal shoulder loads and potential injury risk',
      authors: 'Noteboom L, Belli I, Hoozemans MJM, Seth A, Veeger HEJ, Van Der Helm FCT',
      year: 2024,
      url: 'https://doi.org/10.3389/fphys.2024.1393235',
    },
    {
      doi: '10.1515/hukin-2017-0047',
      pmid: '28713459',
      title:
        'The Effects of Bench Press Variations in Competitive Athletes on Muscle Activity and Performance',
      authors: 'Saeterbakken AH, Mo DA, Scott S, Andersen V',
      year: 2017,
      url: 'https://doi.org/10.1515/hukin-2017-0047',
    },
  ],
  content: {
    es: {
      title: 'Press de Banca con Barra',
      description:
        'Guía técnica y científica del press de banca con barra: músculos, biomecánica, agarre y errores comunes para progresar con menor riesgo.',
      summary: [
        'El press de banca con barra es el ejercicio de empuje horizontal más estudiado en la literatura científica. Activa principalmente el pectoral mayor y el tríceps braquial, con participación del deltoides anterior como músculo sinérgico.',
        'Es un pilar de la mayoría de los programas de fuerza e hipertrofia, donde se emplea como movimiento de empuje horizontal principal, con progresión de carga semanal o mensual según el nivel del practicante.',
        'Dominar la técnica antes de aumentar el peso es fundamental: un patrón de movimiento correcto reduce el estrés innecesario sobre el hombro y maximiza la activación del pectoral.',
      ],
      technique: [
        'Ajusta el banco plano y coloca la barra en el rack a la altura de los brazos extendidos. Túmbate con los ojos directamente debajo de la barra.',
        'Agarra la barra con un agarre pronado ligeramente más ancho que la anchura de los hombros (aproximadamente biacromial × 1,5). Los pulgares envuelven la barra completamente (no agarre suicida).',
        'Retrae y deprime las escápulas —"aprieta los omóplatos hacia abajo y atrás"— creando una base estable sobre el banco. Mantén los pies apoyados en el suelo.',
        'Desrackea la barra y colócala sobre el esternón inferior / pecho superior con los brazos extendidos pero sin bloquear el codo completamente.',
        'Baja la barra de forma controlada hasta rozar el pecho (región esternal inferior), manteniendo los codos a unos 45-75° del torso, no completamente abiertos en L.',
        'Desde el pecho, empuja la barra hacia arriba y ligeramente hacia la cabeza siguiendo una trayectoria en arco leve hasta recuperar la posición de bloqueo.',
        'Respira: inhala antes de bajar (maniobra de Valsalva o respiración en la parte superior), exhala durante el empuje o al final de la repetición.',
      ],
      evidence: [
        {
          claim:
            'Un agarre más amplio (≈ 2× distancia biacromial) aumenta la activación del pectoral mayor y reduce el rango de movimiento del codo, mientras que un agarre más estrecho incrementa la activación del tríceps braquial.',
          refIndices: [0, 1],
        },
        {
          claim:
            'Inclinar el banco a 30-45° desplaza la activación hacia la porción clavicular (superior) del pectoral mayor y aumenta significativamente la participación del deltoides anterior en comparación con el banco plano.',
          refIndices: [2, 3],
        },
        {
          claim:
            'El ancho de agarre influye en la producción de fuerza y el equilibrio muscular en la zona de adherencia (sticking region): un agarre medio (aproximadamente biacromial) ofrece un buen equilibrio entre producción de fuerza y activación total del pectoral y el tríceps.',
          refIndices: [1, 5],
        },
        {
          claim:
            'Un arco lumbar excesivo combinado con una posición de los codos en L completa (90°) incrementa las cargas sobre las estructuras anteriores del hombro y puede aumentar el riesgo de lesión en la articulación glenohumeral.',
          refIndices: [4],
        },
      ],
      commonMistakes: [
        'Dejar rebotar la barra sobre el pecho para aprovechar el impulso, lo que reduce el estímulo muscular y puede dañar las costillas.',
        'Abrir los codos en ángulo de 90° respecto al torso (posición en T): aumenta el estrés sobre el manguito rotador y el labrum anterior.',
        'Pérdida de la retracción escapular durante la bajada, permitiendo que las escápulas se protrayan y desestabilicen el hombro.',
        'No controlar la fase excéntrica (bajada): bajar la barra demasiado rápido elimina el estímulo de tensión muscular y dificulta mantener la técnica.',
        'Levantar los pies del suelo o elevar las caderas del banco para alcanzar más peso, comprometiendo la estabilidad y el arco de fuerza.',
        'Usar un agarre suicida (pulgar en el mismo lado que los demás dedos): pone en riesgo que la barra resbale sobre el pecho.',
      ],
    },
    en: {
      title: 'Barbell Bench Press',
      description:
        'Evidence-based technical guide to the barbell bench press: muscles worked, biomechanics, grip width, and common mistakes for lower-risk, efficient progress.',
      summary: [
        'The barbell bench press is the most extensively researched horizontal pushing exercise in the strength training literature. It primarily activates the pectoralis major and triceps brachii, with the anterior deltoid contributing as a synergist.',
        "It is a staple of most strength and hypertrophy programs, where it serves as the primary horizontal push movement, with load progression structured weekly or monthly depending on the lifter's training level.",
        'Mastering technique before chasing heavier weights is critical: correct movement patterns reduce unnecessary shoulder stress and maximize pectoral recruitment.',
      ],
      technique: [
        'Set up the flat bench and position the bar on the rack at fully-extended arm height. Lie back so your eyes are directly under the bar.',
        'Grip the bar with a pronated grip slightly wider than shoulder width (approximately 1.5× biacromial distance). Wrap your thumbs fully around the bar — never use a thumbless grip.',
        'Retract and depress your scapulae — "squeeze your shoulder blades down and together" — creating a stable base against the bench. Keep both feet flat on the floor.',
        'Unrack the bar and position it over the lower sternum / upper chest with arms extended, elbows soft (not hyperextended).',
        'Lower the bar under control until it lightly touches your chest at the lower sternal region, keeping your elbows at roughly 45–75° from your torso — not flared out to a full T.',
        'From the chest, drive the bar upward and very slightly back toward your head in a gentle arc, returning to the lockout position.',
        'Breathe: inhale before the descent (brace with a Valsalva maneuver or at the top), exhale during the drive or at lockout.',
      ],
      evidence: [
        {
          claim:
            'A wider grip (≈ 2× biacromial width) increases pectoralis major EMG activity and shortens elbow range of motion, while a narrower grip shifts more demand onto the triceps brachii.',
          refIndices: [0, 1],
        },
        {
          claim:
            'Inclining the bench to 30–45° shifts activation toward the clavicular (upper) head of the pectoralis major and significantly increases anterior deltoid involvement compared to the flat bench.',
          refIndices: [2, 3],
        },
        {
          claim:
            'Grip width influences force output and muscle balance at the sticking region: a medium grip (about biacromial width) offers a good balance between force production and overall pectoral/triceps activation.',
          refIndices: [1, 5],
        },
        {
          claim:
            'An excessive lumbar arch combined with fully flared elbows (90° from torso) increases loads on the anterior shoulder structures and may raise glenohumeral injury risk.',
          refIndices: [4],
        },
      ],
      commonMistakes: [
        'Bouncing the bar off the chest to gain momentum: reduces muscular stimulus and risks rib or sternal injury.',
        'Flaring elbows to a full 90° (T position): increases rotator cuff and anterior labrum stress.',
        'Losing scapular retraction on the descent, allowing the scapulae to protract and destabilize the shoulder joint.',
        'Lowering the bar too fast: eliminates eccentric tension stimulus and makes it harder to maintain technique at the bottom.',
        'Lifting feet off the floor or raising hips off the bench to grind out heavier loads: sacrifices the stable base needed for safe force transfer.',
        'Using a thumbless (suicide) grip: risks the bar slipping forward off the hands onto the chest.',
      ],
    },
  },
  reviewedBy: 'PENDING',
  reviewedAt: '2026-06-20',
};
