import type { ExerciseArticle } from '@gzclp/domain/schemas/exercise-article';

export const squatArticle: ExerciseArticle = {
  exerciseId: 'squat',
  slug: { es: 'sentadilla', en: 'squat' },
  muscleGroupId: 'legs',
  equipment: 'barbell',
  level: 'beginner',
  primaryMuscles: ['quadriceps', 'gluteus maximus'],
  secondaryMuscles: [
    'hamstrings',
    'adductors',
    'erector spinae',
    'gastrocnemius',
    'core stabilizers',
  ],
  video: {
    youtubeId: 't2b8UdqmlFs',
    title: "How To Squat: Layne Norton's Squat Tutorial",
    channel: 'Bodybuilding.com',
    uploadDate: '2015-03-19',
    duration: 'PT16M53S',
  },
  references: [
    {
      pmid: '12173958',
      title:
        'The effect of back squat depth on the EMG activity of 4 superficial hip and thigh muscles',
      authors: 'Caterisano A, Moss RF, Pellinger TK, Woodruff K, Lewis VC, Booth W, Khadra T',
      year: 2002,
      url: 'https://pubmed.ncbi.nlm.nih.gov/12173958/',
    },
    {
      doi: '10.1007/s00421-013-2642-7',
      title: 'Effect of range of motion in heavy load squatting on muscle and tendon adaptations',
      authors: 'Bloomquist K, Langberg H, Karlsen S, Madsgaard S, Boesen M, Raastad T',
      year: 2013,
      url: 'https://doi.org/10.1007/s00421-013-2642-7',
    },
    {
      pmid: '11194098',
      title: 'Knee biomechanics of the dynamic squat exercise',
      authors: 'Escamilla RF',
      year: 2001,
      url: 'https://pubmed.ncbi.nlm.nih.gov/11194098/',
    },
    {
      pmid: '8775157',
      title: 'High- and low-bar squatting techniques during weight-training',
      authors: 'Wretenberg P, Feng Y, Arborelius UP',
      year: 1996,
      url: 'https://pubmed.ncbi.nlm.nih.gov/8775157/',
    },
    {
      pmid: '22505136',
      title:
        'A biomechanical comparison of the traditional squat, powerlifting squat, and box squat',
      authors: 'Swinton PA, Lloyd R, Keogh JW, Agouris I, Stewart AD',
      year: 2012,
      url: 'https://pubmed.ncbi.nlm.nih.gov/22505136/',
    },
    {
      pmid: '23821469',
      doi: '10.1007/s40279-013-0073-6',
      title:
        'Analysis of the load on the knee joint and vertebral column with changes in squatting depth and weight load',
      authors: 'Hartmann H, Wirth K, Klusemann M',
      year: 2013,
      url: 'https://pubmed.ncbi.nlm.nih.gov/23821469/',
    },
    {
      pmid: '31230110',
      doi: '10.1007/s00421-019-04181-y',
      title: 'Effects of squat training with different depths on lower limb muscle volumes',
      authors: 'Kubo K, Ikebukuro T, Yata H',
      year: 2019,
      url: 'https://pubmed.ncbi.nlm.nih.gov/31230110/',
    },
  ],
  content: {
    es: {
      title: 'Sentadilla con barra',
      description:
        'Guía basada en evidencia de la sentadilla con barra: técnica, músculos implicados y errores comunes para programas de fuerza.',
      summary: [
        'La sentadilla con barra es uno de los ejercicios compuestos más completos para el desarrollo del tren inferior. Involucra principalmente el cuádriceps y el glúteo mayor, con una contribución significativa de los isquiotibiales, aductores y la musculatura estabilizadora del core.',
        'Es un pilar fundamental en la mayoría de los programas de fuerza y progresión lineal: su sencilla lógica de carga progresiva y su alto retorno en masa muscular y fuerza la convierten en uno de los movimientos más presentes en el entrenamiento con barra.',
        'La evidencia indica que la profundidad de la sentadilla influye en el reclutamiento muscular y en las adaptaciones estructurales a largo plazo. Las sentadillas profundas (por debajo de la paralela) producen mayor activación del glúteo mayor y del aductor mayor en comparación con sentadillas parciales, sin que ello suponga un riesgo adicional para la rodilla cuando la técnica es correcta.',
      ],
      technique: [
        'Coloca la barra sobre los trapecios (barra alta) o sobre las espinas escapulares (barra baja). La posición de barra alta acentúa el trabajo de cuádriceps; la barra baja distribuye más carga al glúteo y cadena posterior.',
        'Separa los pies a la anchura de los hombros o algo más amplia, con las puntas de los pies ligeramente giradas hacia fuera (15-30°). El ancho de la pisada y la rotación external de la cadera dependerán de tu morfología.',
        'Toma aire profundo (maniobra de Valsalva), contrae el core para crear presión intraabdominal y mantén el torso tenso durante todo el descenso.',
        'Inicia el movimiento empujando las rodillas hacia fuera en la dirección de los pies mientras bajas la cadera hacia atrás y abajo. Desciende hasta que los pliegues de las caderas queden por debajo de la rótula (paralela o más profundo).',
        'En el punto más bajo, mantén la espalda neutra —evita el "butt wink" excesivo— y comienza el ascenso empujando el suelo hacia abajo y hacia atrás, extendiendo simultáneamente cadera y rodilla.',
        'Expulsa el aire de forma controlada durante el ascenso una vez superado el punto de mayor esfuerzo (sticking point).',
      ],
      evidence: [
        {
          claim:
            'Las sentadillas profundas generan mayor activación EMG del glúteo mayor que las sentadillas parciales o hasta paralela.',
          refIndices: [0],
        },
        {
          claim:
            'El entrenamiento con mayor rango de movimiento produce adaptaciones musculares superiores a largo plazo en comparación con sentadillas parciales.',
          refIndices: [1, 6],
        },
        {
          claim:
            'La carga sobre la articulación de la rodilla (fuerza de cizallamiento en el ligamento cruzado anterior y posterior) aumenta con la profundidad, pero se mantiene muy por debajo de los umbrales de fallo tisular reportados en estudios biomecánicos cuando la técnica es correcta.',
          refIndices: [2, 5],
        },
        {
          claim:
            'La posición de barra alta genera mayor momento en la articulación de la rodilla, mientras que la barra baja transfiere más carga a la cadera y a la columna lumbar.',
          refIndices: [3, 4],
        },
      ],
      commonMistakes: [
        'Rodillas que colapsan hacia dentro (valgo de rodilla) durante el descenso o el ascenso. Cuida de empujar activamente las rodillas hacia fuera.',
        'Talones que se levantan del suelo, señal de falta de movilidad en el tobillo. Trabaja la dorsiflejión o usa elevaciones temporales bajo el talón mientras mejoras la movilidad.',
        'Excesiva inclinación del torso hacia delante, especialmente en barra alta. Mantén el pecho alto y la columna neutra.',
        'Ascenso tipo "buenos días": la cadera sube antes que el pecho y la barra se desplaza al frente, convirtiendo la sentadilla en un buenos días. Cadera y rodilla deben extenderse al mismo tiempo.',
        'Profundidad insuficiente. Bajarse solo hasta media sentadilla reduce la activación del glúteo y los beneficios adaptativos del movimiento.',
        'Contener el aire en exceso durante todo el ascenso o soltar el aire antes de tiempo, lo que reduce la estabilidad del core en el punto más exigente del movimiento.',
      ],
    },
    en: {
      title: 'Barbell Back Squat',
      description:
        'Evidence-based guide to the barbell back squat: technique, muscles worked, and common mistakes for strength programs.',
      summary: [
        'The barbell back squat is one of the most complete compound movements for lower-body development. It primarily targets the quadriceps and gluteus maximus, with significant contributions from the hamstrings, adductors, and core stabilizers.',
        'It is a staple of most strength and linear-progression programs: its straightforward progressive-overload loading scheme and high yield in muscle mass and strength make it one of the most widely programmed barbell movements in existence.',
        'Evidence shows that squat depth meaningfully influences muscle recruitment and long-term structural adaptations. Deep squats (below parallel) produce greater gluteus maximus and adductor magnus activation compared with partial squats, and do not impose additional knee risk when technique is sound.',
      ],
      technique: [
        'Position the bar on the upper traps (high bar) or across the rear delts and spine of the scapula (low bar). High bar emphasizes quadriceps; low bar shifts load toward the glutes and posterior chain.',
        'Set your feet at roughly shoulder width or slightly wider, toes turned out 15–30°. Optimal foot width and toe angle depend on individual hip morphology.',
        'Take a deep breath (partial Valsalva), brace the core to create intra-abdominal pressure, and maintain full-body tension throughout the descent.',
        'Initiate the movement by pushing the knees outward in line with the toes while simultaneously driving the hips back and down. Descend until the hip crease is at or below the knee (parallel or deeper).',
        'At the bottom, maintain a neutral spine — avoid excessive posterior pelvic tilt ("butt wink") — then drive the floor away, extending hips and knees simultaneously on the way up.',
        'Exhale in a controlled manner during the ascent once past the sticking point.',
      ],
      evidence: [
        {
          claim:
            'Deep squats elicit significantly greater EMG activation of the gluteus maximus than partial or parallel squats.',
          refIndices: [0],
        },
        {
          claim:
            'Training through a full range of motion produces superior long-term muscle hypertrophy compared with partial-depth squats.',
          refIndices: [1, 6],
        },
        {
          claim:
            'Knee shear forces increase with squat depth but remain well below reported tissue-failure thresholds in biomechanical studies when technique is sound.',
          refIndices: [2, 5],
        },
        {
          claim:
            'High-bar placement generates greater knee-joint moment, while low-bar placement transfers more load to the hip and lumbar spine.',
          refIndices: [3, 4],
        },
      ],
      commonMistakes: [
        'Knee valgus (knees caving inward) during descent or ascent. Actively cue the knees outward throughout the movement.',
        'Heels rising off the floor, indicating limited ankle dorsiflexion. Improve ankle mobility or use temporary heel elevation while working on flexibility.',
        'Excessive forward lean of the torso, particularly with high-bar positioning. Keep the chest up and maintain a neutral spine.',
        'Rising "hip first" (good-morning squat): extending the hip before the knee creates a dangerous lumbar flexion moment. Hips and knees must extend simultaneously.',
        'Insufficient depth. Stopping at half-depth reduces glute activation and limits long-term adaptive benefits.',
        'Releasing intra-abdominal pressure too early during the ascent, which compromises core stability at the most demanding point of the lift.',
      ],
    },
  },
  reviewedBy: 'PENDING',
  reviewedAt: '2026-06-20',
};
