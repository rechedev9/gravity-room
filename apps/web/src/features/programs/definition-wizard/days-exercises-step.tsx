import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import { Button } from '@/components/button';
import { ExercisePicker } from './exercise-picker';
import type { WizardStepProps } from './types';

const MAX_DAYS = 7;

// ---------------------------------------------------------------------------
// Wizard-local types — carry FULL slot data to avoid reconstruction
// ---------------------------------------------------------------------------

type ExerciseSlot = ProgramDefinition['days'][number]['slots'][number];

/** Full slot data + display name. Prevents property loss during editing. */
type WizardSlot = ExerciseSlot & { readonly exerciseName: string };

interface WizardDay {
  name: string;
  slots: WizardSlot[];
}

interface FormValues {
  days: WizardDay[];
}

/** Defaults applied to brand-new slots added by the user. */
const NEW_SLOT_DEFAULTS: Pick<
  ExerciseSlot,
  'tier' | 'stages' | 'onSuccess' | 'onMidStageFail' | 'onFinalStageFail'
> = {
  tier: 't1',
  stages: [{ sets: 3, reps: 10 }],
  onSuccess: { type: 'add_weight' },
  onMidStageFail: { type: 'no_change' },
  onFinalStageFail: { type: 'deload_percent', percent: 10 },
};

interface PickerTarget {
  readonly dayIndex: number;
}

function generateSlotId(dayIndex: number, slotIndex: number): string {
  return `d${dayIndex + 1}-s${slotIndex + 1}`;
}

function useDaysSchema() {
  const { t } = useTranslation();
  return z.object({
    days: z
      .array(
        z.object({
          name: z.string(),
          slots: z.array(z.custom<WizardSlot>()).min(1, t('programs.wizard.min_one_exercise')),
        })
      )
      .min(1),
  }) satisfies z.ZodType<FormValues, FormValues>;
}

