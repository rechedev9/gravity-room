import { useTranslation } from 'react-i18next';
import type { GenericWorkoutRow } from '@gzclp/shared/types';

interface PreviewTableProps {
  readonly rows: readonly GenericWorkoutRow[];
}

export function PreviewTable({ rows }: PreviewTableProps): React.ReactNode {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return (
      <p className="text-xs text-zinc-500 text-center py-4">
        {t('programs.wizard.preview.no_data')}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto border border-zinc-700 rounded-lg">
      <table className="w-full text-xs" aria-label={t('programs.wizard.preview.table_aria')}>
        <thead>
          <tr className="bg-zinc-800/80 text-zinc-400 text-left">
            <th className="px-3 py-2 font-bold whitespace-nowrap">
              {t('programs.wizard.preview.columns.workout')}
            </th>
            <th className="px-3 py-2 font-bold whitespace-nowrap">
              {t('programs.wizard.preview.columns.exercise')}
            </th>
            <th className="px-3 py-2 font-bold text-center whitespace-nowrap">
              {t('programs.wizard.preview.columns.sets')}
            </th>
            <th className="px-3 py-2 font-bold text-center whitespace-nowrap">
              {t('programs.wizard.preview.columns.reps')}
            </th>
            <th className="px-3 py-2 font-bold text-center whitespace-nowrap">
              {t('programs.wizard.preview.columns.weight')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) =>
            row.slots.map((slot, slotIdx) => (
              <tr
                key={`${row.index}-${slot.slotId}`}
                className="border-t border-zinc-800 hover:bg-zinc-800/30"
              >
                {slotIdx === 0 && (
                  <td
                    className="px-3 py-1.5 text-zinc-300 font-medium whitespace-nowrap"
                    rowSpan={row.slots.length}
                  >
                    {row.dayName}
                  </td>
                )}
                <td className="px-3 py-1.5 text-zinc-200 whitespace-nowrap">{slot.exerciseName}</td>
                <td className="px-3 py-1.5 text-center text-zinc-300">{slot.sets}</td>
                <td className="px-3 py-1.5 text-center text-zinc-300">
                  {slot.isAmrap ? `${slot.reps}+` : slot.reps}
                </td>
                <td className="px-3 py-1.5 text-center text-zinc-300">{slot.weight}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
