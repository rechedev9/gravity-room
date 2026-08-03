// brunetti-fase-zero.ts — Brunetti 365 phase builder.
import type { ProgramDay } from './shared';
import { TEMPO_D5F2S5, flatNcSlot } from './shared';
import { bwSlot, freeNoteSlot, FZ_KEYS, ACC } from './brunetti-slots';
import { FZ_EXIT_NOTES } from './brunetti-book-tables';

export function buildFaseZero(): ProgramDay[] {
  const days: ProgramDay[] = [];
  // First 4 weeks: bodyweight/empty-bar fundamentals; weeks 5–8: light free load allowed.
  for (let week = 1; week <= 8; week++) {
    const loaded = week >= 5;
    const exit = week === 8 ? ` ${FZ_EXIT_NOTES}` : '';

    // GIORNO 1 — SQUAT
    days.push({
      name: `FZ Sem. ${week} — Dia 1 (Squat)`,
      slots: [
        bwSlot(
          `fz_plank_d1_w${week}`,
          'plank',
          3,
          1,
          "Core 10': plancha 30–60s isometria. Alinea pelvis-tronco."
        ),
        bwSlot(
          `fz_reverse_plank_d1_w${week}`,
          'reverse_plank',
          2,
          1,
          'Core: plancha inversa. Espalda apoyada, estabilidad.'
        ),
        flatNcSlot(
          `fz_leg_curl_d1_w${week}`,
          'leg_curl_prone',
          ACC.GENERAL,
          3,
          10,
          'accessory',
          "Activacion 10': leg curl 3–4×8–15. Presion de tobillo/pantorrilla; no forzar acortamiento de femorales."
        ),
        flatNcSlot(
          `fz_hyper_d1_w${week}`,
          'hyperextension',
          ACC.GENERAL,
          3,
          10,
          'accessory',
          'Activacion: hiperextension 3–4×8–15. Rodillas ligeramente flexionadas.'
        ),
        flatNcSlot(
          `fz_bulg_d1_w${week}`,
          'bulgarian_split_squat_slow',
          FZ_KEYS.SQUAT,
          3,
          12,
          'accessory',
          "Proprioception 20': zancada bulgara 3×10–15/pierna. Peso en talon/pie entero; lento + isometria abajo."
        ),
        flatNcSlot(
          `fz_calf_d1_w${week}`,
          'calf_raise_proprioceptive',
          FZ_KEYS.SQUAT,
          3,
          12,
          'accessory',
          'Gemelos en elevacion: empuje de antepie 3×10–15/pierna sin descanso entre piernas.'
        ),
        loaded
          ? freeNoteSlot(
              `fz_squat_w${week}`,
              'squat',
              FZ_KEYS.SQUAT,
              5,
              6,
              `${TEMPO_D5F2S5} Fundamental 20\': carga libre ligera (barra o poco peso). 5–10 reps × 4–6 series. Sentir TODO el pie. Semana ${week}/8.`
            )
          : bwSlot(
              `fz_squat_bw_w${week}`,
              'squat_bodyweight',
              5,
              8,
              `${TEMPO_D5F2S5} Fundamental 20\': sentadilla a corpo libero / barra vacia. 5–10 reps × 4–6 series. Pausa abajo en punto critico.`
            ),
      ],
    });

    // GIORNO 2 — PANCA
    days.push({
      name: `FZ Sem. ${week} — Dia 2 (Panca)`,
      slots: [
        bwSlot(`fz_plank_d2_w${week}`, 'plank', 3, 1, "Core 10': plancha 30–60s."),
        bwSlot(
          `fz_situp_d2_w${week}`,
          'sit_up_decline',
          3,
          10,
          'Core: sit-up declinado parcial, abdomen compacto.'
        ),
        flatNcSlot(
          `fz_lat_raise_d2_w${week}`,
          'lateral_raise_band',
          ACC.GENERAL,
          4,
          12,
          'accessory',
          'Activacion panca: elevaciones laterales con banda 4×10–15.'
        ),
        flatNcSlot(
          `fz_french_d2_w${week}`,
          'french_press_bench',
          ACC.GENERAL,
          4,
          12,
          'accessory',
          'French press triceps 4×10–15. Manos en linea con la frente.'
        ),
        flatNcSlot(
          `fz_rear_d2_w${week}`,
          'rear_delt_band',
          ACC.GENERAL,
          4,
          6,
          'accessory',
          'Aperturas posteriores con banda 4×5–8. Codos fijos; tracciona hacia fuera.'
        ),
        flatNcSlot(
          `fz_pulley_d2_w${week}`,
          'pulley_band_seated',
          ACC.ROW,
          4,
          10,
          'accessory',
          'Proprioception: pulley con banda 8–12 reps (traccion parcial, scapole neutre).'
        ),
        bwSlot(
          `fz_pushup_iso_d2_w${week}`,
          'pushup_isometric',
          4,
          1,
          'Piegamenti in stasi 20–30s, codo ligeramente flexionado. Alternar con traccion (4–5 giros).'
        ),
        loaded
          ? freeNoteSlot(
              `fz_bench_w${week}`,
              'bench',
              FZ_KEYS.BENCH,
              4,
              6,
              'Fundamental: panca solo si la tecnica de flexiones es solida. Carga libre muy ligera. Si no, continua con flexiones de rodillas + isometria a media ROM.'
            )
          : bwSlot(
              `fz_pushup_w${week}`,
              'bench_pushups',
              4,
              8,
              'Fundamental panca via flexiones (de rodillas si hace falta): movimiento parcial + fermo prolungato a media ROM. No prisa por coger la barra.'
            ),
      ],
    });

    // GIORNO 3 — STACCO
    days.push({
      name: `FZ Sem. ${week} — Dia 3 (Stacco)`,
      slots: [
        bwSlot(`fz_plank_d3_w${week}`, 'plank', 3, 1, "Core 10': plancha."),
        flatNcSlot(
          `fz_leg_curl_d3_w${week}`,
          'leg_curl_prone',
          ACC.GENERAL,
          3,
          10,
          'accessory',
          'Activacion: leg curl + hiperextension para stacco (mismas pautas que dia Squat).'
        ),
        flatNcSlot(
          `fz_hyper_d3_w${week}`,
          'hyperextension',
          ACC.GENERAL,
          3,
          10,
          'accessory',
          'Activacion stacco: hiperextension 3–4×8–15.'
        ),
        freeNoteSlot(
          `fz_dl_blocks_d3_w${week}`,
          'deadlift_partial_blocks',
          FZ_KEYS.DEADLIFT,
          4,
          10,
          'Proprioception: stacco a gambe semitese da blocchi, ROM parcial hasta rodilla, 4×10–12. Preferible con banda.',
          'accessory'
        ),
        freeNoteSlot(
          `fz_leg_press_iso_d3_w${week}`,
          'leg_press_isometric',
          ACC.GENERAL,
          3,
          1,
          "Prensa isometrica ~1' con rodillas ligeramente flexionadas. Pie entero, sin torsiones.",
          'accessory'
        ),
        loaded
          ? freeNoteSlot(
              `fz_dl_w${week}`,
              'deadlift',
              FZ_KEYS.DEADLIFT,
              4,
              5,
              `Fundamental: stacco regular (no sumo en FZ). Subida controlada ~5s. Carga ligera/barra. Semana ${week}/8.${exit}`
            )
          : bwSlot(
              `fz_dl_iso_w${week}`,
              'deadlift_isometric',
              4,
              1,
              `Fundamental: setup isometria 30–60s sin barra (3–4 isometrie), luego barra vacia o banda. Enfocarse en EMPUJAR el suelo, no en "tirar".${exit}`
            ),
      ],
    });
  }
  return days;
}
