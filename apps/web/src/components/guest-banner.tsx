import { useNavigate } from 'react-router-dom';
import { useGuest } from '@/contexts/guest-context';

interface GuestBannerProps {
  readonly className?: string;
}

export function GuestBanner({ className }: GuestBannerProps): React.ReactNode {
  const { exitGuestMode } = useGuest();
  const navigate = useNavigate();

  const handleCreateAccount = (): void => {
    exitGuestMode();
    navigate('/login');
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs bg-card border border-rule ${className ?? ''}`}
    >
      <span className="text-muted">
        Modo invitado &mdash; crea una cuenta para guardar tu progreso
      </span>
      <button
        type="button"
        onClick={handleCreateAccount}
        className="font-bold text-[10px] tracking-widest uppercase px-3 py-1.5 border-2 border-btn-ring bg-btn-active text-btn-active-text cursor-pointer transition-all duration-150 hover:opacity-90 active:scale-95 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        aria-label="Crear cuenta para guardar tu progreso"
      >
        Crear Cuenta
      </button>
    </div>
  );
}
