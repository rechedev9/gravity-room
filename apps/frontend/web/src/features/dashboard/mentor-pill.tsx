import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface MentorPillProps {
  readonly tips: readonly string[];
  readonly rotateMs?: number;
}

export function MentorPill({ tips, rotateMs = 12000 }: MentorPillProps): React.ReactNode {
  const { t } = useTranslation();
  const [i, setI] = useState(0);

  useEffect(() => {
    if (tips.length <= 1) return;
    const t = setInterval(() => setI((x) => (x + 1) % tips.length), rotateMs);
    return () => clearInterval(t);
  }, [tips.length, rotateMs]);

  if (tips.length === 0) return null;

  return (
    <section className="bg-card border border-rule rounded-[var(--radius-base)] shadow-[var(--shadow-card)] p-4 sm:p-5">
      <p className="chalk-stamp mb-3">{t('dashboard.mentor.title')}</p>
      <blockquote className="text-sm text-main italic leading-relaxed">« {tips[i]} »</blockquote>
      <div className="flex items-center justify-between mt-3">
        <p className="font-mono text-[10px] text-muted uppercase tracking-widest">
          {t('dashboard.mentor.signature')}
        </p>
        {tips.length > 1 && (
          <button
            type="button"
            onClick={() => setI((x) => (x + 1) % tips.length)}
            className="font-mono text-[10px] text-muted uppercase tracking-widest hover:text-main"
          >
            {t('dashboard.mentor.next')}
          </button>
        )}
      </div>
    </section>
  );
}