export function DaysAndExercisesStep({
  definition,
  onUpdate,
  onNext,
  onBack,
}: WizardStepProps): React.ReactNode {
  const { t } = useTranslation();
  const daysSchema = useDaysSchema();
  const [selectedDay, setSelectedDay] = useState(0);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(daysSchema),
    defaultValues: {
      days: definition.days.map((d) => ({
        name: d.name,
        slots: d.slots.map(
          (s): WizardSlot => ({
            ...s,
            exerciseName: definition.exercises[s.exerciseId]?.name ?? s.exerciseId,
          })
        ),
      })),
    },
  });

  const {
    fields: dayFields,
    append: appendDay,
    remove: removeDay,
    update: updateDay,
  } = useFieldArray({
    control,
    name: 'days',
  });

  const watchedDays = watch('days');

  const handleAddDay = (): void => {
    if (dayFields.length >= MAX_DAYS) return;
    const newIndex = dayFields.length;
    appendDay({ name: t('programs.wizard.day_label', { number: newIndex + 1 }), slots: [] });
    setSelectedDay(newIndex);
  };

  const handleRemoveDay = (index: number): void => {
    if (dayFields.length <= 1) return;
    removeDay(index);
    setSelectedDay((prev) => Math.min(prev, dayFields.length - 2));
  };

  const handleDayNameChange = (index: number, name: string): void => {
    const current = watchedDays[index];
    if (!current) return;
    updateDay(index, { ...current, name });
  };

  const handleRemoveSlot = (dayIndex: number, slotIndex: number): void => {
    const current = watchedDays[dayIndex];
    if (!current) return;
    updateDay(dayIndex, {
      ...current,
      slots: current.slots.filter((_, si) => si !== slotIndex),
    });
  };

  const handleExerciseSelected = (exercise: {
    readonly id: string;
    readonly name: string;
  }): void => {
    if (pickerTarget === null) return;
    const { dayIndex } = pickerTarget;
    const current = watchedDays[dayIndex];
    if (!current) return;
    const slotIndex = current.slots.length;
    const newSlot: WizardSlot = {
      ...NEW_SLOT_DEFAULTS,
      id: generateSlotId(dayIndex, slotIndex),
      exerciseId: exercise.id,
      startWeightKey: exercise.id,
      exerciseName: exercise.name,
    };
    updateDay(dayIndex, { ...current, slots: [...current.slots, newSlot] });
    setPickerTarget(null);
  };

  const onValid = (values: FormValues): void => {
    // Map directly from full-fidelity state — no index-based reconstruction needed.
    // Each WizardSlot already carries all ExerciseSlot properties.
    const exercises: Record<string, { readonly name: string }> = {};
    const updatedDays: ProgramDefinition['days'] = values.days.map((day, dayIdx) => ({
      name: day.name,
      slots: day.slots.map((slot, slotIdx) => {
        exercises[slot.exerciseId] = { name: slot.exerciseName };
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- stripping display-only field
        const { exerciseName: _displayOnly, ...slotData } = slot;
        return { ...slotData, id: generateSlotId(dayIdx, slotIdx) };
      }),
    }));

    const seenKeys = new Set<string>();
    const configFields: ProgramDefinition['configFields'] = [];
    for (const day of updatedDays) {
      for (const slot of day.slots) {
        if (!seenKeys.has(slot.startWeightKey)) {
          seenKeys.add(slot.startWeightKey);
          configFields.push({
            key: slot.startWeightKey,
            label: exercises[slot.exerciseId]?.name ?? slot.exerciseId,
            type: 'weight',
            min: 0,
            step: 2.5,
          });
        }
      }
    }

    const weightIncrements: Record<string, number> = {};
    for (const key of seenKeys) {
      weightIncrements[key] = 2.5;
    }

    onUpdate({
      days: updatedDays,
      exercises,
      configFields,
      weightIncrements,
      cycleLength: updatedDays.length,
    });
    onNext();
  };

  const currentDay = watchedDays[selectedDay];
  // Pick up per-day slot error from RHF (slots array min(1) constraint)
  const currentDayError =
    errors.days?.[selectedDay]?.slots?.root?.message ?? errors.days?.[selectedDay]?.slots?.message;

  return (
    <div className="space-y-4">
      {/* Day tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {dayFields.map((field, i) => (
          <button
            key={field.id}
            type="button"
            onClick={() => setSelectedDay(i)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              i === selectedDay
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-zinc-200'
            }`}
          >
            {watchedDays[i]?.name ?? field.id}
          </button>
        ))}
        {dayFields.length < MAX_DAYS && (
          <button
            type="button"
            onClick={handleAddDay}
            className="px-3 py-1.5 text-xs font-bold text-zinc-500 border border-dashed border-zinc-600 rounded-lg hover:text-zinc-300 hover:border-zinc-500 transition-colors cursor-pointer"
          >
            {t('programs.wizard.add_day')}
          </button>
        )}
      </div>

      {/* Current day editor */}
      {currentDay && (
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={currentDay.name}
              onChange={(e) => handleDayNameChange(selectedDay, e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none transition-colors"
              placeholder={t('programs.wizard.day_name_placeholder')}
            />
            {dayFields.length > 1 && (
              <Button variant="danger" size="sm" onClick={() => handleRemoveDay(selectedDay)}>
                {t('programs.wizard.delete_day')}
              </Button>
            )}
          </div>

          {/* Exercise slots */}
          <div className="space-y-2">
            {currentDay.slots.map((slot, slotIdx) => (
              <div
                key={slot.id}
                className="flex items-center justify-between bg-zinc-900/50 border border-zinc-700/30 rounded-lg px-3 py-2.5"
              >
                <span className="text-sm text-zinc-200">{slot.exerciseName}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSlot(selectedDay, slotIdx)}
                  className="text-xs text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                  aria-label={t('programs.wizard.remove_exercise_a11y', {
                    name: slot.exerciseName,
                  })}
                >
                  {t('programs.wizard.remove')}
                </button>
              </div>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPickerTarget({ dayIndex: selectedDay })}
          >
            {t('programs.wizard.add_exercise')}
          </Button>
        </div>
      )}

      {currentDayError && <p className="text-xs text-red-400">{currentDayError}</p>}

      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack}>
          {t('programs.wizard.back')}
        </Button>
        <Button variant="primary" onClick={() => void handleSubmit(onValid)()}>
          {t('programs.wizard.next')}
        </Button>
      </div>

      {pickerTarget !== null && (
        <ExercisePicker onSelect={handleExerciseSelected} onClose={() => setPickerTarget(null)} />
      )}
    </div>
  );
}
