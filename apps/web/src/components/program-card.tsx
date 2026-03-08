import { Link } from 'react-router-dom';

/** Minimal program info needed by ProgramCard — compatible with both CatalogEntry and ProgramDefinition. */
export interface ProgramCardInfo {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly totalWorkouts: number;
  readonly workoutsPerWeek: number;
  readonly author: string;
}

interface ProgramCardProps {
  readonly definition: ProgramCardInfo;
  readonly disabled?: boolean;
  readonly disabledLabel?: string;
  readonly isActive?: boolean;
  readonly onSelect?: () => void;
  readonly to?: string;
}

const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  strength: 'Fuerza',
  hypertrophy: 'Hipertrofia',
  powerlifting: 'Powerlifting',
};

export function ProgramCard({
  definition,
  disabled = false,
  disabledLabel = 'Próximamente',
  isActive = false,
  onSelect,
  to,
}: ProgramCardProps): React.ReactNode {
  const categoryLabel = CATEGORY_LABELS[definition.category] ?? definition.category;

  const ctaClasses = `mt-auto px-4 py-2.5 text-xs font-bold border-2 cursor-pointer transition-all text-center ${
    isActive
      ? 'border-btn-ring bg-btn-active text-btn-active-text hover:opacity-90'
      : 'border-btn-ring bg-btn text-btn-text hover:bg-btn-active hover:text-btn-active-text'
  }`;

  const showCta = to !== undefined || onSelect !== undefined || disabled;

  return (
    <div
      className={`bg-card border border-rule p-5 sm:p-6 flex flex-col gap-3 card card-interactive ${disabled ? 'opacity-60' : ''}`}
    >
      {/* Header: name + category badge */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm sm:text-base font-extrabold text-title leading-tight">
          {definition.name}
        </h3>
        <span className="shrink-0 text-2xs font-bold uppercase tracking-wider px-2 py-0.5 border border-rule text-muted">
          {categoryLabel}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-muted leading-relaxed line-clamp-3">{definition.description}</p>

      {/* Meta: workouts, frequency, author — hidden for placeholder cards */}
      {!disabled && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-info">
          <span>{definition.totalWorkouts} entrenamientos</span>
          {definition.workoutsPerWeek > 0 && <span>{definition.workoutsPerWeek}x / semana</span>}
          {definition.author && <span>Por {definition.author}</span>}
        </div>
      )}

      {/* CTA */}
      {showCta &&
        (to !== undefined ? (
          <Link to={to} className={ctaClasses} aria-label={`Ver programa ${definition.name}`}>
            Ver Programa
          </Link>
        ) : (
          <button
            onClick={onSelect}
            disabled={disabled}
            className={`${ctaClasses} disabled:opacity-30 disabled:cursor-not-allowed ${
              !isActive ? 'disabled:hover:bg-btn disabled:hover:text-btn-text' : ''
            }`}
          >
            {disabled ? disabledLabel : isActive ? 'Continuar Entrenamiento' : 'Iniciar Programa'}
          </button>
        ))}
    </div>
  );
}
