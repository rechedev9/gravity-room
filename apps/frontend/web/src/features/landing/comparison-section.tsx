import { motion, useReducedMotion } from 'motion/react';
import { FadeUp, fadeInVariants } from '@/lib/motion-primitives';
import { SECTION_PAD, SectionLabel } from './shared';
import type { ComparisonContent } from './content';

/* ── Icons ───────────────────────────────────────────────────────────────── */

function CheckIcon(): React.ReactNode {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-accent"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CrossIcon(): React.ReactNode {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-muted/40"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/* ── Cell ────────────────────────────────────────────────────────────────── */

interface CellProps {
  readonly value: boolean;
  readonly yesLabel: string;
  readonly noLabel: string;
}

function Cell({ value, yesLabel, noLabel }: CellProps): React.ReactNode {
  return (
    <span
      className="flex items-center justify-center"
      aria-label={value ? yesLabel : noLabel}
      title={value ? yesLabel : noLabel}
    >
      {value ? <CheckIcon /> : <CrossIcon />}
    </span>
  );
}

/* ── Props ───────────────────────────────────────────────────────────────── */

interface ComparisonSectionProps {
  readonly content: ComparisonContent;
}

/* ── Component ───────────────────────────────────────────────────────────── */

export function ComparisonSection({ content }: ComparisonSectionProps): React.ReactNode {
  const reduced = useReducedMotion();
  const init = reduced ? 'visible' : 'hidden';

  const { alternatives, rows, colGravityRoom, yesLabel, noLabel } = content;

  return (
    <section
      id="comparison"
      aria-labelledby="comparison-heading"
      className={`${SECTION_PAD} max-w-5xl mx-auto`}
    >
      {/* Header */}
      <FadeUp className="text-center mb-12">
        <SectionLabel>{content.sectionLabel}</SectionLabel>
        <p className="font-mono text-[11px] tracking-[0.3em] uppercase text-muted mb-3">
          {content.eyebrow}
        </p>
        <h2
          id="comparison-heading"
          className="font-display leading-none text-title mb-4"
          style={{ fontSize: 'clamp(32px, 5vw, 56px)', letterSpacing: '0.02em' }}
        >
          {content.title}
        </h2>
        <p className="text-sm leading-relaxed text-muted max-w-xl mx-auto">{content.body}</p>
      </FadeUp>

      {/* ── Desktop table (md+) ─────────────────────────────────────────── */}
      <motion.div
        initial={init}
        whileInView="visible"
        viewport={{ once: true, margin: '0px 0px -40px 0px' }}
        variants={fadeInVariants}
        className="hidden md:block overflow-x-auto"
      >
        <table className="w-full border-collapse text-sm" aria-label={content.sectionLabel}>
          <thead>
            <tr>
              {/* Feature column header */}
              <th
                scope="col"
                className="text-left py-3 px-4 font-mono text-[10px] tracking-[0.2em] uppercase text-muted border-b border-rule w-[40%]"
              >
                <span className="sr-only">{content.featureColLabel}</span>
              </th>

              {/* Gravity Room column */}
              <th
                scope="col"
                className="py-3 px-4 text-center font-mono text-[10px] tracking-[0.2em] uppercase border-b border-rule bg-accent/5"
              >
                <span className="text-accent font-bold">{colGravityRoom}</span>
              </th>

              {/* Alternative columns */}
              {alternatives.map((alt) => (
                <th
                  key={alt.label}
                  scope="col"
                  className="py-3 px-4 text-center font-mono text-[10px] tracking-[0.2em] uppercase text-muted border-b border-rule"
                >
                  <span className="block">{alt.label}</span>
                  {alt.sublabel && (
                    <span className="block normal-case tracking-normal text-[9px] text-muted/60 mt-0.5">
                      {alt.sublabel}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, i) => (
              <tr key={row.feature} className={i % 2 === 0 ? 'bg-white/[0.015]' : ''}>
                <td className="py-3.5 px-4 text-sm text-main border-b border-rule/50">
                  {row.feature}
                </td>

                {/* Gravity Room cell */}
                <td className="py-3.5 px-4 text-center border-b border-rule/50 bg-accent/5">
                  <Cell value={row.gravityRoom} yesLabel={yesLabel} noLabel={noLabel} />
                </td>

                {/* Alternative cells */}
                {row.alternatives.map((val, j) => (
                  <td
                    key={alternatives[j]?.label ?? j}
                    className="py-3.5 px-4 text-center border-b border-rule/50"
                  >
                    <Cell value={val} yesLabel={yesLabel} noLabel={noLabel} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      {/* ── Mobile card stack (< md) ────────────────────────────────────── */}
      <div className="md:hidden flex flex-col gap-6">
        {/* Gravity Room card */}
        <motion.div
          initial={init}
          whileInView="visible"
          viewport={{ once: true, margin: '0px 0px -40px 0px' }}
          variants={fadeInVariants}
          className="bg-card border border-accent/30 landing-card-glow overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-rule bg-accent/5">
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-accent font-bold">
              {colGravityRoom}
            </p>
          </div>
          <ul className="divide-y divide-rule/50" role="list">
            {rows.map((row) => (
              <li key={row.feature} className="flex items-center justify-between px-5 py-3 gap-3">
                <span className="text-sm text-main">{row.feature}</span>
                <Cell value={row.gravityRoom} yesLabel={yesLabel} noLabel={noLabel} />
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Alternative cards */}
        {alternatives.map((alt, altIdx) => (
          <motion.div
            key={alt.label}
            initial={init}
            whileInView="visible"
            viewport={{ once: true, margin: '0px 0px -40px 0px' }}
            variants={fadeInVariants}
            className="bg-card border border-rule overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-rule bg-white/[0.02]">
              <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted font-bold">
                {alt.label}
              </p>
              {alt.sublabel && <p className="text-[11px] text-muted/60 mt-0.5">{alt.sublabel}</p>}
            </div>
            <ul className="divide-y divide-rule/50" role="list">
              {rows.map((row) => (
                <li key={row.feature} className="flex items-center justify-between px-5 py-3 gap-3">
                  <span className="text-sm text-muted">{row.feature}</span>
                  <Cell
                    value={row.alternatives[altIdx] ?? false}
                    yesLabel={yesLabel}
                    noLabel={noLabel}
                  />
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
