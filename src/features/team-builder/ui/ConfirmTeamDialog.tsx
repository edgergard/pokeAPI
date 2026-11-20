import { useEffect } from 'react';
import { usePokemonList, type Pokemon } from '@/entities/pokemon';
import { useCountUp } from '@/shared/lib/useCountUp';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { Spinner } from '@/shared/ui/Spinner';
import { PokemonRow } from '@/entities/pokemon';
import type { TeamBuilderValues } from '../model/schema';

type Props = {
  values: TeamBuilderValues | null;
  onClose: () => void;
  onConfirm: (values: TeamBuilderValues) => void;
};

export function ConfirmTeamDialog({ values, onClose, onConfirm }: Props) {
  const { data, isPending, isError, refetch } = usePokemonList(values?.team ?? []);
  const team = data.filter((p): p is Pokemon => Boolean(p));
  const total = team.reduce((sum, p) => sum + p.totalStats, 0);

  return (
    <Dialog
      open={values !== null}
      onClose={onClose}
      title={values ? `${values.firstName} ${values.lastName}` : ''}
      description="Review your team before saving it to the roster."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Back to edit
          </Button>
          <Button disabled={isPending || isError || !values} onClick={() => values && onConfirm(values)}>
            Save team
          </Button>
        </>
      }
    >
      {isPending ? (
        <div className="grid h-72 place-items-center">
          <Spinner className="size-7" label="Loading team" />
        </div>
      ) : isError ? (
        <div className="flex h-72 flex-col items-center justify-center gap-3 text-center">
          <p className="text-ink-300">Some Pokémon failed to load.</p>
          <Button variant="outline" onClick={refetch}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {team.map((pokemon, i) => (
              <PokemonRow key={pokemon.name} pokemon={pokemon} index={i} />
            ))}
          </ul>
          <p className="mt-4 flex items-baseline justify-between text-sm text-ink-400">
            <span>Combined base stats</span>
            <TeamTotal total={total} />
          </p>
        </>
      )}
    </Dialog>
  );
}

/** Rows land at 80ms + 4 × --stagger; the total starts counting right after. */
const COUNT_DELAY_MS = 320;

/** Mounted with the ready list, so every opening of the dialog counts up afresh. */
function TeamTotal({ total }: { total: number }) {
  const { ref, display, start } = useCountUp(total);

  useEffect(() => {
    const timer = setTimeout(start, COUNT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [start]);

  return (
    <span className="font-mono text-base font-bold text-white tabular-nums">
      <span className="sr-only">{total}</span>
      <span ref={ref} aria-hidden>
        {display}
      </span>
    </span>
  );
}
