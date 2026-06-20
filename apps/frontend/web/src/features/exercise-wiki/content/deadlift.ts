import type { ExerciseArticle } from '@gzclp/domain/schemas/exercise-article';

export const deadliftArticle: ExerciseArticle = {
  exerciseId: 'deadlift',
  slug: { es: 'peso-muerto', en: 'deadlift' },
  muscleGroupId: 'back',
  equipment: 'barbell',
  level: 'beginner',
  primaryMuscles: ['erector spinae', 'gluteus maximus', 'hamstrings'],
  secondaryMuscles: ['quadriceps', 'trapezius', 'latissimus dorsi'],
  video: {
    youtubeId: 'iQ5rY_beDLY',
    title: '"Big on the Basics Beyond": Deadlift with Richard Hawthorne',
    channel: 'Animal',
    uploadDate: '2014-01-30',
    duration: 'PT16M34S',
  },
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
        'El peso muerto con barra es uno de los ejercicios multiarticulares más completos del entrenamiento de fuerza. Implica la extensión simultánea de caderas y rodillas para elevar una barra desde el suelo, reclutando con alta intensidad toda la cadena posterior: erectores espinales, glúteo máximo e isquiotibiales, con contribución secundaria del cuádriceps, trapecios y dorsal ancho.',
        'La cadena posterior trabaja de forma coordinada: los isquiotibiales generan el par de extensión de cadera junto al glúteo máximo, mientras que los erectores espinales mantienen la columna en posición neutra resistiendo el momento de flexión producido por el peso de la barra. El brazo de momento de la barra respecto a las vértebras lumbares es el factor crítico de carga espinal; mantener la barra cerca del cuerpo durante todo el recorrido minimiza ese brazo y redistribuye la carga de forma más segura.',
        'Existen dos variantes principales: el peso muerto convencional, con los pies a la anchura de las caderas y un agarre exterior a las piernas, y el sumo, con una postura más abierta y agarre interior. El convencional aumenta el rango de movimiento y el momento de extensión de cadera, generando mayor activación de isquiotibiales y erectores espinales lumbares. El sumo, al permitir un torso más vertical, reduce el momento de flexión lumbar y distribuye más trabajo hacia los aductores y cuádriceps, sin ser per se más fácil —la mayor apertura de cadera exige mayor movilidad—.',
        'Su alta demanda neuromuscular lo convierte en un movimiento principal en la mayoría de los programas de fuerza, lo que justifica ejecutarlo fresco al inicio de la sesión, antes de los accesorios y del trabajo secundario.',
      ],
      technique: [
        '**Posición inicial — pies y barra:** coloca los pies a la anchura de las caderas, con los dedos ligeramente hacia afuera (0–15°). La barra debe quedar sobre la línea media del pie, a unos 2–3 cm de las espinillas. Esta alineación sitúa el peso directamente bajo el centro de masa y garantiza una trayectoria vertical de la barra.',
        '**Agarre y anchura:** sin mover los pies, inclínate y agarra la barra en prono (doble overhand), con las manos justo fuera de los muslos. El agarre mixto (una mano en prono, otra en supino) o el hook grip permiten sostener más carga sin que el agarre sea el factor limitante; el prono simétrico es el más indicado para aprendizaje y trabajo técnico.',
        '**Altura de cadera y ángulo del torso:** lleva las caderas hacia abajo hasta que los brazos queden verticales y las escápulas directamente sobre la barra. No se trata de una sentadilla (cadera muy baja) ni de un good morning (cadera muy alta): la altura óptima es aquella que coloca los hombros ligeramente por delante de la barra y las caderas entre los hombros y las rodillas.',
        '**Tensión de espalda y dorsales:** antes de tirar, "mete" los omóplatos en los bolsillos traseros del pantalón (depresión escapular sin retracción excesiva) y activa los dorsales como si quisieras doblar la barra alrededor de las piernas. Esto estabiliza la columna torácica y evita que los hombros cedan al frente bajo carga.',
        '**Respiración y presión intraabdominal:** toma aire profundamente hacia el diafragma (360° de expansión abdominal), realiza la maniobra de Valsalva y mantén esa presión durante todo el ascenso. La presión intraabdominal actúa como un cinturón interno que reduce la carga sobre el disco lumbar.',
        '**Despegue — empuja el suelo:** inicia el movimiento empujando el suelo con los pies, no tirando de la barra hacia arriba. Rodillas y caderas se extienden de forma simultánea; la barra permanece pegada a las espinillas durante el despegue. Cualquier alejamiento horizontal de la barra aumenta el brazo de momento en la columna lumbar.',
        '**Paso de rodillas:** cuando la barra alcanza las rodillas, inclina ligeramente el torso hacia atrás mientras las caderas siguen avanzando. Las caderas y los hombros deben ascender a la misma velocidad; si las caderas suben más rápido, el torso cae y el patrón se convierte en un good morning.',
        '**Bloqueo:** al llegar a la cadera, extiéndela completamente apretando el glúteo. La posición final es erguida, con hombros, cadera y tobillo alineados verticalmente. No hiperextiendas la columna lumbar al finalizar: el bloqueo es extensión de cadera, no extensión lumbar.',
        '**Descenso:** es el recorrido inverso. Lleva las caderas hacia atrás primero (bisagra de cadera), después flexiona las rodillas cuando la barra desciende por ellas. Mantén la tensión corporal y la presión intraabdominal durante todo el bajada.',
      ],
      variations: [
        {
          name: 'Peso muerto convencional',
          detail:
            'El patrón estándar descrito en esta guía: pies a la anchura de caderas, agarre exterior. Mayor rango de movimiento y mayor momento de extensión de cadera que el sumo; punto de partida recomendado para la mayoría de los practicantes.',
        },
        {
          name: 'Peso muerto sumo',
          detail:
            'Postura amplia con puntas giradas hacia afuera y agarre interior a las piernas. Reduce el momento de flexión lumbar al permitir un torso más vertical y acorta el rango de movimiento; exige mayor movilidad de cadera y activación de aductores. Útil para quienes tienen proporciones femorales largas o limitaciones lumbares.',
        },
        {
          name: 'Romanian deadlift (RDL)',
          detail:
            'Comienza de pie con la barra en la cadera; el descenso se realiza mediante bisagra de cadera con rodillas ligeramente flexionadas, sin llegar al suelo. Aísla la cadena posterior (isquiotibiales y glúteo) con tensión excéntrica prolongada y es uno de los mejores accesorios para reforzar la parte superior del tirón y la bisagra de cadera.',
        },
        {
          name: 'Peso muerto en déficit',
          detail:
            'Se ejecuta de pie sobre una plataforma elevada (2–5 cm), lo que aumenta el rango de movimiento en la fase inicial. Exige mayor dorsiflexión de tobillo y movilidad general, y es útil para desarrollar fuerza en el despegue cuando este es el punto débil.',
        },
        {
          name: 'Jalón desde bloque / rack pull',
          detail:
            'La barra parte de bloques o de los pines del rack a la altura de la rodilla o por encima. Reduce el rango de movimiento y permite usar más carga, lo que desarrolla fuerza específica en la parte superior del tirón y el bloqueo. También útil como variante de transición cuando hay limitaciones de movilidad.',
        },
        {
          name: 'Peso muerto con barra hexagonal (trap bar)',
          detail:
            'El atleta se sitúa dentro de la barra, lo que desplaza el centro de masa hacia el cuerpo y permite un torso más vertical y caderas más bajas. Reduce el momento de flexión lumbar y el estrés sobre los isquiotibiales; es una opción accesible para principiantes y útil en contextos de rehabilitación o cuando se busca mayor implicación del cuádriceps.',
        },
      ],
      evidence: [
        {
          claim:
            'El peso muerto convencional genera un momento de extensión de cadera significativamente mayor que el sumo y produce mayor activación EMG del bíceps femoral y los erectores espinales lumbares superiores; el sumo reduce el brazo de momento lumbar al permitir un torso más vertical.',
          refIndices: [0, 1],
        },
        {
          claim:
            'La revisión sistemática de Martín-Fuentes et al. (2020) identificó los erectores espinales y el cuádriceps como los músculos con mayor activación relativa durante el peso muerto, seguidos del glúteo máximo e isquiotibiales, con variabilidad metodológica considerable entre estudios.',
          refIndices: [2],
        },
        {
          claim:
            'El glúteo máximo y el grupo de isquiotibiales muestran una activación elevada durante el peso muerto con barra en comparación con otros ejercicios de cadena posterior con carga, lo que confirma el rol del movimiento como estímulo principal para estos grupos musculares.',
          refIndices: [3],
        },
        {
          claim:
            'Una sesión de peso muerto con cargas altas produce cambios agudos medibles en los discos intervertebrales lumbares, lo que subraya la importancia de una técnica correcta —especialmente minimizar el brazo de momento de la barra— y una progresión de carga gradual.',
          refIndices: [4],
        },
      ],
      commonMistakes: [
        'Redondear la espalda baja al inicio del tirón: surge de no generar tensión previa en la columna (extensión torácica + dorsales activos + Valsalva) antes de arrancar.',
        'Alejar la barra del cuerpo durante el ascenso, lo que aumenta considerablemente el brazo de momento en la columna lumbar y la carga sobre los discos.',
        'Hiperextender la zona lumbar al bloquear, sustituyendo la extensión de cadera por extensión lumbar y sobrecargando los arcos vertebrales posteriores.',
        'Iniciar el movimiento tirando de los hombros hacia atrás en lugar de empujar el suelo con los pies, lo que rompe el ritmo lumbopélvico y convierte el despegue en un good morning.',
        'No mantener la presión intraabdominal durante todo el recorrido, desestabilizando el raquis bajo carga.',
      ],
    },
    en: {
      title: 'Barbell Deadlift',
      description:
        'A posterior-chain movement training the glutes, hamstrings, and erector spinae through a coordinated hip and knee extension from the floor.',
      summary: [
        'The barbell deadlift is one of the most complete compound movements in strength training. It requires simultaneous hip and knee extension to lift a loaded barbell from the floor, producing high-intensity recruitment of the entire posterior chain: erector spinae, gluteus maximus, and hamstrings, with secondary contributions from the quadriceps, trapezius, and latissimus dorsi.',
        'The posterior chain operates in a coordinated fashion: the hamstrings and gluteus maximus generate the hip-extension torque, while the erector spinae resist the flexion moment imposed by the barbell and maintain a neutral spinal position. The moment arm of the bar relative to the lumbar vertebrae is the critical determinant of spinal loading; keeping the bar close to the body throughout the lift minimizes that moment arm and distributes load more safely across the posterior structures.',
        'Two main variants exist: the conventional deadlift, with feet hip-width apart and a grip outside the legs, and the sumo deadlift, with a wider stance and inside grip. The conventional style increases the range of motion and the hip-extension moment, eliciting greater hamstring and lumbar erector activation. The sumo style, by allowing a more vertical torso, reduces the lumbar flexion moment and shifts more demand to the adductors and quadriceps — it is not inherently easier, as the wider hip angle demands greater hip mobility.',
        'Its high neuromuscular demand makes it a primary movement in the majority of strength programs, which is why it is best performed fresh at the start of the session, before secondary and accessory work.',
      ],
      technique: [
        "**Setup — feet and bar position:** stand with feet hip-width apart, toes turned out slightly (0–15°). The barbell should sit over the mid-foot, roughly 2–3 cm from the shins. This alignment places the load directly beneath the body's center of mass and ensures a vertical bar path.",
        '**Grip and hand width:** without moving your feet, hinge down and grip the bar in a double overhand (pronated) grip, hands just outside the thighs. A mixed grip (one hand pronated, one supinated) or hook grip allows heavier loads without grip being the limiting factor; the symmetric overhand grip is preferred for learning and technical work.',
        '**Hip height and torso angle:** lower the hips until the arms hang vertically and the scapulae are directly above the bar. This is neither a squat (hips too low) nor a good morning (hips too high): the optimal position places the shoulders slightly ahead of the bar, with the hips between the shoulders and the knees in height.',
        '**Back tension and lat engagement:** before pulling, "put your shoulder blades in your back pockets" (scapular depression without excessive retraction) and engage the lats as if trying to bend the bar around your legs. This locks the thoracic spine and prevents the shoulders from rounding forward under load.',
        '**Breathing and intra-abdominal pressure:** take a deep diaphragmatic breath (360° abdominal expansion), perform a Valsalva maneuver, and maintain that pressure throughout the ascent. Intra-abdominal pressure functions as an internal belt, reducing compressive load on the lumbar disc.',
        '**Lift-off — push the floor away:** initiate the movement by driving the floor down with your feet, not by pulling the bar up. Knees and hips extend simultaneously; the bar stays dragging along the shins throughout the lift-off. Any horizontal drift of the bar increases the lumbar moment arm.',
        '**Passing the knees:** as the bar reaches knee height, allow the torso to lean back slightly while the hips continue to rise. Hips and shoulders should ascend at the same rate; if the hips rise faster, the torso drops forward and the pattern degrades into a good morning.',
        '**Lockout:** at hip height, complete the extension by squeezing the glutes. The finish position is upright, with shoulders, hips, and ankles vertically aligned. Do not hyperextend the lumbar spine at lockout — the goal is hip extension, not lumbar extension.',
        '**Descent:** reverse the ascent pattern. Push the hips back first (hip hinge), then re-bend the knees as the bar descends past them. Maintain full-body tension and intra-abdominal pressure throughout the lowering phase.',
      ],
      variations: [
        {
          name: 'Conventional deadlift',
          detail:
            'The standard pattern described in this guide: hip-width stance, overhand grip outside the legs. Greater range of motion and larger hip-extension moment than sumo; the recommended starting point for most trainees.',
        },
        {
          name: 'Sumo deadlift',
          detail:
            'Wide stance with toes flared out and grip inside the legs. Reduces the lumbar flexion moment by allowing a more vertical torso and shortens the range of motion; demands greater hip mobility and adductor recruitment. Well-suited for athletes with long femurs or lumbar load concerns.',
        },
        {
          name: 'Romanian deadlift (RDL)',
          detail:
            'Starts standing with the bar at hip height; the descent is a pure hip hinge with soft knees, stopping before the plates touch the floor. Isolates the posterior chain (hamstrings and glutes) under prolonged eccentric tension and is one of the best accessories for reinforcing the upper pull and hip-hinge pattern.',
        },
        {
          name: 'Deficit deadlift',
          detail:
            'Performed standing on an elevated platform (2–5 cm), increasing the range of motion at the bottom of the pull. Demands greater ankle dorsiflexion and overall mobility, and is effective for building strength off the floor when the lift-off is the limiting weak point.',
        },
        {
          name: 'Block pull / rack pull',
          detail:
            'The bar starts on blocks or rack pins at knee height or above, reducing the range of motion and allowing heavier loading. Develops specific strength in the upper pull and lockout. Also useful as a transitional variant when mobility restricts full-range work.',
        },
        {
          name: 'Trap-bar (hex-bar) deadlift',
          detail:
            'The lifter stands inside the bar, shifting the center of mass closer to the body and allowing a more vertical torso and lower hips. Reduces the lumbar flexion moment and hamstring demand; an accessible option for beginners and a useful rehabilitation or quad-dominant variant.',
        },
      ],
      evidence: [
        {
          claim:
            'The conventional deadlift produces significantly greater hip extension moments than the sumo style and elicits higher biceps femoris and upper lumbar erector spinae EMG activation; the sumo style reduces the lumbar moment arm by permitting a more vertical torso.',
          refIndices: [0, 1],
        },
        {
          claim:
            'The 2020 systematic review by Martín-Fuentes et al. identified the erector spinae and quadriceps as the most highly activated muscles during the deadlift, followed by the gluteus maximus and hamstrings, with notable methodological variability across studies.',
          refIndices: [2],
        },
        {
          claim:
            'The gluteus maximus and hamstring group show elevated activation during the barbell deadlift compared with other loaded posterior-chain exercises, confirming its role as a primary stimulus for these muscle groups.',
          refIndices: [3],
        },
        {
          claim:
            "Heavy deadlift sessions produce measurable acute changes in lumbar intervertebral disc morphology, underscoring the importance of sound technique — particularly minimizing the bar's moment arm — and a gradual loading progression.",
          refIndices: [4],
        },
      ],
      commonMistakes: [
        'Rounding the lower back at the start of the pull: caused by failing to generate spinal tension (thoracic extension + active lats + Valsalva) before initiating.',
        'Allowing the bar to drift away from the body during the ascent, which substantially increases the lumbar moment arm and disc loading.',
        'Hyperextending the lumbar spine at lockout, substituting lumbar extension for hip extension and overloading the posterior facet joints.',
        'Initiating the movement by pulling the shoulders back instead of pushing the floor away with the feet, breaking the lumbo-pelvic rhythm and turning the lift-off into a good morning.',
        'Losing intra-abdominal pressure mid-lift, destabilizing the spine under load.',
      ],
    },
  },
  reviewedBy: 'Luis Reche',
  reviewedAt: '2026-06-20',
};
