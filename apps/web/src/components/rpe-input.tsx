const RPE_VALUES = [5, 6, 7, 8, 9, 10] as const;

const RPE_DESCRIPTIONS: Readonly<Record<number, string>> = {
  5: 'Muy fácil — 5+ reps en reserva',
  6: 'Muy fácil — 4+ reps en reserva',
  7: 'Fácil — 3 reps en reserva',
  8: 'Moderado — 2 reps en reserva',
  9: 'Difícil — 1 rep en reserva',
  10: 'Máximo esfuerzo — sin reps en reserva',
};

interface RpeInputProps {
  readonly value: number | undefined;
  readonly onChange: (rpe: number | undefined) => void;
  readonly label: string;
}

export function RpeInput({ value, onChange, label }: RpeInputProps): React.ReactNode {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="text-xs text-muted mr-0.5"
        title="Rate of Perceived Exertion (esfuerzo percibido)"
      >
        {label} RPE
      </span>
      {RPE_VALUES.map((rpe) => {
        const isActive = value === rpe;
        return (
          <button
            key={rpe}
            type="button"
            aria-label={`RPE ${rpe}: ${RPE_DESCRIPTIONS[rpe]}`}
            title={RPE_DESCRIPTIONS[rpe]}
            aria-pressed={isActive}
            onClick={() => onChange(isActive ? undefined : rpe)}
            className={`w-11 h-11 text-xs font-bold border cursor-pointer transition-all duration-150 active:scale-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
              isActive
                ? 'bg-accent text-white border-accent shadow-[0_0_10px_rgba(232,170,32,0.25)]'
                : 'bg-transparent text-muted border-rule hover:border-main hover:text-main'
            }`}
          >
            {rpe}
          </button>
        );
      })}
    </div>
  );
}
