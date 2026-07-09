// Primitives — small, well-factored building blocks.
// All components register on `window` so other Babel scripts can use them.

const { useEffect, useRef, useState } = React;

/* ──────────── Button ──────────── */
function Button({
  variant = 'primary',
  size,
  children,
  onClick,
  type = 'button',
  as = 'button',
  href,
  ...rest
}) {
  const cls = [
    'btn',
    variant === 'outline' && 'btn--outline',
    variant === 'ghost' && 'btn--ghost',
    variant === 'danger' && 'btn--danger',
    size === 'sm' && 'btn--sm',
    size === 'lg' && 'btn--lg',
  ]
    .filter(Boolean)
    .join(' ');
  if (as === 'a')
    return (
      <a className={cls} href={href} onClick={onClick} {...rest}>
        {children}
      </a>
    );
  return (
    <button type={type} className={cls} onClick={onClick} {...rest}>
      {children}
    </button>
  );
}

/* ──────────── Badge ──────────── */
function Badge({ tone = 'neutral', dot, children }) {
  const map = {
    ok: 'badge--ok',
    fail: 'badge--fail',
    strength: 'badge--strength',
    hyper: 'badge--hyper',
    power: 'badge--power',
  };
  const cls = ['badge', map[tone]].filter(Boolean).join(' ');
  return (
    <span className={cls}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

/* ──────────── Eyebrow / SectionLabel ──────────── */
function Eyebrow({ children, color }) {
  return (
    <div className="eyebrow" style={color ? { color } : undefined}>
      {children}
    </div>
  );
}
function SectionLabel({ children }) {
  return <div className="section-label">{children}</div>;
}

/* ──────────── Field ──────────── */
function Field({ label, weight, value, onChange, type = 'text', placeholder, ...rest }) {
  return (
    <div className="field">
      {label && <label className="field__label">{label}</label>}
      <input
        className={'field__input' + (weight ? ' field__input--weight' : '')}
        type={type}
        value={value ?? ''}
        onChange={onChange}
        placeholder={placeholder}
        {...rest}
      />
    </div>
  );
}

/* ──────────── KpiCard ──────────── */
function KpiCard({ label, value, sub, accent, gold, trend }) {
  return (
    <div className={'kpi' + (accent ? ' kpi--accent' : '')}>
      <div className="kpi__label">{label}</div>
      <div className={'kpi__value' + (gold ? ' kpi__value--gold' : '')}>{value}</div>
      {(sub || trend) && (
        <div className="kpi__sub">
          {sub}
          {trend && (
            <>
              {' '}
              <span className={trend > 0 ? 'kpi__trend-up' : 'kpi__trend-down'}>
                {trend > 0 ? '↑' : '↓'} {trend > 0 ? '+' : ''}
                {trend}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────── ProgramCard ──────────── */
function ProgramCard({ category, name, by, description, schedule, length, onClick }) {
  return (
    <div className={'pcard pcard--' + category} onClick={onClick}>
      <div className="pcard__wash" />
      <div className="pcard__head">
        <div>
          <h3 className="pcard__name">{name}</h3>
          <p className="pcard__by">by {by}</p>
        </div>
        <Badge tone={category}>{category}</Badge>
      </div>
      <p className="pcard__desc">{description}</p>
      <div className="pcard__meta">
        <Badge>{schedule}</Badge>
        <Badge>{length}</Badge>
      </div>
    </div>
  );
}

/* ──────────── SetCell ──────────── */
function SetCell({ state = 'todo', target, reps, current, onClick }) {
  const cls = [
    'set-cell',
    state === 'done' && 'set-cell--done',
    state === 'fail' && 'set-cell--fail',
    current && 'set-cell--current',
  ]
    .filter(Boolean)
    .join(' ');
  let label;
  if (state === 'done') label = '✓';
  else if (state === 'fail') label = (reps ?? 0) + '/' + target;
  else label = '5×' + target;
  return (
    <div className={cls} onClick={onClick}>
      {label}
    </div>
  );
}

/* ──────────── ProgressBar ──────────── */
function ProgressBar({ value = 0, left, right }) {
  return (
    <div>
      <div className="progress">
        <div
          className="progress__fill"
          style={{ width: Math.max(0, Math.min(100, value)) + '%' }}
        />
      </div>
      {(left || right) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 10,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--color-muted)',
          }}
        >
          <span>{left}</span>
          <span>{right}</span>
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  Button,
  Badge,
  Eyebrow,
  SectionLabel,
  Field,
  KpiCard,
  ProgramCard,
  SetCell,
  ProgressBar,
});
