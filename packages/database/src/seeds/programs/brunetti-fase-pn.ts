// brunetti-fase-pn.ts — PN2 data-driven week templates (OCR p.72–77).
// Primary structure: PN_WEEKS[] → materializeWeek (no nested b1/week-13 day assembly).

import type { ProgramDay, SlotDef } from './shared';
import { tmNcSlot, flatNcSlot, NC } from './shared';
import { bwSlot, freeNoteSlot, ACC, TM } from './brunetti-slots';
import {
  BOOK_PN_SQUAT_D1_MAIN,
  BOOK_PN_BENCH_D1,
  BOOK_PN_DL_D3_B1,
  BOOK_PN_BENCH_D3_B2,
  BOOK_PN_SQUAT_D1_B2,
} from './brunetti-book-tables';

type Pct = { readonly pct: number; readonly sets: number; readonly reps: number };

type PnWeekSpec = {
  readonly week: number;
  readonly absD1Reps: number;
  readonly squatBwSets: number;
  readonly squatBwReps: number;
  readonly squatD1: Pct;
  readonly squatD1Note: string;
  readonly squatD1Top?: Pct;
  readonly benchD1: Pct;
  readonly benchD1Note: string;
  readonly dlD1: Pct;
  readonly dlD1Exercise: string;
  readonly dlD1Note: string;
  readonly hyperD2Reps: number;
  readonly hyperD2Note: string;
  readonly benchD2Tech: string;
  readonly benchD2Vol: Pct;
  readonly ohpD2Note: string;
  readonly rowD2Note: string;
  readonly dlElevD2: Pct;
  readonly dlElevD2Note: string;
  /** Day 3 mains: either test max or training lifts */
  readonly day3:
    | { readonly kind: 'test' }
    | {
        readonly kind: 'train';
        readonly dl: Pct;
        readonly dlNote: string;
        readonly bench: Pct;
        readonly benchNote: string;
        readonly box: Pct;
        readonly boxNote: string;
      };
  readonly absD4Sets: number;
  readonly dbBenchD4: { readonly sets: number; readonly reps: number; readonly note: string };
  readonly prensaD4Sets: number;
  readonly prensaD4Note: string;
};

const PN_B2_SQUAT_D1_NOTES = [
  'Sett6: 76% esquema 4-4-3-4-4 (aprox. 5×4), poi ramping a x2@8 (RPE).',
  'Sett7: 66% 6×4s + 75% 3 + 80% 2×2 (slots siguientes).',
  'Sett8: 78% 2-2-2-2-5 (esquema libro 22225).',
  'Sett9: 69% 5×3s + top sets 79%/85% (slots siguientes).',
  'Sett10: 80% 3-3-2-3-3 poi x1@8 (RPE).',
  'Sett11: 72% 5×3s poi x1@8 (RPE).',
  'Sett12: 82% 2-2-2-2-5.',
  'Sett13: 66% 6×4s + 75% 3 + 80% 2×2 — semana de test maximo al final del bloque.',
] as const;

const BENCH_D2_VOL_B1: readonly (Pct & { readonly tech: string })[] = [
  { tech: 'fermo 3" x1@8', pct: 0.66, sets: 5, reps: 4 },
  { tech: 'fermo 3" x1@8', pct: 0.58, sets: 4, reps: 7 },
  { tech: 'fermo 5" x1@8', pct: 0.69, sets: 5, reps: 4 },
  { tech: 'fermo 5" x1@8', pct: 0.61, sets: 4, reps: 7 },
  { tech: 'fermo 3" 85% 1x2s', pct: 0.725, sets: 3, reps: 4 },
];

const BENCH_D2_VOL_B2: readonly (Pct & { readonly tech: string })[] = [
  { tech: 'fermo 3" x1@8', pct: 0.72, sets: 4, reps: 4 },
  { tech: 'fermo 3" x1@8', pct: 0.64, sets: 3, reps: 8 },
  { tech: 'fermo 5" x1@8', pct: 0.75, sets: 4, reps: 4 },
  { tech: 'fermo 5" x1@8', pct: 0.67, sets: 3, reps: 8 },
  { tech: 'fermo 3" 85% 1x2s', pct: 0.725, sets: 3, reps: 4 },
  { tech: 'fermo 3" x1@8', pct: 0.78, sets: 4, reps: 4 },
  { tech: 'fermo 3" x1@8', pct: 0.7, sets: 2, reps: 8 },
  { tech: '75% 1x3s', pct: 0.65, sets: 3, reps: 3 },
];

