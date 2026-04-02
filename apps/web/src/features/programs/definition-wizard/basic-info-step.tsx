import { useState } from 'react';
import { Button } from '@/components/button';
import type { WizardStepProps } from './types';

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;

interface FieldErrors {
  readonly name?: string;
  readonly description?: string;
}

export function BasicInfoStep({
  definition,
  onUpdate,
  onNext,
  onBack,
}: WizardStepProps): React.ReactNode {
  const [name, setName] = useState(definition.name);
  const [description, setDescription] = useState(definition.description);
  const [errors, setErrors] = useState<FieldErrors>({});

  const validate = (): boolean => {
    const trimmedName = name.trim();
    const nameError =
      trimmedName.length === 0
        ? 'El nombre es obligatorio'
        : trimmedName.length > MAX_NAME_LENGTH
          ? `Maximo ${MAX_NAME_LENGTH} caracteres`
          : undefined;
    const descError =
      description.length > MAX_DESCRIPTION_LENGTH
        ? `Maximo ${MAX_DESCRIPTION_LENGTH} caracteres`
        : undefined;
    const next: FieldErrors = { name: nameError, description: descError };
    setErrors(next);
    return nameError === undefined && descError === undefined;
  };

  const handleNext = (): void => {
    if (!validate()) return;
    onUpdate({ name: name.trim(), description: description.trim() });
    onNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="def-name" className="block text-xs font-bold text-muted mb-1.5">
          Nombre del programa
        </label>
        <input
          id="def-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME_LENGTH}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none transition-colors"
          placeholder="Mi programa personalizado"
        />
        {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
        <p className="text-2xs text-zinc-500 mt-1">
          {name.length}/{MAX_NAME_LENGTH}
        </p>
      </div>

      <div>
        <label htmlFor="def-description" className="block text-xs font-bold text-muted mb-1.5">
          Descripcion (opcional)
        </label>
        <textarea
          id="def-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={MAX_DESCRIPTION_LENGTH}
          rows={3}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none transition-colors resize-none"
          placeholder="Describe tu programa..."
        />
        {errors.description && <p className="text-xs text-red-400 mt-1">{errors.description}</p>}
        <p className="text-2xs text-zinc-500 mt-1">
          {description.length}/{MAX_DESCRIPTION_LENGTH}
        </p>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleNext}>
          Siguiente
        </Button>
      </div>
    </div>
  );
}
