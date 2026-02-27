import { useState } from 'react';
import { getNote, setNote } from '@/lib/notes-storage';

interface WorkoutNotesProps {
  readonly instanceId: string;
  readonly workoutIndex: number;
  readonly slotKey: string;
}

export function WorkoutNotes({
  instanceId,
  workoutIndex,
  slotKey,
}: WorkoutNotesProps): React.ReactNode {
  const [text, setText] = useState<string>(() => getNote(instanceId, workoutIndex, slotKey) ?? '');

  const handleBlur = (): void => {
    setNote(instanceId, workoutIndex, slotKey, text);
  };

  return (
    <div data-testid="workout-notes" className="mt-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        placeholder="Notas del ejercicio..."
        aria-label="Notas"
        rows={2}
        maxLength={500}
        className="w-full text-xs bg-[var(--bg-body)] border border-[var(--border-color)] px-3 py-2 text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus-visible:ring-2 focus-visible:ring-[var(--fill-progress)] focus-visible:outline-none resize-none"
      />
      <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] mt-1">
        {'\ud83d\udd12'} Solo en este dispositivo
      </span>
    </div>
  );
}