const BENCH_D3_B1: readonly Pct[] = [
  { pct: 0.75, sets: 6, reps: 2 },
  { pct: 0.7, sets: 6, reps: 3 },
  { pct: 0.75, sets: 6, reps: 2 },
  { pct: 0.7, sets: 6, reps: 3 },
  { pct: 0.65, sets: 3, reps: 5 },
];

const BOX_B1: readonly Pct[] = [
  { pct: 0.6, sets: 5, reps: 5 },
  { pct: 0.7, sets: 4, reps: 5 },
  { pct: 0.65, sets: 5, reps: 4 },
  { pct: 0.6, sets: 5, reps: 5 },
  { pct: 0.7, sets: 5, reps: 5 },
];

const BOX_B2: readonly Pct[] = [
  { pct: 0.65, sets: 4, reps: 5 },
  { pct: 0.7, sets: 4, reps: 4 },
  { pct: 0.6, sets: 5, reps: 4 },
  { pct: 0.725, sets: 5, reps: 3 },
  { pct: 0.65, sets: 4, reps: 5 },
  { pct: 0.6, sets: 4, reps: 4 },
  { pct: 0.65, sets: 4, reps: 5 },
  { pct: 0.65, sets: 3, reps: 3 },
];

const BENCH_D1_B2: readonly Pct[] = [
  { pct: 0.8, sets: 7, reps: 3 },
  { pct: 0.75, sets: 6, reps: 4 },
  { pct: 0.8, sets: 7, reps: 3 },
  { pct: 0.75, sets: 6, reps: 4 },
  { pct: 0.7, sets: 4, reps: 4 },
  { pct: 0.85, sets: 5, reps: 2 },
  { pct: 0.8, sets: 9, reps: 3 },
  { pct: 0.8, sets: 1, reps: 1 },
];

const DL_D1_B2: readonly Pct[] = [
  { pct: 0.65, sets: 4, reps: 3 },
  { pct: 0.7, sets: 4, reps: 3 },
  { pct: 0.625, sets: 4, reps: 4 },
  { pct: 0.675, sets: 5, reps: 3 },
  { pct: 0.575, sets: 3, reps: 4 },
  { pct: 0.65, sets: 5, reps: 3 },
  { pct: 0.675, sets: 4, reps: 4 },
  { pct: 0.65, sets: 3, reps: 2 },
];

function buildB1Week(week: number): PnWeekSpec {
  const i = week - 1;
  const squat = BOOK_PN_SQUAT_D1_MAIN[i];
  const bench = BOOK_PN_BENCH_D1[i];
  const dlD3 = BOOK_PN_DL_D3_B1[i];
  const d2 = BENCH_D2_VOL_B1[i];
  const odd = week % 2 === 1;
  return {
    week,
    absD1Reps: 20,
    squatBwSets: 3,
    squatBwReps: 50,
    squatD1: squat,
    squatD1Note: `PN2 B1 Sett${week} squat. Tras el volumen: semanas impares → 3 singole a salire con fermo 2" + salita 5"; semanas pares → fermo 2" @55% luego top 75–78% 3×3. Sett5: + 80% 2×2.`,
    squatD1Top: week === 5 ? { pct: 0.8, sets: 2, reps: 2 } : undefined,
    benchD1: bench,
    benchD1Note: `Panca opz. pin altura pecho. ${(bench.pct * 100).toFixed(0)}% ${bench.reps}×${bench.sets}s.`,
    dlD1: { pct: odd ? 0.65 : 0.75, sets: 5, reps: 3 },
    dlD1Exercise: 'deadlift_partial_blocks',
    dlD1Note: `Stacco fino sotto ginocchio, fermo 2" sotto ginocchio poi riappoggia. Sett ${odd ? '1,3,5: 60–70%' : '2,4: 70–80%'} 3×5s. Recupero 1'.`,
    hyperD2Reps: 15,
    hyperD2Note: 'Hyperextension con peso detras de la cabeza 15×3.',
    benchD2Tech: d2.tech,
    benchD2Vol: d2,
    ohpD2Note: 'Spinte verticali manubri sin respaldo, presa neutra 5×6–10. Salita controlada.',
    rowD2Note: 'Rematore 1 braccio salita 5" 5×5.',
    dlElevD2: { pct: 0.7, sets: 4, reps: 6 },
    dlElevD2Note: 'Stacco da piccolo rialzo 65–75% 5–8 reps (superset con pulley).',
    day3: {
      kind: 'train',
      dl: dlD3,
      dlNote: `Stacco D3 B1 Sett${week}: ${(dlD3.pct * 100).toFixed(0)}% ${dlD3.reps}×${dlD3.sets}s + ramping a x1@8–9 con salita 5" o top sets (libro p.73).`,
      bench: BENCH_D3_B1[i],
      benchNote: `Panca D3 B1: ${BENCH_D3_B1[i].reps}×${BENCH_D3_B1[i].sets}s @ ${(BENCH_D3_B1[i].pct * 100).toFixed(0)}%.`,
      box: BOX_B1[i],
      boxNote: `Box Squat fermo 2". ${(BOX_B1[i].pct * 100).toFixed(0)}% ${BOX_B1[i].reps}×${BOX_B1[i].sets}s.`,
    },
    absD4Sets: 4,
    dbBenchD4: {
      sets: 4,
      reps: 8,
      note: 'Panca piana manubri, discesa a meta 8×4 serie. Presa neutra.',
    },
    prensaD4Sets: 3,
    prensaD4Note: 'Pressa 10–12 (B1) o 4×6–9 (B2).',
  };
}

