export interface JawContext {
  readonly block: 1 | 2 | 3;
  readonly week: number | null;
  readonly isTestWeek: boolean;
  readonly group: string;
}

export function deriveJawContext(dayName: string): JawContext | null {
  const blockMatch = dayName.match(/JAW (?:B|Bloque )(\d)/);
  if (!blockMatch) return null;
  const blockStr = blockMatch[1];
  if (blockStr !== '1' && blockStr !== '2' && blockStr !== '3') return null;
  const block: 1 | 2 | 3 = blockStr === '1' ? 1 : blockStr === '2' ? 2 : 3;
  const semMatch = dayName.match(/Sem\.\s*(\d+)/);
  const isTestWeek = dayName.includes('Test Maximo') || dayName.includes('Recuperacion');
  const week = semMatch ? Number(semMatch[1]) : isTestWeek ? block * 6 : null;
  return { block, week, isTestWeek, group: `JAW Bloque ${block} — TM` };
}
