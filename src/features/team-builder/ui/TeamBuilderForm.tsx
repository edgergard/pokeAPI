import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight } from 'lucide-react';
import { TEAM_SIZE } from '@/entities/trainer';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/Field';
import { emptyTeamBuilderValues, teamBuilderSchema, type TeamBuilderValues } from '../model/schema';
import { PokemonCombobox } from './PokemonCombobox';
import { ConfirmTeamDialog } from './ConfirmTeamDialog';

type Props = {
  onSave: (values: TeamBuilderValues) => void;
};

export function TeamBuilderForm({ onSave }: Props) {
  const [pending, setPending] = useState<TeamBuilderValues | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<TeamBuilderValues>({
    resolver: zodResolver(teamBuilderSchema),
    defaultValues: emptyTeamBuilderValues,
    mode: 'onTouched',
  });

  const [firstName, lastName] = watch(['firstName', 'lastName']);

  // Celebrate the moment the form becomes submittable; alternating a/b restarts the CSS animation.
  const [unlock, setUnlock] = useState(0);
  const wasValid = useRef(isValid);
  useEffect(() => {
    if (!wasValid.current && isValid) setUnlock((n) => n + 1);
    wasValid.current = isValid;
  }, [isValid]);

  const confirm = (values: TeamBuilderValues) => {
    onSave(values);
    setPending(null);
    reset(emptyTeamBuilderValues);
  };

  return (
    <>
      <form onSubmit={handleSubmit(setPending)} noValidate className="flex flex-col gap-5">
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <TextField
            label="First name"
            placeholder="Ash"
            hint="Letters only, 2–20 characters."
            error={errors.firstName?.message}
            showClear={Boolean(firstName)}
            onClear={() => setValue('firstName', '', { shouldValidate: true })}
            {...register('firstName')}
          />
          <TextField
            label="Last name"
            placeholder="Ketchum"
            hint="Letters only, 2–20 characters."
            error={errors.lastName?.message}
            showClear={Boolean(lastName)}
            onClear={() => setValue('lastName', '', { shouldValidate: true })}
            {...register('lastName')}
          />
        </div>

        <Controller
          control={control}
          name="team"
          render={({ field, fieldState }) => (
            <PokemonCombobox
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              max={TEAM_SIZE}
              error={fieldState.isTouched ? fieldState.error?.message : undefined}
            />
          )}
        />

        <Button
          type="submit"
          size="lg"
          disabled={!isValid}
          data-unlock={unlock === 0 ? undefined : unlock % 2 ? 'a' : 'b'}
          className="relative w-full justify-center overflow-hidden"
        >
          <span aria-hidden className="btn-shine pointer-events-none absolute inset-0" />
          Review team
          <ArrowRight className="size-4" />
        </Button>
      </form>

      <ConfirmTeamDialog values={pending} onClose={() => setPending(null)} onConfirm={confirm} />
    </>
  );
}