function buildB2Week(week: number): PnWeekSpec {
  const i = week - 6;
  const squat = BOOK_PN_SQUAT_D1_B2[i];
  const benchD1 = BENCH_D1_B2[i];
  const dlD1 = DL_D1_B2[i];
  const d2 = BENCH_D2_VOL_B2[i];
  const isTest = week === 13;
  const benchD3 = isTest ? null : BOOK_PN_BENCH_D3_B2[i];
  const box = BOX_B2[i];

  return {
    week,
    absD1Reps: 15,
    squatBwSets: 2,
    squatBwReps: 20,
    squatD1: squat,
    squatD1Note: `PN2 B2 ${PN_B2_SQUAT_D1_NOTES[i]}`,
    benchD1,
    benchD1Note: isTest
      ? 'Sett13: ramping a x1@8 (RPE) — test week.'
      : `Panca pin B2. ${(benchD1.pct * 100).toFixed(0)}% ${benchD1.reps}×${benchD1.sets}s.`,
    dlD1,
    dlD1Exercise: 'deadlift',
    dlD1Note:
      'Stacco deficit 1–2cm fino sotto ginocchio; no soltar tension. Guia tambien la negativa.',
    hyperD2Reps: 10,
    hyperD2Note: 'Hyperextension salita controlada 10×3.',
    benchD2Tech: d2.tech,
    benchD2Vol: d2,
    ohpD2Note: 'Rematore 1 braccio deadstop 3×8/braccio sin descanso (B2).',
    rowD2Note: 'Rematore 1 braccio appoggia a terra cada rep 3×8/brazo.',
    dlElevD2: { pct: 0.65, sets: 4, reps: 3 },
    dlElevD2Note: 'Stacco da rialzo B2 segun semana (62–72.5% esquemas libro p.76).',
    day3: isTest
      ? { kind: 'test' }
      : {
          kind: 'train',
          dl: squat,
          dlNote: `Stacco D3 B2 (espejo squat libro p.76). ${PN_B2_SQUAT_D1_NOTES[i]}`,
          bench: benchD3!,
          benchNote: `Panca fermo 1" B2 Sett${week}: ${(benchD3!.pct * 100).toFixed(0)}% ${benchD3!.reps}×${benchD3!.sets}s (libro p.76).`,
          box,
          boxNote: `Box Squat fermo 1" B2. ${(box.pct * 100).toFixed(1)}%.`,
        },
    absD4Sets: 3,
    dbBenchD4: {
      sets: 3,
      reps: 5,
      note: 'Panca inclinada 30–60° con RPE ramps/backoff segun semana (libro p.77) + manubri a meta 5×3s.',
    },
    prensaD4Sets: 4,
    prensaD4Note: 'Pressa 10–12 (B1) o 4×6–9 (B2).',
  };
}

/** All 13 PN2 weeks as pure prescription records (built once at module load). */
const PN_WEEKS: readonly PnWeekSpec[] = [
  ...[1, 2, 3, 4, 5].map(buildB1Week),
  ...[6, 7, 8, 9, 10, 11, 12, 13].map(buildB2Week),
];

