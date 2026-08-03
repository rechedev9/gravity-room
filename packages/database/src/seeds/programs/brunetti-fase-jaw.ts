// brunetti-fase-jaw.ts — Brunetti 365 phase builder.
import type { ProgramDay, SlotDef } from './shared';
import { REST_6MIN, tmNcSlot, flatNcSlot, maxTestSlot } from './shared';
import { bwSlot, freeNoteSlot, ACC, TM, JAW_TM } from './brunetti-slots';
import { BOOK_JAW_B1, BOOK_JAW_B2, BOOK_JAW_B3 } from './brunetti-book-tables';

export function buildFaseJAW(): ProgramDay[] {
  const days: ProgramDay[] = [];
  const blocks = [
    { schedule: BOOK_JAW_B1, tm: JAW_TM.B1, num: 1, weekStart: 1 },
    { schedule: BOOK_JAW_B2, tm: JAW_TM.B2, num: 2, weekStart: 7 },
    { schedule: BOOK_JAW_B3, tm: JAW_TM.B3, num: 3, weekStart: 13 },
  ] as const;

  const nextTm = {
    squat: [JAW_TM.B2.SQUAT, JAW_TM.B3.SQUAT, undefined],
    bench: [JAW_TM.B2.BENCH, JAW_TM.B3.BENCH, undefined],
  } as const;
  const nextLabel = {
    squat: ['Sentadilla — TM Bloque 2', 'Sentadilla — TM Bloque 3', ''],
    bench: ['Press Banca — TM Bloque 2', 'Press Banca — TM Bloque 3', ''],
  } as const;

  // DL ramping notes by week in block (OCR p.94) — RPE open
  const dlRampNotes = [
    'Stacco ramping bajas reps: x2@8 (RPE). No usa escalera JAW.',
    'Stacco ramping: x3@8 (RPE).',
    'Stacco ramping: x3@8 (RPE).',
    'Stacco ramping: x2@8 (RPE).',
    'Stacco: 3×3 @RPE6 (no JAW %).',
  ] as const;

  for (const block of blocks) {
    const { schedule, tm, num, weekStart } = block;

    for (let local = 0; local < 5; local++) {
      const globalWeek = weekStart + local;
      const { pct, sets, reps } = schedule[local];
      const pctLabel = `${(pct * 100).toFixed(1)}%`;
      const jawNote = `JAW B${num} Sett${globalWeek}: ${pctLabel} ${reps}×${sets}s (Brunetti). ${REST_6MIN}`;

      // GIORNO UNO — Squat JAW, Panca JAW, Stacco ramp (OCR p.93–94)
      days.push({
        name: `JAW B${num} Sem. ${globalWeek} — Dia 1`,
        slots: [
          tmNcSlot(
            `jaw_b${num}_sq_d1_w${globalWeek}`,
            'squat',
            tm.SQUAT,
            pct,
            sets,
            reps,
            'main',
            jawNote
          ),
          flatNcSlot(
            `jaw_b${num}_rear_d1_w${globalWeek}`,
            'rear_delt_band',
            ACC.GENERAL,
            4,
            8,
            'accessory',
            'Aperture posteriori con elastico 4×6–10 (movimiento opuesto a cruces).'
          ),
          tmNcSlot(
            `jaw_b${num}_bp_d1_w${globalWeek}`,
            'bench',
            tm.BENCH,
            pct,
            sets,
            reps,
            'main',
            jawNote
          ),
          bwSlot(
            `jaw_b${num}_abs_d1_w${globalWeek}`,
            'plank',
            3,
            12,
            'Superset 3 giros: leg raise parallele + goodmorning seduto (flexionar bien la espalda) 10–12.'
          ),
          freeNoteSlot(
            `jaw_b${num}_gm_d1_w${globalWeek}`,
            'goodmorning-seated',
            ACC.GENERAL,
            3,
            12,
            'Goodmorning seduto del superset con leg raise.',
            'accessory'
          ),
          freeNoteSlot(
            `jaw_b${num}_dl_d1_w${globalWeek}`,
            'deadlift',
            TM.DEADLIFT,
            3,
            2,
            num === 3
              ? 'Stacco ramping ALTAS repeticiones (B3). No escalera JAW. (libro p.105)'
              : dlRampNotes[local]
          ),
        ],
      });

      // GIORNO DUE — Panca JAW, Squat JAW, Seal Row, Stacco rialzo
      days.push({
        name: `JAW B${num} Sem. ${globalWeek} — Dia 2`,
        slots: [
          flatNcSlot(
            `jaw_b${num}_rear_d2_w${globalWeek}`,
            'rear_delt_band',
            ACC.GENERAL,
            4,
            8,
            'accessory',
            'Aperture posteriori elastico 4×6–10.'
          ),
          tmNcSlot(
            `jaw_b${num}_bp_d2_w${globalWeek}`,
            'bench',
            tm.BENCH,
            pct,
            sets,
            reps,
            'main',
            jawNote
          ),
          tmNcSlot(
            `jaw_b${num}_sq_d2_w${globalWeek}`,
            'squat',
            tm.SQUAT,
            pct,
            sets,
            reps,
            'main',
            jawNote
          ),
          freeNoteSlot(
            `jaw_b${num}_seal_d2_w${globalWeek}`,
            'seal_row',
            ACC.SEAL,
            4,
            5,
            'Seal Row: salita lentissima 5" + fermo 3" en punto dificil. 4×5. Parcial; no subir del todo. Valida si toca bajo la panca.',
            'accessory'
          ),
          tmNcSlot(
            `jaw_b${num}_dl_elev_d2_w${globalWeek}`,
            'deadlift_elevated',
            TM.DEADLIFT,
            num === 3 ? 0.7 : 0.65,
            num === 3 ? 3 : 4,
            num === 3 ? 2 : 3,
            'main',
            'Stacco da rialzo 5–7cm 60–70% (B3: 65–75%) 2–4 reps × 3–5 series. Sin progresion semanal fija — navega el rango. Salida controlada.'
          ),
        ],
      });

      // GIORNO TRE — Panca JAW, Squat JAW, curl/french, leg curl
      days.push({
        name: `JAW B${num} Sem. ${globalWeek} — Dia 3`,
        slots: [
          tmNcSlot(
            `jaw_b${num}_bp_d3_w${globalWeek}`,
            'bench',
            tm.BENCH,
            pct,
            sets,
            reps,
            'main',
            jawNote
          ),
          tmNcSlot(
            `jaw_b${num}_sq_d3_w${globalWeek}`,
            'squat',
            tm.SQUAT,
            pct,
            sets,
            reps,
            'main',
            jawNote
          ),
          flatNcSlot(
            `jaw_b${num}_curl_d3_w${globalWeek}`,
            'curl_elastico',
            ACC.GENERAL,
            3,
            10,
            'accessory',
            'Superset 3 giros: curl bicipiti elastico + french press elastico ~8–12 reps (lejos del fallo).'
          ),
          flatNcSlot(
            `jaw_b${num}_french_d3_w${globalWeek}`,
            'french_press_band',
            ACC.GENERAL,
            3,
            10,
            'accessory',
            'French press elastico (superset con curl).'
          ),
          flatNcSlot(
            `jaw_b${num}_legcurl_d3_w${globalWeek}`,
            'leg_curl_prone',
            ACC.GENERAL,
            3,
            10,
            'accessory',
            'Superset: leg curl elastico/maquina + opcional stacco ligero si se usa plantilla 3 dias.'
          ),
        ],
      });

      // GIORNO QUATTRO — stacco ligero, no JAW on squat/bench main
      days.push({
        name: `JAW B${num} Sem. ${globalWeek} — Dia 4 (Ligero)`,
        slots: [
          tmNcSlot(
            `jaw_b${num}_dl_d4_w${globalWeek}`,
            'deadlift',
            TM.DEADLIFT,
            num === 3 ? 0.525 : 0.55,
            num === 1 ? 5 : 4,
            num === 1 ? 5 : 5,
            'main',
            num === 1
              ? "Stacco 5×5 recupero 1', ultima rep salita muy lenta. 50–55%. Estilo alternativo si manejas ambos."
              : num === 2
                ? 'Stacco 50–55% 3×6s recupero 45". Ultimas 2 series: salida lenta todas las reps.'
                : "Stacco 50–55% 5×4 serie recupero 1'."
          ),
          freeNoteSlot(
            `jaw_b${num}_incline_d4_w${globalWeek}`,
            'incline_db_press',
            ACC.INCLINE,
            4,
            8,
            'Spinte manubri panca 30° / panca inclinada bilanciere ligero (B2/B3 segun bloque).',
            'accessory'
          ),
          freeNoteSlot(
            `jaw_b${num}_seal_d4_w${globalWeek}`,
            'seal_row',
            ACC.SEAL,
            4,
            8,
            'Seal Row (obligatorio coordinativo). 3–4×6–10.',
            'accessory'
          ),
          freeNoteSlot(
            `jaw_b${num}_row_d4_w${globalWeek}`,
            'one_arm_row',
            ACC.ROW,
            3,
            6,
            'Rematore 1 braccio salita ≥5" 3×6/brazo.',
            'accessory'
          ),
          freeNoteSlot(
            `jaw_b${num}_bulg_d4_w${globalWeek}`,
            'bulgarian_split_squat',
            ACC.GENERAL,
            3,
            5,
            'Affondi bulgari: discesa 5", fermo 2", salita 5" (B1) o squat ligero 50–55% 5×3 (B3).',
            'accessory'
          ),
        ],
      });
    }

    // Test week — squat + bench max (JAW TM propagation). DL max recorded on TM.DEADLIFT only.
    const testWeek = weekStart + 5;
    days.push({
      name: `JAW Bloque ${num} — Test Maximo Sentadilla`,
      slots: [
        maxTestSlot(
          `jaw_b${num}_sq_test`,
          'squat',
          tm.SQUAT,
          'Sentadilla',
          num,
          nextLabel.squat[num - 1],
          nextTm.squat[num - 1]
        ),
      ],
    });
    days.push({
      name: `JAW Bloque ${num} — Test Maximo Press Banca`,
      slots: [
        maxTestSlot(
          `jaw_b${num}_bp_test`,
          'bench',
          tm.BENCH,
          'Press Banca',
          num,
          nextLabel.bench[num - 1],
          nextTm.bench[num - 1]
        ),
      ],
    });
    days.push({
      name: `JAW Bloque ${num} — Test Maximo Peso Muerto`,
      slots: [
        maxTestSlot(
          `jaw_b${num}_dl_test`,
          'deadlift',
          TM.DEADLIFT,
          'Peso Muerto',
          num,
          '',
          undefined
        ),
      ],
    });
    days.push({
      name: `JAW Bloque ${num} — Sem. ${testWeek} Recuperacion`,
      slots: [
        freeNoteSlot(
          `jaw_b${num}_seal_rec`,
          'seal_row',
          ACC.SEAL,
          3,
          8,
          'Recuperacion activa: Seal Row ligero + rear delt banda. Sin JAW.',
          'accessory'
        ),
        flatNcSlot(
          `jaw_b${num}_rear_rec`,
          'rear_delt_band',
          ACC.GENERAL,
          3,
          12,
          'accessory',
          'Deltoides posterior banda. Ligero.'
        ),
      ],
    });
  }

  return days;
}
