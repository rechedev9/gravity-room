// brunetti-fase-t1.ts — Brunetti 365 phase builder.
import type { ProgramDay } from './shared';
import { TEMPO_D5F2S5, REST_6MIN, tmNcSlot, flatNcSlot } from './shared';
import { bwSlot, freeNoteSlot, FZ_KEYS, ACC, TM } from './brunetti-slots';
import { BOOK_T1_BENCH_D1, BOOK_T1_DL_D1, BOOK_T1_BOX_SQUAT } from './brunetti-book-tables';

export function buildFaseT1(): ProgramDay[] {
  const days: ProgramDay[] = [];

  for (let week = 1; week <= 6; week++) {
    const w = week - 1;
    const benchD1 = BOOK_T1_BENCH_D1[w];
    const dlD1 = BOOK_T1_DL_D1[w];
    const box = BOOK_T1_BOX_SQUAT[w];

    // GIORNO UNO
    days.push({
      name: `T1 Sem. ${week} — Dia 1 (Giorno Uno)`,
      slots: [
        flatNcSlot(
          `t1_calf_d1_w${week}`,
          'gemelo_pie',
          ACC.GENERAL,
          3,
          8,
          'accessory',
          'Superset 3 giros: gemelos de pie, empuje de punto de contacto LENTO 7–10 reps.'
        ),
        flatNcSlot(
          `t1_prensa_toes_d1_w${week}`,
          'prensa',
          ACC.GENERAL,
          3,
          5,
          'accessory',
          'Superset con gemelos: prensa en puntas, talones altos, fermo 3s + subida 5s, 4–6 reps.'
        ),
        tmNcSlot(
          `t1_squat_d1_w${week}`,
          'squat',
          TM.SQUAT,
          0.5,
          10,
          4,
          'main',
          `${TEMPO_D5F2S5} Libro: 40–60% 4×10 serie (carga en rango; no hace falta progresion lineal). ${REST_6MIN}`
        ),
        tmNcSlot(
          `t1_bench_d1_w${week}`,
          'bench',
          TM.BENCH,
          benchD1.pct,
          benchD1.sets,
          benchD1.reps,
          'main',
          `Panca fermo 2" al pecho. Sett${week}: ${(benchD1.pct * 100).toFixed(0)}% ${benchD1.reps}×${benchD1.sets}s (notacion Brunetti).`
        ),
        tmNcSlot(
          `t1_dl_d1_w${week}`,
          'deadlift',
          TM.DEADLIFT,
          dlD1.pct,
          dlD1.sets,
          dlD1.reps,
          'main',
          `Stacco (estilo regular). ${(dlD1.pct * 100).toFixed(0)}% ${dlD1.reps}×${dlD1.sets}s. Recuperacion 1' entre series.`
        ),
      ],
    });

    // GIORNO DUE
    days.push({
      name: `T1 Sem. ${week} — Dia 2 (Giorno Due)`,
      slots: [
        bwSlot(
          `t1_abs_d2_w${week}`,
          'plank',
          4,
          15,
          'Addome postazione parallele, gambe piegate 4×15 (o equivalente de core).'
        ),
        tmNcSlot(
          `t1_bench_d2_w${week}`,
          week <= 3 ? 'bench_pin' : 'bench',
          TM.BENCH,
          0.55,
          6,
          4,
          'main',
          'Panca fermo 3" + salita 5s. 50–60% 4–5×6 serie, peso fijo en la sesion. OK pin a altura critica.'
        ),
        flatNcSlot(
          `t1_incline_d2_w${week}`,
          'incline_db_press',
          ACC.INCLINE,
          4,
          8,
          'accessory',
          'Spinte manubri panca 60–70°, presa martello 4×8. Subida controlada, empuja el techo.'
        ),
        freeNoteSlot(
          `t1_row_d2_w${week}`,
          'one_arm_row',
          ACC.ROW,
          5,
          5,
          'Rematore 1 braccio, salita in 5" 5×5 (serie×reps accesorios).',
          'accessory'
        ),
        freeNoteSlot(
          `t1_pulley_d2_w${week}`,
          'pulley_band_seated',
          ACC.ROW,
          4,
          11,
          'Pulley 4×10/12. Presion constante en la mano; no scatti; OK parar a media salita.',
          'accessory'
        ),
        tmNcSlot(
          `t1_dl_elev_d2_w${week}`,
          'deadlift_elevated',
          TM.DEADLIFT,
          0.68,
          5,
          3,
          'main',
          'Stacco da piccolo rialzo (5–7cm) 65–72.5% 3–4×5 serie. Tras el trabajo de dorsales.'
        ),
      ],
    });

    // GIORNO TRE
    const rampNote =
      week <= 3
        ? 'Panca: RAMPING a quintupla dura con fermo 3", luego reinicia desde ~40kg a doppia/tripla; backoff 50% 8×2 serie. (RPE abierto — libro p.44)'
        : 'Panca: RAMPING a tripla dura con fermo 3", luego reinicia a doppia; backoff 65% 7×2 serie. (RPE abierto — libro p.44)';

    days.push({
      name: `T1 Sem. ${week} — Dia 3 (Giorno Tre)`,
      slots: [
        flatNcSlot(
          `t1_hyper_d3_w${week}`,
          'hyperextension',
          ACC.GENERAL,
          3,
          12,
          'accessory',
          'Superset 3 giros: hyperextension ~10kg detras de la cabeza ×12.'
        ),
        flatNcSlot(
          `t1_legcurl_d3_w${week}`,
          'leg_curl_prone',
          ACC.GENERAL,
          3,
          5,
          'accessory',
          'Superset: leg curl salita muy lenta 4–5 reps. Pantorrilla empuja el cojin.'
        ),
        freeNoteSlot(
          `t1_dl_ramp_d3_w${week}`,
          'deadlift',
          TM.DEADLIFT,
          4,
          2,
          'Stacco salita 5": RAMPING hasta doppia/tripla dura, luego −10% 4×4 siempre salita 5". (RPE abierto — libro p.44)'
        ),
        freeNoteSlot(
          `t1_bench_ramp_d3_w${week}`,
          'bench',
          TM.BENCH,
          3,
          5,
          `Calentamiento fermo 1" 20×3 serie. ${rampNote}`
        ),
        tmNcSlot(
          `t1_box_squat_d3_w${week}`,
          'box_squat',
          TM.SQUAT,
          box.pct,
          box.sets,
          box.reps,
          'main',
          `Box Squat fermo 2". Sett${week}: ${(box.pct * 100).toFixed(0)}% ${box.reps}×${box.sets}s.`
        ),
      ],
    });

    // GIORNO QUATTRO
    days.push({
      name: `T1 Sem. ${week} — Dia 4 (Giorno Quattro)`,
      slots: [
        bwSlot(
          `t1_abs_d4_w${week}`,
          'sit_up_decline',
          4,
          12,
          'Addome crunch + barra 4 giros (sustituible).'
        ),
        freeNoteSlot(
          `t1_decl_db_d4_w${week}`,
          'apert',
          ACC.INCLINE,
          4,
          5,
          'Panca declinata manubri, discesa a meta + fermo 2" 5×4 serie. Presa neutra.',
          'accessory'
        ),
        flatNcSlot(
          `t1_lat_raise_d4_w${week}`,
          'lateral_raise_seated',
          ACC.GENERAL,
          4,
          8,
          'accessory',
          'Superset 4 giros: alzate laterali salita 5" ×8 + alzate a 90° ×10. No scatti.'
        ),
        flatNcSlot(
          `t1_rear_90_d4_w${week}`,
          'rear_delt_band',
          ACC.GENERAL,
          4,
          10,
          'accessory',
          'Alzate a 90° (parte del superset de hombros).'
        ),
        freeNoteSlot(
          `t1_curl_d4_w${week}`,
          'curl_bar',
          ACC.GENERAL,
          4,
          5,
          'Superset 4 giros: curl barra dritta salita 5" 5–6 reps + lat machine supina 10–12.',
          'accessory'
        ),
        freeNoteSlot(
          `t1_bulg_d4_w${week}`,
          'bulgarian_split_squat',
          FZ_KEYS.SQUAT,
          3,
          8,
          'Pressa 1 gamba o affondi bulgari 3×8/pierna sin descanso entre piernas. Peso en talon.',
          'accessory'
        ),
      ],
    });
  }
  return days;
}