function pnMaxTest(id: string, exerciseId: string, tmKey: string, label: string): SlotDef {
  return {
    id,
    exerciseId,
    tier: 'main',
    role: 'primary',
    stages: [{ sets: 1, reps: 1 }],
    onSuccess: NC,
    onMidStageFail: NC,
    onFinalStageFail: NC,
    startWeightKey: tmKey,
    isTestSlot: true,
    notes: `TEST DE 1RM — ${label}. Primer test real al terminar el Potenziamento Neurale (libro). Actualiza el TM de referencia para JAW.`,
  };
}

/** Thin materializer: one code path maps a week spec → 4 ProgramDays. */
function materializeWeek(spec: PnWeekSpec): ProgramDay[] {
  const w = spec.week;
  const d1: SlotDef[] = [
    bwSlot(
      `pn_abs_d1_w${w}`,
      'plank',
      3,
      spec.absD1Reps,
      `Addome parallele gambe piegate ${spec.absD1Reps}×3 serie.`
    ),
    bwSlot(
      `pn_squat_bw_d1_w${w}`,
      'squat_bodyweight',
      spec.squatBwSets,
      spec.squatBwReps,
      `Squat a corpo libero ${spec.squatBwReps}×${spec.squatBwSets} serie + stretch/mobilita.`
    ),
    tmNcSlot(
      `pn_squat_d1_w${w}`,
      'squat',
      TM.SQUAT,
      spec.squatD1.pct,
      spec.squatD1.sets,
      spec.squatD1.reps,
      'main',
      spec.squatD1Note
    ),
  ];
  if (spec.squatD1Top) {
    d1.push(
      tmNcSlot(
        `pn_squat_top_d1_w${w}`,
        'squat',
        TM.SQUAT,
        spec.squatD1Top.pct,
        spec.squatD1Top.sets,
        spec.squatD1Top.reps,
        'main',
        'Sett5 top: 80% 2×2 tras 65% 4×4.'
      )
    );
  }
  d1.push(
    tmNcSlot(
      `pn_bench_d1_w${w}`,
      'bench_pin',
      TM.BENCH,
      spec.benchD1.pct,
      spec.benchD1.sets,
      spec.benchD1.reps,
      'main',
      spec.benchD1Note
    ),
    tmNcSlot(
      `pn_dl_d1_w${w}`,
      spec.dlD1Exercise,
      TM.DEADLIFT,
      spec.dlD1.pct,
      spec.dlD1.sets,
      spec.dlD1.reps,
      'main',
      spec.dlD1Note
    )
  );

  const d2: SlotDef[] = [
    flatNcSlot(
      `pn_hyper_d2_w${w}`,
      'hyperextension',
      ACC.GENERAL,
      3,
      spec.hyperD2Reps,
      'accessory',
      spec.hyperD2Note
    ),
    freeNoteSlot(
      `pn_bench_tech_d2_w${w}`,
      'bench',
      TM.BENCH,
      1,
      1,
      `Panca: ramping tecnico ${spec.benchD2Tech} (RPE @8), luego volumen abajo.`
    ),
    tmNcSlot(
      `pn_bench_vol_d2_w${w}`,
      'bench',
      TM.BENCH,
      spec.benchD2Vol.pct,
      spec.benchD2Vol.sets,
      spec.benchD2Vol.reps,
      'main',
      `Panca volumen tras tecnico: ${(spec.benchD2Vol.pct * 100).toFixed(1)}% ${spec.benchD2Vol.reps}×${spec.benchD2Vol.sets}s. Fermo 2" en series de volumen salvo indicacion.`
    ),
    flatNcSlot(`pn_ohp_d2_w${w}`, 'ohp', ACC.INCLINE, 5, 8, 'accessory', spec.ohpD2Note),
    freeNoteSlot(`pn_row_d2_w${w}`, 'one_arm_row', ACC.ROW, 5, 5, spec.rowD2Note, 'accessory'),
    freeNoteSlot(
      `pn_pulley_d2_w${w}`,
      'pulley_band_seated',
      ACC.ROW,
      4,
      11,
      'Superset 4 giros: pulley 4×10/12 (usa panza para estabilizar) + stacco da rialzo abajo.',
      'accessory'
    ),
    tmNcSlot(
      `pn_dl_elev_d2_w${w}`,
      'deadlift_elevated',
      TM.DEADLIFT,
      spec.dlElevD2.pct,
      spec.dlElevD2.sets,
      spec.dlElevD2.reps,
      'main',
      spec.dlElevD2Note
    ),
    freeNoteSlot(
      `pn_bulg_d2_w${w}`,
      'bulgarian_split_squat',
      ACC.GENERAL,
      2,
      10,
      'Pressa 1 gamba o affondi bulgari 2×10/pierna sin descanso entre piernas. Peso en talon.',
      'accessory'
    ),
  ];

  const d3: SlotDef[] = [
    flatNcSlot(
      `pn_legcurl_d3_w${w}`,
      'leg_curl_prone',
      ACC.GENERAL,
      2,
      8,
      'accessory',
      'Leg curl: 2 series pesadas subida muy lenta + 2 series altas reps velocidad controlada.'
    ),
  ];
  if (spec.day3.kind === 'test') {
    d3.push(
      pnMaxTest(`pn_test_squat_w${w}`, 'squat', TM.SQUAT, 'SENTADILLA'),
      pnMaxTest(`pn_test_bench_w${w}`, 'bench', TM.BENCH, 'PRESS BANCA'),
      pnMaxTest(`pn_test_dl_w${w}`, 'deadlift', TM.DEADLIFT, 'PESO MUERTO')
    );
  } else {
    const t = spec.day3;
    d3.push(
      tmNcSlot(
        `pn_dl_d3_w${w}`,
        'deadlift',
        TM.DEADLIFT,
        t.dl.pct,
        t.dl.sets,
        t.dl.reps,
        'main',
        t.dlNote
      ),
      tmNcSlot(
        `pn_bench_d3_w${w}`,
        'bench',
        TM.BENCH,
        t.bench.pct,
        t.bench.sets,
        t.bench.reps,
        'main',
        t.benchNote
      ),
      tmNcSlot(
        `pn_box_d3_w${w}`,
        'box_squat',
        TM.SQUAT,
        t.box.pct,
        t.box.sets,
        t.box.reps,
        'main',
        t.boxNote
      )
    );
  }

  const d4: SlotDef[] = [
    bwSlot(
      `pn_abs_d4_w${w}`,
      'sit_up_decline',
      spec.absD4Sets,
      12,
      'Addome crunch + sbarra, 3–4 giros.'
    ),
    freeNoteSlot(
      `pn_db_bench_d4_w${w}`,
      'incline_db_press',
      ACC.INCLINE,
      spec.dbBenchD4.sets,
      spec.dbBenchD4.reps,
      spec.dbBenchD4.note,
      'accessory'
    ),
    flatNcSlot(
      `pn_rear_d4_w${w}`,
      'rear_delt_band',
      ACC.GENERAL,
      3,
      8,
      'accessory',
      'Superset: alzate a 90° (prono) 7–9 + laterali/frontali 6–8.'
    ),
    freeNoteSlot(
      `pn_curl_d4_w${w}`,
      'curl_bar',
      ACC.GENERAL,
      4,
      10,
      'Curl sagomato o manubri + rematore prono 30° peso a salire. Parcial en curl.',
      'accessory'
    ),
    freeNoteSlot(
      `pn_lat_d4_w${w}`,
      'seal_row',
      ACC.SEAL,
      3,
      8,
      'Trazioni lat machine 1 braccio 3×8 sin descanso entre brazos / seal row.',
      'accessory'
    ),
    flatNcSlot(
      `pn_calf_d4_w${w}`,
      'gemelo_sent',
      ACC.GENERAL,
      3,
      8,
      'accessory',
      'Superset: sitting calf 6–8 + pressa 10–12.'
    ),
    flatNcSlot(
      `pn_prensa_d4_w${w}`,
      'prensa',
      ACC.GENERAL,
      spec.prensaD4Sets,
      8,
      'accessory',
      spec.prensaD4Note
    ),
  ];

  return [
    { name: `PN Sem. ${w} — Dia 1 (Giorno Uno)`, slots: d1 },
    { name: `PN Sem. ${w} — Dia 2 (Giorno Due)`, slots: d2 },
    { name: `PN Sem. ${w} — Dia 3 (Giorno Tre)`, slots: d3 },
    { name: `PN Sem. ${w} — Dia 4 (Giorno Quattro)`, slots: d4 },
  ];
}

export function buildFasePN(): ProgramDay[] {
  return PN_WEEKS.flatMap(materializeWeek);
}
