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
        'El press de banca con barra es el ejercicio de empuje horizontal más estudiado en la literatura científica. Activa principalmente el pectoral mayor (porciones esternal y clavicular) y el tríceps braquial, con el deltoides anterior como sinérgico principal. La distribución relativa de la carga entre estas estructuras varía en función del ancho de agarre y el ángulo del banco.',
        'El ancho de agarre determina en gran medida qué región del pectoral se activa con mayor intensidad: un agarre más ancho enfatiza la porción esternal del pectoral mayor y acorta el recorrido del codo, mientras que un agarre más estrecho aumenta la participación del tríceps braquial y la porción clavicular. La zona de adherencia (sticking region), que se produce típicamente a un tercio del recorrido ascendente, es el punto de mayor dificultad biomecánica y donde suelen producirse los fallos.',
        'El posicionamiento escapular —retracción y depresión mantenidas durante todo el movimiento— es el factor técnico con mayor impacto en la salud del hombro: una escapula protraída durante la fase de empuje incrementa las cargas sobre las estructuras anteriores de la articulación glenohumeral. Dominar la técnica antes de añadir carga es imprescindible para progresar sin lesiones.',
      ],
      technique: [
        'CONFIGURACIÓN — Ajusta el rack para que la barra quede a la altura de los brazos casi extendidos al tumbar. Túmbate con los ojos directamente bajo la barra. Apoya ambos pies completamente en el suelo; si el banco es demasiado alto, usa plataformas o tacos.',
        'AGARRE — Toma la barra con un agarre pronado a una anchura aproximadamente 1,5 veces la distancia biacromial (el índice debe quedar cerca de las marcas de moleteado en barras estándar). Los pulgares rodean la barra completamente (nunca agarre suicida). Revisa la simetría: la misma distancia de cada mano al collar.',
        'RETRACCIÓN Y DEPRESIÓN ESCAPULAR — Antes de desrackear, junta los omóplatos hacia la columna (retracción) y tíralos hacia abajo en dirección a los bolsillos traseros (depresión). Este «bloqueo» escapular crea la plataforma estable que protege el hombro y mejora la transferencia de fuerza al pectoral. Mantén esta posición durante toda la serie.',
        'ARCO Y APOYO — Un arco lumbar natural (no extremo) es aceptable y habitual: permite mantener las escápulas retraídas. Los glúteos y la zona dorsal superior deben permanecer en contacto con el banco. Activa las piernas presionando el suelo; este «leg drive» transmite estabilidad a la cadena cinética y puede incrementar la producción de fuerza en la fase de empuje.',
        'DESRACKEO Y POSICIÓN DE SALIDA — Desrackea la barra con una extensión controlada, muévela horizontalmente hasta que quede sobre la parte inferior del esternón / porción superior del pecho, y estabiliza antes de iniciar la bajada. Los brazos deben estar extendidos pero sin bloquear el codo.',
        'DESCENSO (FASE EXCÉNTRICA) — Baja la barra de forma controlada (2–3 segundos) describiendo una leve trayectoria en arco hacia el pecho. El punto de contacto natural es la región esternal inferior / pecho superior. Mantén los codos a 45–75° del torso: ni pegados al cuerpo ni abiertos en T. Este ángulo reduce el estrés sobre el manguito rotador sin sacrificar activación pectoral.',
        'PAUSA — Una pausa breve de 1 segundo al tocar el pecho (sin rebotar) elimina el impulso elástico y maximiza el trabajo muscular. Es especialmente útil para construir fuerza en la posición de mayor desventaja mecánica.',
        'EMPUJE (FASE CONCÉNTRICA) — Desde el pecho, empuja la barra hacia arriba y ligeramente hacia la cabeza siguiendo una trayectoria en arco suave hasta el bloqueo. Sincroniza el leg drive con el inicio del empuje. La barra debe describir un arco, no subir en línea vertical, para seguir la línea de acción de los pectorales.',
        'RESPIRACIÓN Y BRACING — Toma aire profundo y crea presión intraabdominal (maniobra de Valsalvi modificada) antes de iniciar cada repetición. Exhala de forma controlada al superar la zona de adherencia o al llegar al bloqueo. No exhales durante la bajada ni en el punto de mayor esfuerzo.',
      ],
      variations: [
        {
          name: 'Press de banca inclinado (30–45°)',
          detail:
            'Desplaza la activación hacia la porción clavicular (superior) del pectoral mayor e incrementa notablemente la participación del deltoides anterior. Útil para desarrollar la región superior del pecho y complementar el press plano en programas de fuerza e hipertrofia.',
        },
        {
          name: 'Press con agarre cerrado (≈ anchura de hombros)',
          detail:
            'Aumenta la demanda sobre el tríceps braquial y reduce el rango de movimiento de las articulaciones del hombro. Se usa como accesorio para reforzar el tríceps y trabajar la zona de adherencia del press plano.',
        },
        {
          name: 'Press pausado',
          detail:
            'Consiste en mantener una pausa de 1–3 segundos con la barra apoyada en el pecho antes de empujar. Elimina el rebote y el impulso elástico, mejora la fuerza en la posición de desventaja mecánica y es un estímulo eficaz para desarrollar potencia desde el fondo.',
        },
        {
          name: 'Press con agarre ancho (> 2× distancia biacromial)',
          detail:
            'Maximiza la activación de la porción esternal del pectoral y acorta el rango de movimiento del codo. Aumenta el estrés sobre el hombro si se usa de forma permanente; más apropiado como variante ocasional para trabajar el pectoral con mayor especificidad.',
        },
        {
          name: 'Press con mancuernas en banco plano',
          detail:
            'Permite un mayor rango de movimiento en la fase de estiramiento y obliga a cada lado a trabajar de forma independiente, lo que ayuda a corregir desequilibrios laterales. Es una regresión útil para aprender el patrón de movimiento y un accesorio de hipertrofia muy extendido.',
        },
        {
          name: 'Flexiones (push-up) o press en máquina',
          detail:
            'Regresiones para quienes no dominan todavía la coordinación escapular bajo carga o no tienen acceso a barra. Las flexiones entrenan el mismo patrón con carga corporal y permiten la escápula móvil; el press en máquina reduce las demandas de estabilización y facilita aprender el recorrido.',
        },
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
        'The barbell bench press is the most extensively researched horizontal pushing exercise in the strength training literature. It primarily activates the pectoralis major (both sternal and clavicular portions) and the triceps brachii, with the anterior deltoid as the main synergist. The relative load distribution among these structures shifts with grip width and bench angle.',
        'Grip width is the primary determinant of which region of the pectoralis major is most recruited: a wider grip emphasizes the sternal head and shortens elbow range of motion, while a narrower grip increases triceps brachii demand and shifts some work toward the clavicular head. The sticking region — occurring roughly one-third of the way up the concentric phase — is the point of greatest biomechanical disadvantage and the most common location for repetition failure.',
        'Scapular positioning — retraction and depression maintained throughout the lift — is the single technical factor with the greatest impact on shoulder health. A protracted scapula during the press phase significantly increases loads on the anterior glenohumeral structures. Owning the technique before pursuing heavier loads is non-negotiable for long-term progress.',
      ],
      technique: [
        'SETUP — Set the rack so the bar sits at nearly full arm extension when lying down. Position yourself so your eyes are directly under the bar. Both feet flat on the floor; if the bench is too high, use plates or a platform as foot support.',
        'GRIP — Take a pronated grip approximately 1.5× biacromial width (index fingers near the knurling rings on a standard bar). Wrap your thumbs fully around the bar — never use a thumbless grip. Check symmetry: equal distance from each hand to the collar.',
        'SCAPULAR RETRACTION AND DEPRESSION — Before unracking, draw your shoulder blades toward your spine (retraction) and pull them down toward your rear pockets (depression). This "locked" scapular position creates the stable platform that protects the shoulder and improves force transfer to the pectorals. Hold this position for the entire set.',
        'ARCH AND FOOT DRIVE — A natural (not extreme) lumbar arch is acceptable and common: it allows the scapulae to stay retracted. Glutes and upper back must remain in contact with the bench. Press your feet into the floor; this leg drive transmits stability through the kinetic chain and can increase force output during the press phase.',
        'UNRACK AND START POSITION — Unrack with a controlled extension, shift the bar horizontally until it sits over the lower sternum / upper chest, and stabilize before beginning the descent. Arms extended but not hyperextended at the elbow.',
        'DESCENT (ECCENTRIC PHASE) — Lower the bar under control (2–3 seconds) along a slight arc toward your chest. The natural touch point is the lower sternal region / upper chest. Keep elbows at 45–75° from your torso: not tucked to your sides, not flared to a full T. This angle reduces rotator cuff stress without sacrificing pectoral recruitment.',
        'PAUSE — A brief 1-second pause with the bar touching the chest (no bounce) eliminates elastic rebound and maximizes muscular work. Especially effective for building strength at the point of greatest mechanical disadvantage.',
        'PRESS (CONCENTRIC PHASE) — From the chest, drive the bar upward and very slightly back toward your head along a gentle arc to lockout. Sync the leg drive with the start of the push. The bar should travel in an arc, not straight up, to follow the line of action of the pectorals.',
        'BREATHING AND BRACING — Take a full breath and build intra-abdominal pressure (modified Valsalva) before initiating each rep. Exhale in a controlled manner after clearing the sticking region or at lockout. Do not exhale during the descent or at the moment of greatest effort.',
      ],
      variations: [
        {
          name: 'Incline bench press (30–45°)',
          detail:
            'Shifts activation toward the clavicular (upper) head of the pectoralis major and markedly increases anterior deltoid involvement. Useful for developing upper chest thickness and complementing the flat bench in strength and hypertrophy programs.',
        },
        {
          name: 'Close-grip bench press (≈ shoulder width)',
          detail:
            'Increases triceps brachii demand and reduces shoulder joint range of motion. Used as an accessory movement to build the triceps and target the sticking region of the flat bench.',
        },
        {
          name: 'Paused bench press',
          detail:
            'Involves a 1–3 second pause with the bar on the chest before pressing. Eliminates bounce and elastic rebound, builds strength at the point of greatest mechanical disadvantage, and is an effective stimulus for developing starting strength from the bottom position.',
        },
        {
          name: 'Wide-grip bench press (> 2× biacromial width)',
          detail:
            'Maximizes sternal pectoralis major activation and shortens elbow range of motion. Increases shoulder stress when used consistently; more appropriate as an occasional variant for pectoral-specific stimulus.',
        },
        {
          name: 'Dumbbell bench press (flat)',
          detail:
            'Allows greater range of motion in the stretched position and forces each side to work independently, helping to address lateral strength imbalances. A useful regression for learning the movement pattern and a widely used hypertrophy accessory.',
        },
        {
          name: 'Push-up or machine press (regression)',
          detail:
            'Suitable for those still developing scapular coordination under load or without access to a barbell. Push-ups train the same pattern with bodyweight and allow natural scapular movement; machine press reduces stabilization demands and helps groove the range of motion.',
        },
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
  reviewedBy: 'Luis Reche',
  reviewedAt: '2026-06-20',
};
