import type { GenericWorkoutRow } from '@gzclp/shared/types';

interface PreviewTableProps {
  readonly rows: readonly GenericWorkoutRow[];
}

export function PreviewTable({ rows }: PreviewTableProps): React.ReactNode {
  if (rows.length === 0) {
    return <p className="text-xs text-zinc-500 text-center py-4">Sin datos de vista previa.</p>;
  }

  return (
    <div className="overflow-x-auto border border-zinc-700 rounded-lg">
      <table className="w-full text-xs" aria-label="Vista previa del programa">
        <thead>
          <tr className="bg-zinc-800/80 text-zinc-400 text-left">
            <th className="px-3 py-2 font-bold whitespace-nowrap">Entrenamiento</th>
            <th className="px-3 py-2 font-bold whitespace-nowrap">Ejercicio</th>
            <th className="px-3 py-2 font-bold text-center whitespace-nowrap">Series</th>
            <th className="px-3 py-2 font-bold text-center whitespace-nowrap">Reps</th>
            <th className="px-3 py-2 font-bold text-center whitespace-nowrap">Peso</th>
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
