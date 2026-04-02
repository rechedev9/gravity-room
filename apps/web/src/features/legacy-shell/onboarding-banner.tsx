interface OnboardingBannerProps {
  readonly onDismiss: () => void;
}

export function OnboardingBanner({ onDismiss }: OnboardingBannerProps): React.ReactNode {
  return (
    <div className="bg-card border border-rule accent-left-gold p-5 sm:p-6 mb-8 animate-[fadeSlideUp_0.3s_ease-out]">
      <h2
        className="font-display text-2xl sm:text-3xl text-title leading-none mb-2"
        style={{ textShadow: '0 0 24px rgba(240, 192, 64, 0.12)' }}
      >
        Bienvenido a Gravity Room
      </h2>
      <p className="text-sm text-muted leading-relaxed mb-4">
        Elige un programa de entrenamiento del catálogo para empezar. Cada programa ajusta peso,
        series y repeticiones automáticamente según tu progreso.
      </p>
      <div className="flex items-center gap-4">
        <span className="text-xs text-accent font-bold">↓ Elige un programa abajo</span>
        <button
          type="button"
          onClick={onDismiss}
          className="text-2xs text-muted hover:text-main cursor-pointer transition-colors uppercase tracking-wide font-bold"
        >
          Omitir guía
        </button>
      </div>
    </div>
  );
}
