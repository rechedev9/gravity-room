import { useOnlineCount } from '@/hooks/use-online-count';

const DISCORD_URL = 'https://discord.gg/FXNBrgYf7U';

export function OnlineIndicator(): React.ReactNode {
  const count = useOnlineCount();
  if (count === null) return null;

  return (
    <a
      href={DISCORD_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-4 left-4 z-40 flex items-center gap-2 px-3 py-1.5 bg-card border border-rule font-mono text-[11px] text-muted hover:text-main hover:border-rule-light transition-colors duration-200 select-none"
      aria-label={`${count} usuarios online — Únete a nuestro Discord`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
      <span>{count} online</span>
    </a>
  );
}
