-- Rename program IDs to match their display names as URL-friendly slugs.
-- Updates both program_templates (source of truth) and program_instances (user data).

BEGIN;

-- 1. Update program_instances first (no FK constraint, but logically cleaner)
UPDATE program_instances SET program_id = 'furia-oscura' WHERE program_id = 'ppl-ab';
UPDATE program_instances SET program_id = 'hexan-ppl' WHERE program_id = 'ppl531';
UPDATE program_instances SET program_id = 'caparazon-de-tortuga' WHERE program_id = 'mutenroshi';
UPDATE program_instances SET program_id = 'stronglifts-5x5' WHERE program_id = 'stronglifts5x5';
UPDATE program_instances SET program_id = 'phraks-greyskull-lp' WHERE program_id = 'phraks-gslp';
UPDATE program_instances SET program_id = '531-boring-but-big' WHERE program_id = 'wendler531bbb';
UPDATE program_instances SET program_id = '531-for-beginners' WHERE program_id = 'wendler531beginners';
UPDATE program_instances SET program_id = 'nivel-7' WHERE program_id = 'nivel7';
UPDATE program_instances SET program_id = 'tenkaichi-budokai-sentadilla' WHERE program_id = 'sheiko-7-1';
UPDATE program_instances SET program_id = 'tenkaichi-budokai-press-banca' WHERE program_id = 'sheiko-7-2';
UPDATE program_instances SET program_id = 'tenkaichi-budokai-peso-muerto' WHERE program_id = 'sheiko-7-3';
UPDATE program_instances SET program_id = 'tenkaichi-budokai-solo-banca' WHERE program_id = 'sheiko-7-4';
UPDATE program_instances SET program_id = 'tenkaichi-budokai-veterano' WHERE program_id = 'sheiko-7-5';
UPDATE program_instances SET program_id = '365-programmare-lipertrofia' WHERE program_id = 'brunetti-365';
UPDATE program_instances SET program_id = 'la-sala-del-tiempo' WHERE program_id = 'brunetti-365-exp';

-- 2. Update program_templates (catalog)
UPDATE program_templates SET id = 'furia-oscura' WHERE id = 'ppl-ab';
UPDATE program_templates SET id = 'hexan-ppl' WHERE id = 'ppl531';
UPDATE program_templates SET id = 'caparazon-de-tortuga' WHERE id = 'mutenroshi';
UPDATE program_templates SET id = 'stronglifts-5x5' WHERE id = 'stronglifts5x5';
UPDATE program_templates SET id = 'phraks-greyskull-lp' WHERE id = 'phraks-gslp';
UPDATE program_templates SET id = '531-boring-but-big' WHERE id = 'wendler531bbb';
UPDATE program_templates SET id = '531-for-beginners' WHERE id = 'wendler531beginners';
UPDATE program_templates SET id = 'nivel-7' WHERE id = 'nivel7';
UPDATE program_templates SET id = 'tenkaichi-budokai-sentadilla' WHERE id = 'sheiko-7-1';
UPDATE program_templates SET id = 'tenkaichi-budokai-press-banca' WHERE id = 'sheiko-7-2';
UPDATE program_templates SET id = 'tenkaichi-budokai-peso-muerto' WHERE id = 'sheiko-7-3';
UPDATE program_templates SET id = 'tenkaichi-budokai-solo-banca' WHERE id = 'sheiko-7-4';
UPDATE program_templates SET id = 'tenkaichi-budokai-veterano' WHERE id = 'sheiko-7-5';
UPDATE program_templates SET id = '365-programmare-lipertrofia' WHERE id = 'brunetti-365';
UPDATE program_templates SET id = 'la-sala-del-tiempo' WHERE id = 'brunetti-365-exp';

COMMIT;
