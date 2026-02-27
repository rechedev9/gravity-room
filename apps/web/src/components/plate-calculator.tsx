import { useRef } from 'react';
import { calculatePlates, BAR_KG } from '@/lib/plate-calculator';
import { useClickOutside } from '@/hooks/use-click-outside';

interface PlateCalculatorProps {
  readonly weight: number;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function PlateCalculator({
  weight,
  isOpen,
  onClose,
}: PlateCalculatorProps): React.ReactNode {
  const popoverRef = useRef<HTMLDivElement>(null);
  useClickOutside(popoverRef, onClose);

  if (!isOpen) return null;

  const result = calculatePlates(weight);
  if (!result.ok) return null;

  const sideTotal = result.plates.reduce((sum, p) => sum + p.kg * p.count, 0);

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Calculadora de discos"
      data-testid="plate-calculator-popover"
      className="absolute left-0 top-full mt-1 z-50 bg-card border border-rule shadow-lg p-4 min-w-[180px]"
    >
      <p className="text-sm font-bold text-heading mb-2">{weight} kg</p>
      <p className="text-[11px] text-muted mb-3">Barra: {BAR_KG} kg</p>

      <ul className="space-y-1 mb-3">
        {result.plates.map((plate) => (
          <li key={plate.kg} className="text-xs text-main flex justify-between">
            <span>
              {plate.count} {'\u00d7'} {plate.kg} kg
            </span>
          </li>
        ))}
      </ul>

      <p className="text-[11px] font-bold text-info border-t border-rule-light pt-2">
        {sideTotal} kg por lado
      </p>
    </div>
  );
}
