interface SidebarTriggerProps {
  readonly isOpen: boolean;
  readonly onToggle: () => void;
}

export function SidebarTrigger({ isOpen, onToggle }: SidebarTriggerProps): React.ReactNode {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
      aria-expanded={isOpen}
      className="flex flex-col justify-center items-center w-10 h-10 gap-1.5 cursor-pointer text-muted hover:text-main transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span
        className="block h-0.5 w-5 bg-current transition-transform duration-200"
        style={{ transform: isOpen ? 'rotate(45deg) translate(2px, 2px)' : 'none' }}
      />
      <span
        className="block h-0.5 w-5 bg-current transition-opacity duration-200"
        style={{ opacity: isOpen ? 0 : 1 }}
      />
      <span
        className="block h-0.5 w-5 bg-current transition-transform duration-200"
        style={{ transform: isOpen ? 'rotate(-45deg) translate(2px, -2px)' : 'none' }}
      />
    </button>
  );
}
