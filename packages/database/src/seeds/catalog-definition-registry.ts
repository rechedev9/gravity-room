/**
 * Read-only registry of preset program definition payloads.
 *
 * This is the stable boundary for database seed and build-time catalog consumers.
 * Metadata remains canonical in @gzclp/domain/catalog; these payloads remain owned
 * by the database seed tooling.
 */
import { BBB_DEFINITION_JSONB } from './programs/bbb';
import {
  BRUNETTI365_DEFINITION_JSONB,
  BRUNETTI365_EXP_DEFINITION_JSONB,
} from './programs/brunetti-365';
import { FSL531_DEFINITION_JSONB } from './programs/fsl531';
import { GSLP_DEFINITION_JSONB } from './programs/greyskull';
import { GZCLP_DEFINITION_JSONB } from './programs/gzclp';
import { MUTENROSHI_DEFINITION_JSONB } from './programs/mutenroshi';
import { NIVEL7_DEFINITION_JSONB } from './programs/nivel7';
import { PHUL_DEFINITION_JSONB } from './programs/phul';
import { PPL_AB_DEFINITION_JSONB } from './programs/ppl-ab';
import { PPL531_DEFINITION_JSONB } from './programs/ppl531';
import { SALA_1_DEFINITION_JSONB } from './programs/sala-1';
import { SALA_2_DEFINITION_JSONB } from './programs/sala-2';
import { SALA_3_DEFINITION_JSONB } from './programs/sala-3';
import { SHEIKO_7_1_DEFINITION } from './programs/sheiko-7-1';
import { SHEIKO_7_2_DEFINITION } from './programs/sheiko-7-2';
import { SHEIKO_7_3_DEFINITION } from './programs/sheiko-7-3';
import { SHEIKO_7_4_DEFINITION } from './programs/sheiko-7-4';
import { SHEIKO_7_5_DEFINITION } from './programs/sheiko-7-5';
import { STRONGLIFTS_DEFINITION_JSONB } from './programs/stronglifts';

export const CATALOG_DEFINITION_JSONB_BY_ID: Readonly<Record<string, unknown>> = Object.freeze({
  gzclp: GZCLP_DEFINITION_JSONB,
  'hexan-ppl': PPL531_DEFINITION_JSONB,
  'stronglifts-5x5': STRONGLIFTS_DEFINITION_JSONB,
  'phraks-greyskull-lp': GSLP_DEFINITION_JSONB,
  '531-boring-but-big': BBB_DEFINITION_JSONB,
  '531-for-beginners': FSL531_DEFINITION_JSONB,
  phul: PHUL_DEFINITION_JSONB,
  'nivel-7': NIVEL7_DEFINITION_JSONB,
  'caparazon-de-tortuga': MUTENROSHI_DEFINITION_JSONB,
  '365-programmare-lipertrofia': BRUNETTI365_DEFINITION_JSONB,
  'la-sala-del-tiempo': BRUNETTI365_EXP_DEFINITION_JSONB,
  'tenkaichi-budokai-sentadilla': SHEIKO_7_1_DEFINITION,
  'tenkaichi-budokai-press-banca': SHEIKO_7_2_DEFINITION,
  'tenkaichi-budokai-peso-muerto': SHEIKO_7_3_DEFINITION,
  'tenkaichi-budokai-solo-banca': SHEIKO_7_4_DEFINITION,
  'tenkaichi-budokai-veterano': SHEIKO_7_5_DEFINITION,
  'sala-del-tiempo-1': SALA_1_DEFINITION_JSONB,
  'sala-del-tiempo-2': SALA_2_DEFINITION_JSONB,
  'sala-del-tiempo-3': SALA_3_DEFINITION_JSONB,
  'furia-oscura': PPL_AB_DEFINITION_JSONB,
});
