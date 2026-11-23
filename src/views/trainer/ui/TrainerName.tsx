import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Pencil } from 'lucide-react';
import { updateSave } from '@/entities/save';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/Field';
import { NAME_ERROR, validTrainerName } from '../model/trainer';

/**
 * Inline rename: the name is a button; pressing it swaps in a labelled field. Enter saves the trimmed
 * name (1–24 characters, else an inline error and nothing saved); Esc or Cancel restores the name button
 * and its focus.
 */
export function TrainerName({ name, onSaved }: { name: string; onSaved: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | undefined>();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusButton = useRef(false);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (focusButton.current) {
      focusButton.current = false;
      buttonRef.current?.focus();
    }
  }, [editing]);

  const start = () => {
    setValue(name);
    setError(undefined);
    setEditing(true);
  };

  const close = () => {
    focusButton.current = true;
    setError(undefined);
    setEditing(false);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = validTrainerName(value);
    if (next === null) {
      setError(NAME_ERROR);
      return;
    }
    if (next !== name) {
      updateSave((save) => ({ ...save, trainer: { ...save.trainer, name: next } }));
      onSaved(next);
    }
    close();
  };

  if (!editing) {
    return (
      <button
        ref={buttonRef}
        type="button"
        onClick={start}
        aria-label={`Rename ${name}`}
        className="group inline-flex min-h-11 max-w-full cursor-pointer items-center gap-3 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        <span className="truncate font-display text-3xl font-extrabold tracking-tight text-foreground">
          {name}
        </span>
        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-input text-muted-foreground transition-colors group-hover:border-foreground group-hover:text-foreground">
          <Pencil aria-hidden className="size-4" />
        </span>
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-start gap-3" noValidate>
      <div className="w-full max-w-sm">
        <TextField
          ref={inputRef}
          label="Trainer name"
          hint="1–24 characters. Enter saves, Esc cancels."
          error={error}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(undefined);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              close();
            }
          }}
        />
      </div>
      <div className="flex gap-2 sm:mt-7">
        <Button type="submit" size="lg" className="cursor-pointer">
          Save
        </Button>
        <Button variant="outline" size="lg" onClick={close} className="cursor-pointer">
          Cancel
        </Button>
      </div>
    </form>
  );
}
