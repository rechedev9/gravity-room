import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import { Button } from '@/components/button';
import type { WizardStepProps } from './types';

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;

const BasicInfoSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(MAX_NAME_LENGTH, `Maximo ${MAX_NAME_LENGTH} caracteres`),
  description: z
    .string()
    .max(MAX_DESCRIPTION_LENGTH, `Maximo ${MAX_DESCRIPTION_LENGTH} caracteres`),
});

type BasicInfoFormValues = z.infer<typeof BasicInfoSchema>;

export function BasicInfoStep({
  definition,
  onUpdate,
  onNext,
  onBack,
}: WizardStepProps): React.ReactNode {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BasicInfoFormValues>({
    resolver: zodResolver(BasicInfoSchema),
    defaultValues: {
      name: definition.name,
      description: definition.description ?? '',
    },
    mode: 'onTouched',
  });

  const nameValue = watch('name');
  const descriptionValue = watch('description');

  const onValid = (data: BasicInfoFormValues): void => {
    onUpdate({ name: data.name.trim(), description: data.description.trim() });
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onValid)} className="space-y-6">
      <div>
        <label htmlFor="def-name" className="block text-xs font-bold text-muted mb-1.5">
          Nombre del programa
        </label>
        <input
          id="def-name"
          type="text"
          {...register('name')}
          maxLength={MAX_NAME_LENGTH}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none transition-colors"
          placeholder="Mi programa personalizado"
        />
        {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>}
        <p className="text-2xs text-zinc-500 mt-1">
          {(nameValue ?? '').length}/{MAX_NAME_LENGTH}
        </p>
      </div>

      <div>
        <label htmlFor="def-description" className="block text-xs font-bold text-muted mb-1.5">
          Descripcion (opcional)
        </label>
        <textarea
          id="def-description"
          {...register('description')}
          maxLength={MAX_DESCRIPTION_LENGTH}
          rows={3}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none transition-colors resize-none"
          placeholder="Describe tu programa..."
        />
        {errors.description && (
          <p className="text-xs text-red-400 mt-1">{errors.description.message}</p>
        )}
        <p className="text-2xs text-zinc-500 mt-1">
          {(descriptionValue ?? '').length}/{MAX_DESCRIPTION_LENGTH}
        </p>
      </div>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="ghost" onClick={onBack}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary">
          Siguiente
        </Button>
      </div>
    </form>
  );
}
