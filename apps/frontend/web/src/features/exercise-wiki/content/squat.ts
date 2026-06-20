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
        'Desde el punto de vista biomecánico, la sentadilla implica momentos de flexión simultáneos en cadera, rodilla y tobillo. La distribución de carga entre cuádriceps y glúteo mayor depende de factores como la posición de la barra, la anchura de la pisada, el ángulo del torso y la profundidad. La barra baja favorece un torso más inclinado, lo que aumenta el momento en la cadera y recluta más la cadena posterior; la barra alta mantiene el torso más vertical, incrementando el momento en la rodilla y la participación del cuádriceps. Las longitudes de los segmentos óseos —especialmente fémur y torso— condicionan el ángulo de inclinación natural de cada persona.',
        'La evidencia indica que la profundidad influye tanto en el reclutamiento muscular como en las adaptaciones estructurales a largo plazo. Las sentadillas profundas (por debajo de la paralela) producen mayor activación del glúteo mayor y del aductor mayor en comparación con sentadillas parciales, y generan mayor hipertrofia muscular total sin que ello suponga un riesgo adicional para la rodilla cuando la técnica es correcta. Las fuerzas de cizallamiento en la rodilla aumentan con la profundidad pero permanecen muy por debajo de los umbrales de fallo tisular reportados en los estudios de referencia.',
      ],
      technique: [
        'POSICIÓN DE LA BARRA: Decide entre barra alta o barra baja. En barra alta, la barra descansa sobre los trapecios superiores, por encima de la espina de la escápula; en barra baja, se apoya sobre las espinas escapulares y los deltoides posteriores, varios centímetros más abajo. La barra alta promueve un torso más vertical y mayor activación del cuádriceps; la barra baja produce un torso más inclinado, desplazando la carga al glúteo, isquiotibiales y cadena posterior.',
        'AGARRE Y TENSIÓN DE ESPALDA: Toma la barra con las manos lo más cerca posible de los hombros (sin forzar si hay limitación de movilidad). Aprieta la barra hacia abajo activamente, junta los codos hacia el cuerpo y contrae la espalda alta para crear una "plataforma" muscular firme donde apoye la barra. Esto evita que la carga se traslade directamente a la columna.',
        'ANCHURA DE PISADA Y ÁNGULO DE LOS PIES: Coloca los pies a la anchura de los hombros o algo más amplia, con los pies girados hacia fuera entre 15° y 30°. El ángulo óptimo lo dicta la morfología de tu cadera: caderas con acetábulo más profundo o fémur más horizontalizado requieren mayor apertura. Los pies deben apuntar en la misma dirección que las rodillas durante todo el movimiento.',
        'BRACING (PRESIÓN INTRAABDOMINAL): Antes de iniciar el descenso, inhala profundo llenando el abdomen —no solo el pecho— y cierra la glotis (maniobra de Valsalva). Contrae simultáneamente los oblicuos y el transverso del abdomen como si fueras a recibir un golpe. Esta presión intraabdominal aumenta la rigidez de la columna lumbar y reduce la carga discal. Mantén esta tensión durante todo el descenso y el ascenso; suelta el aire de forma controlada solo una vez superado el sticking point.',
        'DESCENSO: Inicia el movimiento empujando las rodillas hacia fuera en la dirección de los pies mientras llevas la cadera hacia atrás y abajo de forma simultánea. Evita romper primero por la cadera (tipo "buenos días") o primero por la rodilla (tipo "sentadilla de dominante rodilla") de manera exagerada; el descenso equilibrado distribuye la carga entre cuádriceps y glúteo. Mantén el pecho elevado y la columna neutra. El ritmo de descenso puede ser controlado (2-3 segundos) para mejorar la técnica y maximizar el tiempo bajo tensión.',
        'POSICIÓN INFERIOR Y PROFUNDIDAD: El objetivo es alcanzar al menos la paralela —pliegue de la cadera al mismo nivel que la rótula— o más profundo si la movilidad y morfología lo permiten. En el punto más bajo, las rodillas deben seguir alineadas con los pies, los talones en contacto con el suelo y la espalda neutra. Un ligero redondeo lumbar ("butt wink") al final del rango puede ser anatómicamente inevitable en algunas personas, pero debe minimizarse.',
        'ASCENSO Y EXTENSIÓN: Arranca el ascenso empujando el suelo hacia abajo y hacia atrás, como si quisieras "abrirlo" con los pies hacia los lados. Extiende cadera y rodilla de manera simultánea para mantener el ángulo del torso constante; si la cadera sube antes que el pecho, la barra se adelanta y la carga pasa a la zona lumbar. Mantén las rodillas en línea con los pies y el core activo durante todo el ascenso.',
        'RESPIRACIÓN Y CICLO DE REPETICIONES: Para series pesadas con pocas repeticiones, ejecuta la maniobra de Valsalva completa en cada repetición —inhala arriba, baja, sube y exhala arriba. Para series con más repeticiones y carga moderada puedes ventilar ligeramente en la parte alta del movimiento entre repeticiones, siempre reactivando la presión intraabdominal antes de iniciar el siguiente descenso.',
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
      variations: [
        {
          name: 'Sentadilla barra alta',
          detail:
            'La barra descansa sobre los trapecios superiores, promoviendo un torso más vertical y mayor activación del cuádriceps. Es la variante de referencia para la mayoría de los practicantes de musculación y programas de fuerza general.',
        },
        {
          name: 'Sentadilla barra baja',
          detail:
            'La barra se apoya sobre las espinas escapulares, inclinando el torso hacia delante y desplazando la carga hacia el glúteo mayor, los isquiotibiales y la cadena posterior. Permite manejar más carga absoluta y es preferida en contextos de fuerza máxima.',
        },
        {
          name: 'Sentadilla frontal',
          detail:
            'La barra descansa sobre los deltoides anteriores con los codos elevados. Exige mayor movilidad de tobillo y muñeca, obliga a un torso muy vertical y activa intensamente el cuádriceps con menor estrés lumbar. Es una progresión exigente y excelente para desarrollar movilidad.',
        },
        {
          name: 'Sentadilla pausa',
          detail:
            'Se realiza una pausa de 2-3 segundos en el punto más bajo antes de ascender. Elimina el rebote del tendón y el componente elástico, incrementando la demanda de fuerza pura y la conciencia corporal en la posición de máxima flexión. Útil para corregir el sticking point y mejorar la técnica.',
        },
        {
          name: 'Sentadilla con tempo',
          detail:
            'Se prescribe un ritmo específico en el descenso (p. ej., 3-4 segundos), aumentando el tiempo bajo tensión y la demanda muscular sin necesidad de incrementar la carga. Herramienta eficaz para el trabajo técnico y la hipertrofia con cargas submáximas.',
        },
        {
          name: 'Sentadilla goblet (regresión)',
          detail:
            'Se sostiene una mancuerna o kettlebell frente al pecho. Facilita un torso vertical, entrena de forma natural la posición correcta y es ideal como punto de partida antes de introducir la barra, o como ejercicio de calentamiento y movilidad.',
        },
      ],
    },
    en: {
      title: 'Barbell Back Squat',
      description:
        'Evidence-based guide to the barbell back squat: technique, muscles worked, and common mistakes for strength programs.',
      summary: [
        'The barbell back squat is one of the most complete compound movements for lower-body development. It primarily targets the quadriceps and gluteus maximus, with significant contributions from the hamstrings, adductors, and core stabilizers.',
        'From a biomechanical standpoint, the squat involves simultaneous flexion moments at the hip, knee, and ankle. The load distribution between the quadriceps and gluteus maximus is governed by bar position, stance width, torso angle, and squat depth. Low-bar placement produces greater forward lean, increasing the hip moment and recruiting more of the posterior chain; high-bar placement keeps the torso more upright, raising the knee moment and quadriceps demand. Individual segment lengths — particularly femur and torso — dictate the natural lean each lifter will exhibit.',
        'Evidence shows that squat depth meaningfully influences muscle recruitment and long-term structural adaptations. Deep squats (below parallel) produce greater gluteus maximus and adductor magnus activation compared with partial squats, and generate greater overall hypertrophy without imposing additional knee risk when technique is sound. Knee shear forces increase with depth but remain well below reported tissue-failure thresholds in biomechanical studies.',
      ],
      technique: [
        'BAR POSITION: Choose between high bar and low bar. In the high-bar position, the bar rests on the upper traps above the spine of the scapula; in the low-bar position, it sits across the rear delts and scapular spines, several centimeters lower. High bar promotes a more upright torso and greater quad emphasis; low bar produces more forward lean, shifting demand to the glutes, hamstrings, and posterior chain.',
        'GRIP AND UPPER-BACK TENSION: Take as narrow a grip as your shoulder mobility allows. Actively pull the bar down into your traps, drive the elbows toward your sides, and contract the upper back to build a firm muscular shelf for the bar. This tension prevents the load from transferring directly to the spine and keeps the thoracic spine extended throughout the lift.',
        'STANCE WIDTH AND TOE ANGLE: Place your feet roughly shoulder-width apart or slightly wider, with toes turned out 15–30°. The optimal angle is dictated by hip morphology: deeper acetabular sockets or more horizontal femoral orientation typically require a wider, more turned-out stance. Toes and knees must track in the same direction throughout the movement.',
        'BRACING (INTRA-ABDOMINAL PRESSURE): Before initiating the descent, take a deep belly breath — filling the abdomen, not just the chest — and close the glottis (Valsalva maneuver). Simultaneously contract the obliques and transverse abdominis as if bracing for a punch. This intra-abdominal pressure increases lumbar spinal stiffness and reduces disc loading. Maintain this tension throughout the entire descent and ascent; exhale in a controlled manner only after passing the sticking point.',
        'DESCENT: Begin the movement by pushing the knees outward in the direction of the toes while simultaneously driving the hips back and down. Avoid initiating excessively with the hip (turning it into a good-morning) or excessively with the knee (creating a purely knee-dominant dive). A balanced descent distributes load between quads and glutes. Keep the chest tall and the spine neutral. A controlled descent tempo (2–3 seconds) improves technique and increases time under tension.',
        'BOTTOM POSITION AND DEPTH: The target is at minimum parallel — hip crease level with the top of the knee — or deeper if mobility and anatomy allow. At the bottom, knees should track over the toes, heels remain in full contact with the floor, and the spine stays neutral. Minor posterior pelvic tilt ("butt wink") at end range may be anatomically unavoidable for some individuals but should be minimized.',
        'ASCENT AND DRIVE: Initiate the ascent by driving the floor away, as if trying to spread it outward with your feet. Extend hips and knees simultaneously to maintain a constant torso angle; if the hips rise faster than the chest, the bar drifts forward and the load shifts to the lumbar spine. Keep knees tracking over the toes and the core actively braced throughout the ascent.',
        'BREATHING AND REP CYCLING: For heavy low-rep sets, execute a full Valsalva on each rep — inhale at the top, descend, ascend, exhale at the top. For higher-rep sets with moderate loads, you may ventilate briefly at the top between reps, but always re-establish intra-abdominal pressure before initiating the next descent.',
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
      variations: [
        {
          name: 'High-bar squat',
          detail:
            'The bar rests on the upper traps, promoting a more upright torso and greater quad emphasis. This is the standard reference variant for most general strength training contexts and bodybuilding-oriented programs.',
        },
        {
          name: 'Low-bar squat',
          detail:
            'The bar sits across the rear delts and scapular spines, producing more forward lean and shifting demand toward the glutes, hamstrings, and posterior chain. It allows greater absolute load and is favored in maximal-strength contexts.',
        },
        {
          name: 'Front squat',
          detail:
            'The bar rests across the front delts with elbows elevated. It demands greater ankle and wrist mobility, enforces a very upright torso, and intensely loads the quadriceps with reduced lumbar stress. A technically demanding progression that also develops mobility.',
        },
        {
          name: 'Pause squat',
          detail:
            'A 2–3 second pause is held at the bottom before ascending. This eliminates the stretch-shortening reflex and elastic rebound, increasing the pure strength demand and body awareness at the deepest position. Effective for addressing the sticking point and reinforcing technique.',
        },
        {
          name: 'Tempo squat',
          detail:
            'A specific descent tempo is prescribed (e.g., 3–4 seconds), increasing time under tension and muscular demand without adding load. An effective tool for technical development and hypertrophy work at submaximal intensities.',
        },
        {
          name: 'Goblet squat (regression)',
          detail:
            'A dumbbell or kettlebell is held at the chest. The counterbalance naturally promotes a vertical torso and reinforces correct squat mechanics. Ideal as a starting point before introducing the barbell, or as a warm-up and mobility drill.',
        },
      ],
    },
  },
  reviewedBy: 'PENDING',
  reviewedAt: '2026-06-20',
};
