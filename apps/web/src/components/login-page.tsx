import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '@/contexts/auth-context';
import { sanitizeAuthError } from '@/lib/auth-errors';

export function LoginPage(): React.ReactNode {
  const { user, signInWithGoogle, signInWithDev } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      navigate('/app');
    }
  }, [user, navigate]);

  const handleGoogleSuccess = async (credential: string): Promise<void> => {
    setError(null);
    const authError = await signInWithGoogle(credential);
    if (authError) {
      setError(sanitizeAuthError(authError.message));
    }
  };

  const handleDevLogin = async (): Promise<void> => {
    setError(null);
    const authError = await signInWithDev();
    if (authError) {
      setError(sanitizeAuthError(authError.message));
    }
  };

  return (
    <div className="grain-overlay min-h-dvh flex flex-col items-center justify-center bg-body px-5 py-12 relative overflow-hidden">
      {/* Keyframe definitions */}
      <style>{`
        @keyframes riseIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes glowBreath {
          0%, 100% { opacity: 0.13; }
          50%       { opacity: 0.22; }
        }
        @keyframes haloBreath {
          0%, 100% { opacity: 0.22; transform: scale(1); }
          50%       { opacity: 0.34; transform: scale(1.08); }
        }
      `}</style>

      {/* Ambient top glow — breathes slowly */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
        style={{
          background:
            'radial-gradient(ellipse 75% 60% at 50% -5%, rgba(200,168,78,1) 0%, transparent 100%)',
          animation: 'glowBreath 5s ease-in-out infinite',
        }}
      />

      {/* Bottom darkness vignette */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-48"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)' }}
      />

      {/* Logo with pulsing halo */}
      <div
        className="relative mb-7"
        style={{ animation: 'riseIn 0.55s ease both', animationDelay: '0s' }}
      >
        <div
          aria-hidden="true"
          className="absolute rounded-full blur-2xl pointer-events-none"
          style={{
            inset: '-20px',
            background: 'rgba(200,168,78,0.22)',
            animation: 'haloBreath 3.5s ease-in-out infinite',
          }}
        />
        <img
          src="/logo.webp"
          alt="Gravity Room logo"
          width={68}
          height={68}
          className="relative block rounded-full"
          style={{ border: '1.5px solid rgba(200,168,78,0.5)' }}
        />
      </div>

      {/* Hero title */}
      <h1
        className="font-display text-center leading-[0.88] mb-1 text-heading"
        style={{
          fontSize: 'clamp(50px, 12vw, 88px)',
          letterSpacing: '0.03em',
          textShadow: '0 0 48px rgba(200,168,78,0.18)',
          animation: 'riseIn 0.55s ease both',
          animationDelay: '0.08s',
        }}
      >
        Gravity Room
      </h1>

      {/* Auth divider separator */}
      <div
        className="flex items-center gap-3 w-full max-w-[310px] my-7"
        style={{ animation: 'riseIn 0.55s ease both', animationDelay: '0.16s' }}
      >
        <div
          className="flex-1 h-px"
          style={{ background: 'linear-gradient(to right, transparent, rgba(200,168,78,0.6))' }}
        />
        <span
          className="font-mono text-[9px] tracking-[0.35em] uppercase flex-shrink-0 text-heading"
          style={{ textShadow: '0 0 10px rgba(200,168,78,0.5)' }}
        >
          Entra a la Cámara
        </span>
        <div
          className="flex-1 h-px"
          style={{ background: 'linear-gradient(to left, transparent, rgba(200,168,78,0.6))' }}
        />
      </div>

      {/* Auth card */}
      <div
        className="relative"
        style={{
          width: '100%',
          maxWidth: '300px',
          animation: 'riseIn 0.55s ease both',
          animationDelay: '0.24s',
        }}
      >
        {/* Decorative corner mark */}
        <span
          aria-hidden="true"
          className="absolute top-2.5 right-3 font-mono text-[11px] pointer-events-none select-none"
          style={{ color: 'rgba(200,168,78,0.3)' }}
        >
          ✦
        </span>

        <div
          style={{
            background: 'var(--color-card)',
            borderTop: '1px solid rgba(200,168,78,0.2)',
            borderRight: '1px solid rgba(200,168,78,0.08)',
            borderBottom: '1px solid rgba(200,168,78,0.08)',
            borderLeft: '3px solid var(--color-heading)',
            boxShadow: '-8px 0 40px rgba(200,168,78,0.07), 0 24px 64px rgba(0,0,0,0.7)',
            padding: '22px 22px 20px',
          }}
        >
          <p className="font-mono text-[9px] tracking-[0.35em] uppercase mb-5 text-heading">
            Autenticar
          </p>

          {/* Google button — dark inset slot */}
          <div
            className="flex justify-center py-3"
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <GoogleLogin
              onSuccess={({ credential }) => {
                if (credential) void handleGoogleSuccess(credential);
              }}
              onError={() => {
                setError('Error al iniciar sesión con Google. Inténtalo de nuevo.');
              }}
              theme="filled_black"
              size="large"
              width="240"
            />
          </div>

          {/* Dev-only bypass — stripped from production builds */}
          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={() => void handleDevLogin()}
              className="w-full mt-3 font-mono text-[10px] tracking-[0.2em] uppercase py-2 cursor-pointer"
              style={{
                background: 'rgba(200,168,78,0.06)',
                border: '1px dashed rgba(200,168,78,0.3)',
                color: 'rgba(200,168,78,0.6)',
              }}
            >
              ⚗ Dev Login
            </button>
          )}

          {/* Error */}
          {error && (
            <div
              className="flex items-start gap-2 text-xs mt-3 px-3 py-2 text-error"
              style={{
                background: 'var(--color-error-bg)',
                border: '1px solid var(--color-error-line)',
              }}
            >
              <span className="shrink-0 leading-none mt-px">⚠</span>
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tagline */}
      <p
        className="font-mono text-[9px] tracking-[0.4em] uppercase mt-8 text-muted"
        style={{
          opacity: 0.45,
          animation: 'riseIn 0.55s ease both',
          animationDelay: '0.32s',
        }}
      >
        Entrena mejor · Progresa más rápido
      </p>
    </div>
  );
}
