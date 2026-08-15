import type { ProgramDefinition } from '@gzclp/domain/types/program';

export interface WeightsSummary {
  /** Compact, abbreviated summary meant for the chrome band: "SEN 115 · PB 102.5". */
  readonly summary: string;
  /**
   * Full, unabbreviated, untruncated summary for accessibility/hover (e.g. a
   * `title` attribute). Always lists every weight field, ignoring `limit`.
   */
  readonly full: string;
}

const PARENTHETICAL = /\s*\([^)]*\)/g;

/** Drop parenthetical qualifiers, e.g. "Sentadilla (peso inicial semana 5)" -> "Sentadilla". */
function stripQualifier(label: string): string {
  return label.replace(PARENTHETICAL, '').replace(/\s+/g, ' ').trim();
}

/**
 * Ordered, increasingly specific candidate codes derived from an already-stripped
 * label. The first candidate is the preferred abbreviation; later candidates are
 * used only to resolve a collision with another field's code, deterministically.
 */
function codeCandidates(label: string): string[] {
  const words = label.split(' ').filter(Boolean);
  if (words.length === 0) return ['?'];

  if (words.length === 1) {
    const word = words[0].toUpperCase();
    const candidates: string[] = [];
    for (let len = Math.min(3, word.length); len <= word.length; len++) {
      candidates.push(word.slice(0, len));
    }
    return candidates;
  }

  const initials = words.map((w) => w[0]?.toUpperCase() ?? '');
  const candidates: string[] = [initials.join('')];

  // Extend the last word's contribution letter by letter before falling back to
  // the fully concatenated label — deterministic and independent of field order.
  const lastWord = words[words.length - 1].toUpperCase();
  for (let len = 2; len <= lastWord.length; len++) {
    candidates.push(initials.slice(0, -1).join('') + lastWord.slice(0, len));
  }

  const compact = words.join('').toUpperCase();
  const longest = candidates[candidates.length - 1];
  for (let len = longest.length + 1; len <= compact.length; len++) {
    candidates.push(compact.slice(0, len));
  }

  return candidates;
}

/** Pick the first candidate code not already taken; fall back to a numeric suffix. */
function assignCode(label: string, used: Set<string>): string {
  const stripped = stripQualifier(label);
  const candidates = codeCandidates(stripped);
  for (const candidate of candidates) {
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  const base = candidates[candidates.length - 1] ?? stripped.toUpperCase();
  let suffix = 2;
  let fallback = `${base}${suffix}`;
  while (used.has(fallback)) {
    suffix += 1;
    fallback = `${base}${suffix}`;
  }
  used.add(fallback);
  return fallback;
}

/**
 * Build a compact, abbreviated summary for the chrome band ("SEN 115 · PB 102.5"),
 * plus a full, unabbreviated companion string for accessibility/hover ("Sentadilla
 * 115 · Press Banca 102.5"). Codes are derived purely from the (already localized)
 * labels handed in — never from a hardcoded word list — and are unique across all
 * weight fields of the program, independent of `limit`, so a field's code stays
 * stable whether it renders in the desktop or the mobile (limit = 1) summary.
 */
export function buildWeightsSummary(
  config: Record<string, number | string>,
  fields: ProgramDefinition['configFields'],
  overflowLabel: (n: number) => string,
  localizeLabel: (key: string, fallback: string) => string = (_k, f) => f,
  limit = 4
): WeightsSummary {
  const weightFields = fields.filter((f) => f.type === 'weight');

  const used = new Set<string>();
  const codeByKey = new Map<string, string>();
  for (const field of weightFields) {
    const label = localizeLabel(field.key, field.label);
    codeByKey.set(field.key, assignCode(label, used));
  }

  const shown = weightFields.slice(0, limit);
  const overflow = weightFields.length - limit;

  const summaryParts = shown.map((f) => {
    const code = codeByKey.get(f.key) ?? f.key;
    const val = config[f.key];
    return val !== undefined ? `${code} ${val}` : code;
  });

  // Unlike `summary`, `full` is never truncated: it lists every weight field
  // regardless of `limit`, so the untruncated, unabbreviated data stays fully
  // reachable via the `title` attribute even on the 1-field mobile summary.
  const fullParts = weightFields.map((f) => {
    const label = localizeLabel(f.key, f.label);
    const val = config[f.key];
    return val !== undefined ? `${label} ${val}` : label;
  });

  if (overflow > 0) {
    summaryParts.push(overflowLabel(overflow));
  }

  return { summary: summaryParts.join(' · '), full: fullParts.join(' · ') };
}
