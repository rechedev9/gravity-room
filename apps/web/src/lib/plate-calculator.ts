export const BAR_KG = 20;
export const AVAILABLE_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

type PlateKg = (typeof AVAILABLE_PLATES)[number];

export interface PlateCount {
  readonly kg: PlateKg;
  readonly count: number;
}

export type PlateResult =
  | { readonly ok: true; readonly plates: readonly PlateCount[] }
  | { readonly ok: false };

const FLOAT_TOLERANCE = 0.001;

export function calculatePlates(targetKg: number, barKg: number = BAR_KG): PlateResult {
  if (targetKg <= barKg) {
    return { ok: false };
  }

  let perSide = Math.round((targetKg - barKg) * 1000) / 1000 / 2;
  const plates: PlateCount[] = [];

  for (const plate of AVAILABLE_PLATES) {
    if (perSide < plate - FLOAT_TOLERANCE) continue;
    const count = Math.floor(Math.round((perSide / plate) * 1000) / 1000);
    if (count > 0) {
      plates.push({ kg: plate, count });
      perSide = Math.round((perSide - plate * count) * 1000) / 1000;
    }
  }

  if (perSide > FLOAT_TOLERANCE) {
    return { ok: false };
  }

  return { ok: true, plates };
}
