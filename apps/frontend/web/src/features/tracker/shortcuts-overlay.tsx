import { useEffect, useRef, useState } from 'react';
import { hasSeenShortcuts, markShortcutsSeen } from './shortcuts-storage';

export function ShortcutsOverlay(): React.ReactNode {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!hasSeenShortcuts()) setOpen(true);
  }, []);

  useEffect(() => {
    if (open) dialogRef.current?.showModal();
  }, [open]);

  if (!open) return null;

  const dismiss = (): void => {
    markShortcutsSeen();
    dialogRef.current?.close();
    setOpen(false);
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={dismiss}
      className="modal-box fixed inset-0 m-auto h-fit max-w-md w-[calc(100%-2rem)] bg-card border-[1.5px] border-rule rounded-[var(--radius-base)] p-6 shadow-[var(--shadow-elevated)] backdrop:bg-black/72 backdrop:backdrop-blur-md"
    >
      <p className="chalk-stamp mb-1">ATAJOS DE TECLADO</p>
      <hr className="border-rule mb-4" />
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="font-mono text-label">[S]</dt>
        <dd className="text-main">éxito</dd>
        <dt className="font-mono text-label">[F]</dt>
        <dd className="text-main">fallo</dd>
        <dt className="font-mono text-label">[←]</dt>
        <dd className="text-main">serie anterior</dd>
        <dt className="font-mono text-label">[→]</dt>
        <dd className="text-main">serie siguiente</dd>
        <dt className="font-mono text-label">[U]</dt>
        <dd className="text-main">deshacer último</dd>
      </dl>
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={dismiss}
          className="bg-accent text-on-accent border-[1.5px] border-accent rounded-[var(--radius-base)] px-5 py-2 font-bold uppercase tracking-wide hover:bg-accent-hover active:translate-y-px transition-transform duration-[var(--duration-press)] ease-[var(--ease-press)]"
        >
          ENTENDIDO
        </button>
      </div>
    </dialog>
  );
}
