import type { ProgramDefinition } from '../types/program';
import { GZCLP_DEFINITION } from './gzclp';
import { NIVEL7_DEFINITION } from './nivel7';
import { PPL531_DEFINITION } from './ppl531';

const PRESET_PROGRAMS: readonly ProgramDefinition[] = [
  GZCLP_DEFINITION,
  NIVEL7_DEFINITION,
  PPL531_DEFINITION,
];

const PROGRAM_MAP = new Map<string, ProgramDefinition>(PRESET_PROGRAMS.map((p) => [p.id, p]));

export function getProgramDefinition(id: string): ProgramDefinition | undefined {
  return PROGRAM_MAP.get(id);
}

export function getAllPresetPrograms(): readonly ProgramDefinition[] {
  return PRESET_PROGRAMS;
}
