import { FEATURES } from '@/lib/landing-page-data';
import { FadeUp, StaggerContainer, StaggerItem } from '@/lib/motion-primitives';
import { SECTION_PAD, SectionHeader } from './shared';

function AppPreview(): React.ReactNode {
  return (
    <div className="relative max-w-md mx-auto">
      <div
        className="absolute -inset-6 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 40%, rgba(232,170,32,0.09) 0%, transparent 70%)',
        }}
      />
      <div className="relative bg-card border border-rule shadow-elevated overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 bg-header border-b border-rule">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-rule" />
            ))}
          </div>
          <div className="flex-1 mx-2 h-4 bg-body rounded-sm flex items-center px-2">
            <span className="font-mono text-[9px] text-muted tracking-wider">
              gravityroom.app/app/tracker
            </span>
          </div>
        </div>
        <div className="bg-body p-4 sm:p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="font-display text-xl text-title leading-none">GZCLP</p>
              <p className="font-mono text-[10px] text-muted mt-0.5">Día 1 · Semana 4</p>
            </div>
            <span className="font-mono text-[9px] px-2 py-0.5 bg-ok-bg border border-ok-ring text-ok uppercase tracking-wider">
              Activo
            </span>
          </div>
          <div className="bg-card border border-rule p-3 mb-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-main">Sentadilla</p>
              <p className="font-display-data text-2xl text-title">80 kg</p>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {[true, true, true, false, false].map((done, i) => (
                <div
                  key={i}
                  className={`h-7 border flex items-center justify-center font-mono text-[9px] ${
                    done ? 'bg-ok-bg border-ok-ring text-ok' : 'border-rule text-muted'
                  }`}
                >
                  {done ? '✓' : '5×1'}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1 bg-progress-track overflow-hidden">
              <div className="h-full w-3/5 bg-accent progress-fill" />
            </div>
            <span className="font-mono text-[10px] text-muted whitespace-nowrap">
              +10 kg desde inicio
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeaturesSection(): React.ReactNode {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className={`${SECTION_PAD} max-w-5xl mx-auto`}
    >
      <FadeUp>
        <SectionHeader
          label="Características"
          headingId="features-heading"
          title="Todo lo que Necesitas"
          subtitle="Sin relleno. Solo herramientas enfocadas que hacen que cada repetición cuente."
          subtitleWidth="md"
        />
      </FadeUp>
      <StaggerContainer stagger={0.08} className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-rule">
        {FEATURES.map((f) => (
          <StaggerItem
            key={f.title}
            className="relative bg-card p-8 transition-all landing-card-glow group flex items-start gap-5"
            style={{ borderTop: '2px solid transparent' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderTopColor = 'var(--color-accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderTopColor = 'transparent';
            }}
          >
            <div className="shrink-0 w-16 h-16 group-hover:scale-110 transition-transform duration-300 text-accent">
              {f.icon}
            </div>
            <div>
              <h3 className="text-sm font-bold mb-2 uppercase tracking-wider text-main">
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted">{f.desc}</p>
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>

      <FadeUp className="mt-14" delay={0.2}>
        <AppPreview />
      </FadeUp>
    </section>
  );
}
