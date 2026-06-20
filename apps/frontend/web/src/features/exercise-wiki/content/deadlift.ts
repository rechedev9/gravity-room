import type { ExerciseArticle } from '@gzclp/domain/schemas/exercise-article';

export const deadliftArticle: ExerciseArticle = {
  exerciseId: 'deadlift',
  slug: { es: 'peso-muerto', en: 'deadlift' },
  muscleGroupId: 'back',
  equipment: 'barbell',
  level: 'beginner',
  primaryMuscles: ['erector spinae', 'gluteus maximus', 'hamstrings'],
  secondaryMuscles: ['quadriceps', 'trapezius', 'latissimus dorsi'],
  references: [
    {
      doi: '10.1097/00005768-200007000-00013',
      pmid: '10912892',
      title: 'A three-dimensional biomechanical analysis of sumo and conventional style deadlifts.',
      authors:
        'Escamilla RF, Francisco AC, Fleisig GS, Barrentine SW, Welch CM, Kayes AV, Speer KP, Andrews JR',
      year: 2000,
      url: 'https://doi.org/10.1097/00005768-200007000-00013',
    },
    {
      doi: '10.1097/00005768-200204000-00019',
      pmid: '11932579',
      title: 'An electromyographic analysis of sumo and conventional style deadlifts.',
      authors: 'Escamilla RF, Francisco AC, Kayes AV, Speer KP, Moorman CT 3rd',
      year: 2002,
      url: 'https://doi.org/10.1097/00005768-200204000-00019',
    },
    {
      doi: '10.1371/journal.pone.0229507',
      pmid: '32107499',
      title:
        'Electromyographic activity in deadlift exercise and its variants. A systematic review.',
      authors: 'Martín-Fuentes I, Oliva-Lozano JM, Muyor JM',
      year: 2020,
      url: 'https://doi.org/10.1371/journal.pone.0229507',
    },
    {
      doi: '10.1519/JSC.0000000000001893',
      pmid: '29076958',
      title:
        'Gluteus Maximus and Hamstring Activation During Selected Weight-Bearing Resistance Exercises.',
      authors: 'McCurdy K, Walker J, Yuen D',
      year: 2018,
      url: 'https://doi.org/10.1519/JSC.0000000000001893',
    },
    {
      doi: '10.2463/mrms.mp.2020-0052',
      pmid: '32879259',
      title:
        'Acute Physiological Response of Lumbar Intervertebral Discs to High-load Deadlift Exercise.',
      authors: 'Yanagisawa O, Oshikawa T, Matsunaga N, Adachi G, Kaneoka K',
      year: 2021,
      url: 'https://doi.org/10.2463/mrms.mp.2020-0052',
    },
  ],
  content: {
    es: {
      title: 'Peso muerto con barra',
      description:
        'Movimiento de cadena posterior que trabaja glúteos, isquiotibiales y erectores espinales mediante una extensión coordinada de cadera y rodilla.',
      summary: [
        'El peso muerto con barra es uno de los ejercicios multiarticulares más completos del entrenamiento de fuerza. Implica la extensión simultánea de caderas y rodillas para elevar una barra desde el suelo, reclutando con alta intensidad los músculos posteriores del tronco y de las extremidades inferiores.',
        'Existen dos variantes principales: el peso muerto convencional, con los pies a la anchura de las caderas y un agarre exterior a las piernas, y el sumo, con una postura más abierta y agarre interior. El convencional genera mayor activación de isquiotibiales y erectores espinales lumbares; el sumo reduce el momento de flexión en la columna al permitir un torso más vertical.',
        'Su alta demanda neuromuscular lo convierte en un movimiento principal en la mayoría de los programas de fuerza, lo que justifica ejecutarlo fresco al inicio de la sesión, antes de los accesorios y del trabajo secundario.',
      ],
      technique: [
        'Coloca los pies a la anchura de las caderas, con la barra sobre la línea media del pie (a 2-3 cm de las espinillas).',
        'Flexiona caderas y rodillas hasta alcanzar la barra; agárrala en prono o con agarre mixto, con las manos justo fuera de las piernas.',
        'Antes de tirar, genera tensión: lleva el pecho hacia arriba (extensión torácica), baja las escápulas, llena el diafragma y realiza la maniobra de Valsalva para crear presión intraabdominal.',
        'Inicia el tirón empujando el suelo con los pies —piensa en "empujar el suelo hacia abajo", no en "tirar de la barra"— extendiendo rodillas y caderas de forma simultánea.',
        'Mantén la barra rozando el cuerpo durante todo el recorrido: cualquier alejamiento multiplica el momento de fuerza en L4-L5.',
        'Una vez que la barra pasa las rodillas, bloquea la cadera llevando la pelvis hacia la barra; no hiperextiendas la columna lumbar al finalizar.',
        'El descenso es el recorrido inverso: retira las caderas hacia atrás primero, luego flexiona las rodillas cuando la barra desciende por ellas. Mantén la tensión corporal durante todo el bajada.',
      ],
      evidence: [
        {
          claim:
            'El peso muerto convencional genera un momento de extensión de cadera significativamente mayor que el sumo y produce mayor activación EMG del bíceps femoral y los erectores espinales lumbares superiores.',
          refIndices: [0, 1],
        },
        {
          claim:
            'La revisión sistemática de Martín-Fuentes et al. (2020) identificó los erectores espinales y el cuádriceps como los músculos con mayor activación relativa durante el peso muerto, seguidos del glúteo máximo e isquiotibiales, con variabilidad metodológica considerable entre estudios.',
          refIndices: [2],
        },
        {
          claim:
            'El glúteo máximo y el grupo de isquiotibiales muestran una activación elevada durante el peso muerto con barra en comparación con otros ejercicios de cadena posterior con carga.',
          refIndices: [3],
        },
        {
          claim:
            'Una sesión de peso muerto con cargas altas produce cambios agudos medibles en los discos intervertebrales lumbares, lo que subraya la importancia de una técnica correcta y una progresión de carga gradual.',
          refIndices: [4],
        },
      ],
      commonMistakes: [
        'Redondear la espalda baja al inicio del tirón: surge de no generar tensión previa en la columna (extensión torácica + Valsalva) antes de arrancar.',
        'Alejar la barra del cuerpo durante el ascenso, lo que aumenta considerablemente el momento de fuerza en la columna lumbar.',
        'Hiperextender la zona lumbar al bloquear, sustituyendo la extensión de cadera por extensión lumbar y sobrecargando los arcos vertebrales posteriores.',
        'Iniciar el movimiento tirando de los hombros hacia atrás en lugar de empujar el suelo con los pies, lo que rompe el ritmo lumbopélvico.',
        'No mantener la presión intraabdominal durante todo el recorrido, desestabilizando el raquis bajo carga.',
      ],
    },
    en: {
      title: 'Barbell Deadlift',
      description:
        'A posterior-chain movement training the glutes, hamstrings, and erector spinae through a coordinated hip and knee extension from the floor.',
      summary: [
        'The barbell deadlift is one of the most complete compound movements in strength training. It requires simultaneous hip and knee extension to lift a loaded barbell from the floor, producing high-intensity recruitment of the posterior trunk and lower-limb musculature.',
        'Two main variants exist: the conventional deadlift, with feet hip-width apart and a grip outside the legs, and the sumo deadlift, with a wider stance and inside grip. The conventional style generates greater hamstring and lumbar erector activation; the sumo style reduces the lumbar flexion moment by allowing a more vertical torso.',
        'Its high neuromuscular demand makes it a primary movement in the majority of strength programs, which is why it is best performed fresh at the start of the session, before secondary and accessory work.',
      ],
      technique: [
        'Stand with feet hip-width apart, barbell over the mid-foot (roughly 2–3 cm from the shins).',
        'Hinge at the hips and bend the knees until you reach the bar; grip it pronated or with a mixed grip, hands just outside the legs.',
        'Before pulling, create full-body tension: lift the chest (thoracic extension), depress the scapulae, take a deep diaphragmatic breath, and perform a Valsalva maneuver to build intra-abdominal pressure.',
        'Initiate the lift by pushing the floor away with your feet — think "push the ground down," not "pull the bar up" — extending knees and hips simultaneously.',
        'Keep the bar dragging along your body throughout the lift: any horizontal drift multiplies the moment arm at L4–L5.',
        'Once the bar clears the knees, lock out by driving the hips forward toward the bar; do not hyperextend the lumbar spine at lockout.',
        'The descent is the reverse: push the hips back first, then re-bend the knees as the bar descends past them. Maintain full-body tension throughout the lowering phase.',
      ],
      evidence: [
        {
          claim:
            'The conventional deadlift produces significantly greater hip extension moments than the sumo style and elicits higher biceps femoris and upper lumbar erector spinae EMG activation.',
          refIndices: [0, 1],
        },
        {
          claim:
            'The 2020 systematic review by Martín-Fuentes et al. identified the erector spinae and quadriceps as the most highly activated muscles during the deadlift, followed by the gluteus maximus and hamstrings, with notable methodological variability across studies.',
          refIndices: [2],
        },
        {
          claim:
            'The gluteus maximus and hamstring group show elevated activation during the barbell deadlift compared with other loaded posterior-chain exercises.',
          refIndices: [3],
        },
        {
          claim:
            'Heavy deadlift sessions produce measurable acute changes in lumbar intervertebral disc morphology, underscoring the importance of sound technique and a gradual loading progression.',
          refIndices: [4],
        },
      ],
      commonMistakes: [
        'Rounding the lower back at the start of the pull: caused by failing to generate spinal tension (thoracic extension + Valsalva) before initiating.',
        'Allowing the bar to drift away from the body during the ascent, which substantially increases the lumbar moment arm.',
        'Hyperextending the lumbar spine at lockout, substituting lumbar extension for hip extension and overloading the posterior facet joints.',
        'Initiating the movement by pulling the shoulders back instead of pushing the floor away with the feet, breaking the lumbo-pelvic rhythm.',
        'Losing intra-abdominal pressure mid-lift, destabilizing the spine under load.',
      ],
    },
  },
  reviewedBy: 'PENDING',
  reviewedAt: '2026-06-20',
};
