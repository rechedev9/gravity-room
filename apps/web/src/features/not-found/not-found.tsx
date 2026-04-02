import { Link } from 'react-router-dom';

export function NotFound(): React.ReactNode {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-body px-6 text-center relative overflow-hidden">
      {/* Ambient glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[300px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, rgba(232, 170, 32, 0.06) 0%, transparent 70%)',
        }}
      />

      <img
        src="/logo.webp"
        alt="Gravity Room logo"
        width={64}
        height={64}
        className="rounded-full mb-8 relative"
        style={{ boxShadow: '0 0 20px rgba(232, 170, 32, 0.15)' }}
      />
      <h1
        className="font-display text-7xl sm:text-8xl text-title mb-3 relative"
        style={{ textShadow: '0 0 40px rgba(240, 192, 64, 0.2)' }}
      >
        404
      </h1>
      <p className="text-sm text-muted mb-8 max-w-xs relative">
        Esta página no existe. Puede que haya sido movida, o escribiste la URL incorrectamente.
      </p>
      <Link
        to="/"
        className="px-6 py-3 text-xs font-bold border-2 border-btn-ring bg-btn-active text-btn-active-text hover:opacity-90 transition-all active:scale-[0.97] relative"
      >
        Ir al Inicio
      </Link>
    </div>
  );
}
