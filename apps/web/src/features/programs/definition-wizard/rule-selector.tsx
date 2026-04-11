import { useTranslation } from 'react-i18next';
import type { z } from 'zod/v4';
import type { ProgressionRuleSchema } from '@gzclp/shared/schemas/program-definition';

type ProgressionRule = z.infer<typeof ProgressionRuleSchema>;
type RuleType = ProgressionRule['type'];

function useRuleOptions() {
  const { t } = useTranslation();

  const standardOptions: readonly { readonly value: RuleType; readonly label: string }[] = [
    { value: 'add_weight', label: t('programs.wizard.rule_add_weight') },
    { value: 'advance_stage', label: t('programs.wizard.rule_advance_stage') },
    { value: 'add_weight_reset_stage', label: t('programs.wizard.rule_add_weight_reset_stage') },
    { value: 'deload_percent', label: t('programs.wizard.rule_deload_percent') },
    { value: 'no_change', label: t('programs.wizard.rule_no_change') },
    { value: 'double_progression', label: t('programs.wizard.rule_double_progression') },
  ];

  const advancedOptions: readonly { readonly value: RuleType; readonly label: string }[] = [
    { value: 'update_tm', label: t('programs.wizard.rule_update_tm') },
    {
      value: 'advance_stage_add_weight',
      label: t('programs.wizard.rule_advance_stage_add_weight'),
    },
  ];

  return { standardOptions, advancedOptions };
}

const ALL_RULE_TYPES: ReadonlySet<string> = new Set<string>([
  'add_weight',
  'advance_stage',
  'add_weight_reset_stage',
  'deload_percent',
  'no_change',
  'advance_stage_add_weight',
  'update_tm',
  'double_progression',
]);

function isRuleType(value: string): value is RuleType {
  return ALL_RULE_TYPES.has(value);
}

const DEFAULT_DELOAD_PERCENT = 10;
const DEFAULT_DOUBLE_PROG_BOTTOM = 8;
const DEFAULT_DOUBLE_PROG_TOP = 12;

function buildDefaultRule(type: RuleType): ProgressionRule {
  switch (type) {
    case 'add_weight':
      return { type: 'add_weight' };
    case 'advance_stage':
      return { type: 'advance_stage' };
    case 'add_weight_reset_stage':
      return { type: 'add_weight_reset_stage', amount: 2.5 };
    case 'deload_percent':
      return { type: 'deload_percent', percent: DEFAULT_DELOAD_PERCENT };
    case 'no_change':
      return { type: 'no_change' };
    case 'advance_stage_add_weight':
      return { type: 'advance_stage_add_weight' };
    case 'update_tm':
      return { type: 'update_tm', amount: 2.5, minAmrapReps: 1 };
    case 'double_progression':
      return {
        type: 'double_progression',
        repRangeBottom: DEFAULT_DOUBLE_PROG_BOTTOM,
        repRangeTop: DEFAULT_DOUBLE_PROG_TOP,
      };
  }
}

interface RuleSelectorProps {
  readonly label: string;
  readonly rule: ProgressionRule;
  readonly onChange: (rule: ProgressionRule | undefined) => void;
  /** If true, include "Ninguna" option that maps to undefined. */
  readonly optional?: boolean;
  /** If true, include advanced rule types in the dropdown. */
  readonly advanced?: boolean;
}

export function RuleSelector({
  label,
  rule,
  onChange,
  optional,
  advanced,
}: RuleSelectorProps): React.ReactNode {
  const { t } = useTranslation();
  const { standardOptions, advancedOptions } = useRuleOptions();
  const options = advanced ? [...standardOptions, ...advancedOptions] : standardOptions;

  const handleTypeChange = (newType: string): void => {
    if (newType === '__none__') {
      onChange(undefined);
      return;
    }
    if (!isRuleType(newType)) return;
    onChange(buildDefaultRule(newType));
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-2xs font-bold text-zinc-400 uppercase tracking-wide">
        {label}
      </label>
      <select
        value={rule.type}
        onChange={(e) => handleTypeChange(e.target.value)}
        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
        aria-label={label}
      >
        {optional && <option value="__none__">{t('programs.wizard.rule_none')}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Param fields per rule type */}
      {rule.type === 'deload_percent' && (
        <div>
          <label className="block text-2xs text-zinc-500 mb-0.5">
            {t('programs.wizard.deload_percent_label')}
          </label>
          <input
            type="number"
            min={1}
            max={99}
            value={rule.percent}
            onChange={(e) => onChange({ ...rule, percent: Number(e.target.value) })}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none text-center"
            aria-label={t('programs.wizard.deload_percent_label')}
          />
        </div>
      )}

      {rule.type === 'add_weight_reset_stage' && (
        <div>
          <label className="block text-2xs text-zinc-500 mb-0.5">
            {t('programs.wizard.add_weight_amount_label')}
          </label>
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={rule.amount}
            onChange={(e) => onChange({ ...rule, amount: Number(e.target.value) })}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none text-center"
            aria-label={t('programs.wizard.add_weight_amount_label')}
          />
        </div>
      )}

      {rule.type === 'double_progression' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-2xs text-zinc-500 mb-0.5">
              {t('programs.wizard.min_reps_label')}
            </label>
            <input
              type="number"
              min={1}
              value={rule.repRangeBottom}
              onChange={(e) => onChange({ ...rule, repRangeBottom: Number(e.target.value) })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none text-center"
              aria-label={t('programs.wizard.min_reps_label')}
            />
          </div>
          <div>
            <label className="block text-2xs text-zinc-500 mb-0.5">
              {t('programs.wizard.max_reps_label')}
            </label>
            <input
              type="number"
              min={1}
              value={rule.repRangeTop}
              onChange={(e) => onChange({ ...rule, repRangeTop: Number(e.target.value) })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none text-center"
              aria-label={t('programs.wizard.max_reps_label')}
            />
          </div>
          {rule.repRangeBottom > rule.repRangeTop && (
            <p className="col-span-2 text-2xs text-red-400">
              {t('programs.wizard.reps_validation_error')}
            </p>
          )}
        </div>
      )}

      {rule.type === 'update_tm' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-2xs text-zinc-500 mb-0.5">
              {t('programs.wizard.amount_label')}
            </label>
            <input
              type="number"
              step={0.5}
              value={rule.amount}
              onChange={(e) => onChange({ ...rule, amount: Number(e.target.value) })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none text-center"
              aria-label={t('programs.wizard.amount_label')}
            />
          </div>
          <div>
            <label className="block text-2xs text-zinc-500 mb-0.5">
              {t('programs.wizard.min_amrap_reps_label')}
            </label>
            <input
              type="number"
              min={0}
              value={rule.minAmrapReps}
              onChange={(e) => onChange({ ...rule, minAmrapReps: Number(e.target.value) })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none text-center"
              aria-label={t('programs.wizard.min_amrap_reps_label')}
            />
          </div>
        </div>
      )}
    </div>
  );
}
