import { Link } from '@tanstack/react-router';
import { ProgramsIcon } from '@/components/layout/sidebar-icons';
import { Button } from '@/components/button';

interface HomeEmptyStateProps {
  readonly variant: 'guest' | 'no-program';
}

export function HomeEmptyState({ variant }: HomeEmptyStateProps): React.ReactNode {
  return (
    <div className="bg-card border border-rule p-8 text-center">
      <div className="w-10 h-10 mx-auto flex items-center justify-center border border-rule text-muted mb-4">
        <ProgramsIcon />
      </div>

      {variant === 'guest' ? (
        <>
          <p className="text-sm font-bold text-main mb-1">Modo invitado</p>
          <p className="text-xs text-muted mb-5 max-w-sm mx-auto leading-relaxed">
            Crea tu cuenta gratis para guardar tu progreso y seguir tu programa.
          </p>
          <Link to="/login">
            <Button variant="primary">Crear Cuenta</Button>
          </Link>
        </>
      ) : (
        <>
          <p className="text-sm font-bold text-main mb-1">Sin programa activo</p>
          <p className="text-xs text-muted mb-5 max-w-sm mx-auto leading-relaxed">
            Elige un programa para empezar a registrar tu entrenamiento.
          </p>
          <Link to="/app/programs">
            <Button variant="primary">Ver Programas</Button>
          </Link>
        </>
      )}
    </div>
  );
}
