// brunetti-fase-is.ts — Brunetti 365 phase builder.
import type { ProgramDay, SlotDef } from './shared';
import { tmNcSlot } from './shared';
import { freeNoteSlot, ACC, TM } from './brunetti-slots';
import { BOOK_IS_SQUAT_D1, BOOK_IS_BENCH_D1 } from './brunetti-book-tables';

export function buildFaseIS(): ProgramDay[] {
  const days: ProgramDay[] = [];

  for (let week = 1; week <= 12; week++) {
    const sf = week <= 6 ? 1 : 2;
    const sfLabel = `S${sf}`;
    const cycle = ((week - 1) % 3) as 0 | 1 | 2; // 0 heavy, 1 volume, 2 light
    const bcNote =
      sf === 1
        ? "B.C. Sottofase 1: 2 ejercicios por grupo, 5–6 series totales, reps 6–12, recupero 1:30–2'. Sin forzar lattacido."
        : 'B.C. Sottofase 2: 1–2 ejercicios (preferible monoarticulares), 5–8 series, reps 12–30, recuperos cortos. Alto stress metabolico localizado.';

    // Squat D1 from Soluzione A
    const squatD1 = BOOK_IS_SQUAT_D1[cycle];
    const benchD1 = BOOK_IS_BENCH_D1[cycle];
    // After week 6 (buco), libro suggests slightly higher load / lower volume on squat D1
    const sqPctAdj = sf === 2 && squatD1.kind === 'heavy' ? -0.0 : 0;
    // D1 heavy stays 80% / 3x7s etc; buco mods for weeks 7+ use slightly lower volume variants in book p.184

    const d1: SlotDef[] = [
      tmNcSlot(
        `is_sq_d1_w${week}`,
        'squat',
        TM.SQUAT,
        squatD1.main.pct + sqPctAdj,
        squatD1.main.sets,
        squatD1.main.reps,
        'main',
        `IS ${sfLabel} Sett${week} (${squatD1.kind}). Squat Giorno Uno Soluzione A.`
      ),
    ];
    if ('back' in squatD1 && squatD1.back) {
      d1.push(
        tmNcSlot(
          `is_sq_d1_back_w${week}`,
          'squat',
          TM.SQUAT,
          squatD1.back.pct,
          squatD1.back.sets,
          squatD1.back.reps,
          'main',
          'Backoff del dia ligero: 75% 2×2.'
        )
      );
    }
    d1.push(
      tmNcSlot(
        `is_bp_d1_w${week}`,
        'bench',
        TM.BENCH,
        benchD1.pct,
        benchD1.sets,
        benchD1.reps,
        'main',
        `Panca Giorno Uno: ${(benchD1.pct * 100).toFixed(1)}% ${benchD1.reps}×${benchD1.sets}s.`
      ),
      freeNoteSlot(
        `is_chest_bc_d1_w${week}`,
        'apert',
        ACC.INCLINE,
        sf === 1 ? 3 : 4,
        sf === 1 ? 8 : 15,
        `PETTORALI e/o TRICIPITI B.C. ${bcNote} ~5–6 series petto + 3 triceps (S1) o lattacido alto (S2).`,
        'accessory'
      ),
      freeNoteSlot(
        `is_tri_bc_d1_w${week}`,
        'triceps_pushdown',
        ACC.GENERAL,
        sf === 1 ? 3 : 4,
        sf === 1 ? 8 : 15,
        `Triceps B.C. ${bcNote}`,
        'accessory'
      ),
      freeNoteSlot(
        `is_dl_ramp_d1_w${week}`,
        'deadlift',
        TM.DEADLIFT,
        3,
        3,
        'Stacco RAMPING + BACK-OFF (libro tabla IS). No escalera fija % — RPE.',
        'main'
      )
    );
    days.push({ name: `IS ${sfLabel} Sem. ${week} — Dia 1`, slots: d1 });

    // Giorno Due — panca −5%, dorsali B.C., gambe B.C.
    days.push({
      name: `IS ${sfLabel} Sem. ${week} — Dia 2`,
      slots: [
        tmNcSlot(
          `is_bp_d2_w${week}`,
          'bench',
          TM.BENCH,
          Math.max(0.7, benchD1.pct - 0.05),
          benchD1.sets,
          benchD1.reps,
          'main',
          'Panca Giorno Due = esquema G1 con −5% de carga (libro p.189).'
        ),
        freeNoteSlot(
          `is_back_bc_d2_w${week}`,
          'seal_row',
          ACC.SEAL,
          sf === 1 ? 3 : 4,
          sf === 1 ? 8 : 15,
          `DORSALI B.C. ${bcNote} Preferir Seal Row 2×/semana en IS.`,
          'accessory'
        ),
        freeNoteSlot(
          `is_legs_bc_d2_w${week}`,
          'leg_curl_prone',
          ACC.GENERAL,
          sf === 1 ? 3 : 4,
          sf === 1 ? 8 : 15,
          `GAMBE B.C. ${bcNote} 2 ejercicios / 6 series totales S1 (6–10 reps) o 6–8 series altas reps S2.`,
          'accessory'
        ),
        freeNoteSlot(
          `is_legs_bc2_d2_w${week}`,
          'ext_quad',
          ACC.GENERAL,
          sf === 1 ? 3 : 4,
          sf === 1 ? 8 : 15,
          `Segundo ejercicio piernas B.C. ${bcNote}`,
          'accessory'
        ),
        tmNcSlot(
          `is_dl_elev_d2_w${week}`,
          'deadlift_elevated',
          TM.DEADLIFT,
          0.65,
          4,
          3,
          'main',
          'Stacco da rialzo (tabla IS Giorno Due).'
        ),
      ],
    });

    // Giorno Tre — stacco main, panca tech, squat fermo
    const squatD3Notes =
      cycle === 0
        ? 'Squat fermo 2" abajo: ramping x2@8 poi −5% 2×3s (RPE abierto).'
        : cycle === 1
          ? 'Squat fermo 2": ramping x3@8 poi −5% 3×4s (RPE).'
          : 'Squat fermo 1" 4×3s @RPE6 salita normal.';

    days.push({
      name: `IS ${sfLabel} Sem. ${week} — Dia 3`,
      slots: [
        tmNcSlot(
          `is_dl_d3_w${week}`,
          'deadlift',
          TM.DEADLIFT,
          cycle === 0 ? 0.8 : cycle === 1 ? 0.75 : 0.7,
          cycle === 0 ? 3 : 4,
          cycle === 0 ? 3 : 4,
          'main',
          'Stacco Giorno Tre (frecuencia alta IS). Intensidad segun semana Pesante/Volume/Leggera.'
        ),
        freeNoteSlot(
          `is_bp_d3_w${week}`,
          'bench',
          TM.BENCH,
          4,
          2,
          'Panca Giorno Tre: fermo 3" ramping @8 + backoffs board (libro p.190). RPE abierto.'
        ),
        freeNoteSlot(`is_sq_d3_w${week}`, 'squat', TM.SQUAT, 3, 2, squatD3Notes),
        freeNoteSlot(
          `is_delt_bc_d3_w${week}`,
          'lateral_raise_seated',
          ACC.GENERAL,
          sf === 1 ? 3 : 4,
          sf === 1 ? 10 : 15,
          `DELTOIDI B.C. ${bcNote}`,
          'accessory'
        ),
      ],
    });

    // Giorno Quattro — variantes ligeras + brazos B.C.
    days.push({
      name: `IS ${sfLabel} Sem. ${week} — Dia 4`,
      slots: [
        freeNoteSlot(
          `is_bulg_d4_w${week}`,
          'bulgarian_split_squat',
          ACC.GENERAL,
          3,
          8,
          'Affondi bulgari o variante de squat ligera a inicio de sesion (libro: 4×4 ideal en variante).',
          'accessory'
        ),
        tmNcSlot(
          `is_front_or_box_d4_w${week}`,
          'front_squat',
          TM.SQUAT,
          0.5,
          4,
          4,
          'main',
          'Variante squat (front/pin/box) muy ligera 4×4 — drena fatiga del ciclo.'
        ),
        freeNoteSlot(
          `is_incline_d4_w${week}`,
          'incline_db_press',
          ACC.INCLINE,
          4,
          4,
          'Panca inclinada o Lento Avanti: 4×4@7 (pesante/volume) o 6×3@7 (ligera).',
          'accessory'
        ),
        freeNoteSlot(
          `is_seal_d4_w${week}`,
          'seal_row',
          ACC.SEAL,
          4,
          8,
          'Seal Row (segunda sesion dorsal de la semana).',
          'accessory'
        ),
        freeNoteSlot(
          `is_arms_bc_d4_w${week}`,
          'curl_bar',
          ACC.GENERAL,
          sf === 1 ? 3 : 4,
          sf === 1 ? 8 : 15,
          `BICIPITI e/o TRICIPITI B.C. ${bcNote}`,
          'accessory'
        ),
        freeNoteSlot(
          `is_tri_d4_w${week}`,
          'triceps_pushdown',
          ACC.GENERAL,
          sf === 1 ? 3 : 4,
          sf === 1 ? 8 : 15,
          `Triceps B.C. dia 4. ${bcNote}`,
          'accessory'
        ),
      ],
    });
  }

  return days;
}
