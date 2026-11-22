'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { Lock, Sparkles, X } from 'lucide-react';
import { MAX_TEAM_SIZE } from '@/entities/battle';
import { RARITY_LABEL, RARITY_TEXT_CLASS } from '@/entities/capsule';
import { collectionTeamPower, strongestTeam } from '@/entities/ladder';
import { getSpecies } from '@/entities/pokemon';
import { teamSlots, teamSlotUnlockLevel } from '@/entities/progression';
import { getSave, updateSave, useSave, type OwnedPokemon } from '@/entities/save';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import {
  addToDraft,
  initialDraft,
  removeAt,
  rosterRows,
  sameTeam,
  speciesName,
  swapAnnouncement,
  swapSlots,
  type SortKey,
} from '../model/teamDraft';
import { PokemonArt } from './PokemonArt';

type Props = {
  open: boolean;
  onClose: () => void;
  /** 1-based number of a slot that just unlocked (level-up "Fill slot N"): it pulses. */
  highlightSlot?: number | null;
  /** Called with the saved team; the dialog then closes itself. */
  onSaved?: (team: number[]) => void;
};

const KEY_STEP: Partial<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowUp: -1,
  ArrowRight: 1,
  ArrowDown: 1,
};

const SAVE_ERROR = "Couldn't save the team. Try again";
const FULL_NOTICE = 'Every open slot is taken. Remove a Pokémon or pick a slot to replace.';

const stars = (n: number) => `${n} star${n === 1 ? '' : 's'}`;
const formatPower = (n: number) => n.toLocaleString('en-US');

type FocusTarget = { slot: number } | 'filter' | null;

/**
 * Team dialog (design.md `team`): pick who fights, N = `teamSlots(trainer level)` (1–4). Slots swap
 * by tapping two of them or with Alt + arrow keys (announced); a tapped Pokémon goes into the
 * selected slot or the first empty one. Nothing is saved until "Save team".
 */
export function TeamDialog({ open, onClose, highlightSlot = null, onSaved }: Props) {
  const collection = useSave((s) => s.collection);
  const savedTeam = useSave((s) => s.team);
  const level = useSave((s) => s.trainer.level);
  const slots = level === undefined ? 0 : teamSlots(level);

  const [draft, setDraft] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<SortKey>('level');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [openedFor, setOpenedFor] = useState(false);

  // Every opening starts from the saved team (state adjusted during render, not in an effect).
  if (open !== openedFor) {
    setOpenedFor(open);
    if (open) {
      setDraft(collection && savedTeam ? initialDraft(savedTeam, collection, slots) : []);
      setSelected(null);
      setFilter('');
      setError(null);
      setNotice('');
      setAnnouncement('');
    }
  }

  const slotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const filterRef = useRef<HTMLInputElement>(null);
  const focusNext = useRef<FocusTarget>(null);
  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    if (target === 'filter') filterRef.current?.focus();
    else slotRefs.current[target.slot]?.focus();
  }, [draft]);

  const filterId = useId();
  const sortId = useId();
  const owned = collection ? Object.keys(collection).length : 0;
  const rows = collection ? rosterRows(collection, { filter, sort }) : [];
  const power = collection ? collectionTeamPower(collection, draft) : 0;

  const announce = (message: string) => setAnnouncement(message);

  const swap = (from: number, to: number) => {
    announce(swapAnnouncement(draft, from, to, slots));
    setDraft(swapSlots(draft, from, to));
    setSelected(null);
  };

  const onSlotClick = (index: number) => {
    const id = draft[index];
    if (id === undefined) return;
    if (selected === null) {
      setSelected(index);
      announce(
        `${speciesName(id)} selected. Pick another slot to swap, or a Pokémon below to replace it.`,
      );
    } else if (selected === index) {
      setSelected(null);
      announce(`${speciesName(id)} deselected.`);
    } else {
      swap(selected, index);
    }
  };

  const onSlotKeyDown = (index: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = KEY_STEP[e.key];
    if (!e.altKey || step === undefined) return;
    e.preventDefault(); // Alt + ← / → is also browser history navigation
    const id = draft[index];
    if (id === undefined) return;
    const to = index + step;
    if (to < 0 || to >= draft.length) {
      announce(`${speciesName(id)} is already in the ${to < 0 ? 'first' : 'last'} slot.`);
      return;
    }
    focusNext.current = { slot: to };
    swap(index, to);
  };

  const remove = (index: number) => {
    const id = draft[index];
    if (id === undefined) return;
    const next = removeAt(draft, index);
    focusNext.current = next.length === 0 ? 'filter' : { slot: Math.min(index, next.length - 1) };
    setDraft(next);
    setSelected(null);
    setNotice('');
    announce(`${speciesName(id)} removed from slot ${index + 1}.`);
  };

  const pick = (id: number) => {
    const inTeam = draft.indexOf(id);
    if (inTeam >= 0) {
      remove(inTeam);
      focusNext.current = null;
      return;
    }
    const result = addToDraft(draft, id, slots, selected);
    if (!result.ok) {
      setNotice(FULL_NOTICE);
      announce(FULL_NOTICE);
      return;
    }
    setDraft(result.draft);
    setSelected(null);
    setNotice('');
    announce(`${speciesName(id)} added to slot ${result.slot + 1}.`);
  };

  const autoFill = () => {
    if (!collection) return;
    const team = strongestTeam(collection, slots);
    setDraft(team);
    setSelected(null);
    setNotice('');
    announce(`Team filled with your ${team.length} strongest Pokémon.`);
  };

  const save = () => {
    const team = draft.slice(0, slots);
    if (team.length === 0) return;
    let saved = false;
    try {
      updateSave((s) => ({ ...s, team }));
      saved = sameTeam(getSave()?.team ?? [], team);
    } catch {
      saved = false;
    }
    if (!saved) {
      setError(SAVE_ERROR);
      return;
    }
    setError(null);
    onSaved?.(team);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Team"
      description={
        <>
          <span className="font-mono text-foreground tabular-nums">
            {draft.length} / {slots}
          </span>
          <span aria-hidden> · </span>
          <span>
            Team power <span className="font-mono tabular-nums">{formatPower(power)}</span>
          </span>
        </>
      }
      footer={
        <>
          <Button
            variant="outline"
            onClick={autoFill}
            disabled={owned === 0}
            className="cursor-pointer justify-center"
          >
            <Sparkles className="size-4" aria-hidden />
            Auto-fill strongest
          </Button>
          <Button
            onClick={save}
            disabled={draft.length === 0}
            className="cursor-pointer justify-center"
          >
            Save team
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {error && (
          <p
            role="alert"
            className="rounded-2xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-foreground"
          >
            {error}
          </p>
        )}

        <section aria-label="Team slots" className="flex flex-col gap-2">
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: MAX_TEAM_SIZE }, (_, index) => {
              const id = draft[index];
              const pulse = highlightSlot === index + 1 && index < slots;
              if (index >= slots) {
                const unlock = teamSlotUnlockLevel(index + 1);
                const label = unlock
                  ? `Slot ${index + 1}, unlocks at Trainer level ${unlock}`
                  : `Slot ${index + 1}, locked`;
                return (
                  <li key={index}>
                    <button
                      type="button"
                      aria-disabled="true"
                      aria-label={label}
                      data-slot-state="locked"
                      onClick={() => announce(`${label}.`)}
                      className="flex h-full min-h-32 w-full cursor-not-allowed flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/60 p-3 text-center text-xs text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <Lock className="size-4" aria-hidden />
                      {unlock ? `Unlocks at Trainer Lv ${unlock}` : 'Locked'}
                    </button>
                  </li>
                );
              }
              if (id === undefined) {
                return (
                  <li key={index} className="relative">
                    <div
                      data-slot-state="empty"
                      data-highlight={pulse || undefined}
                      className="flex h-full min-h-32 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-input p-3 text-center text-xs text-muted-foreground"
                    >
                      <span className="font-mono text-foreground">Slot {index + 1}</span>
                      Tap a Pokémon below
                    </div>
                    {pulse && <SlotPulse />}
                  </li>
                );
              }
              const member = collection?.[String(id)];
              return (
                <li key={index} className="flex flex-col gap-1.5">
                  <div className="relative">
                    <button
                      ref={(el) => {
                        slotRefs.current[index] = el;
                      }}
                      type="button"
                      aria-pressed={selected === index}
                      aria-label={slotLabel(index, id, member)}
                      data-slot-state="filled"
                      data-highlight={pulse || undefined}
                      onClick={() => onSlotClick(index)}
                      onKeyDown={onSlotKeyDown(index)}
                      className={cn(
                        'flex min-h-32 w-full cursor-pointer flex-col items-center gap-1 rounded-2xl border bg-card p-2 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                        selected === index
                          ? 'border-primary ring-2 ring-primary'
                          : 'border-white/10 hover:border-white/25',
                      )}
                    >
                      <span className="self-start font-mono text-xs text-muted-foreground">
                        {index + 1}
                      </span>
                      <PokemonArt speciesId={id} kind="artwork" className="size-14" />
                      <span className="w-full truncate text-sm font-semibold">
                        {speciesName(id)}
                      </span>
                      {member && (
                        <span className="font-mono text-xs text-muted-foreground tabular-nums">
                          Lv {member.level} <span className="text-primary">★{member.stars}</span>
                        </span>
                      )}
                    </button>
                    {pulse && <SlotPulse />}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    aria-label={`Remove ${speciesName(id)} from slot ${index + 1}`}
                    className="tap-target inline-flex cursor-pointer items-center justify-center gap-1 rounded-lg py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <X className="size-3.5" aria-hidden />
                    Remove
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="text-xs text-muted-foreground">
            Tap two slots to swap them, or press Alt + arrow keys on a slot.
          </p>
        </section>

        {notice && <p className="text-sm text-foreground">{notice}</p>}

        <section aria-label="Your Pokémon" className="flex flex-col gap-3">
          {owned <= 1 && (
            <p className="text-sm text-muted-foreground">
              <Link
                href="/capsules/"
                className="tap-target font-semibold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Open capsules to grow your roster
              </Link>
            </p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-40 flex-1 flex-col gap-1">
              <label htmlFor={filterId} className="text-xs font-semibold text-muted-foreground">
                Filter Pokémon
              </label>
              <input
                ref={filterRef}
                id={filterId}
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Name"
                autoComplete="off"
                className="h-11 rounded-xl border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={sortId} className="text-xs font-semibold text-muted-foreground">
                Sort by
              </label>
              <select
                id={sortId}
                value={sort}
                onChange={(e) => setSort(e.target.value === 'name' ? 'name' : 'level')}
                className="h-11 cursor-pointer rounded-xl border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <option value="level">Level</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {filter.trim() ? `No Pokémon match “${filter.trim()}”` : 'No Pokémon yet.'}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
              {rows.map(({ owned: member, species }) => {
                const slot = draft.indexOf(member.speciesId);
                return (
                  <li key={member.speciesId}>
                    <button
                      type="button"
                      aria-pressed={slot >= 0}
                      onClick={() => pick(member.speciesId)}
                      className={cn(
                        'flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-2xl border px-2 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                        slot >= 0
                          ? 'border-primary/60 bg-primary/10'
                          : 'border-white/10 bg-card hover:border-white/25',
                      )}
                    >
                      <PokemonArt speciesId={member.speciesId} className="size-12 shrink-0" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold">{species.name}</span>
                        <span className="font-mono text-xs text-muted-foreground tabular-nums">
                          Lv {member.level}{' '}
                          <span aria-hidden className="text-primary">
                            ★{member.stars}
                          </span>
                          <span className="sr-only">, {stars(member.stars)}</span>
                          <span className="sr-only">,</span>{' '}
                          <span className={RARITY_TEXT_CLASS[species.rarity]}>
                            {RARITY_LABEL[species.rarity]}
                          </span>
                        </span>
                      </span>
                      {slot >= 0 && (
                        <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 font-mono text-xs font-bold text-primary-foreground">
                          <span className="sr-only">In team, slot </span>
                          {slot + 1}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <p role="status" className="sr-only">
          {announcement}
        </p>
      </div>
    </Dialog>
  );
}

function slotLabel(index: number, id: number, member: OwnedPokemon | undefined): string {
  const name = getSpecies(id)?.name ?? speciesName(id);
  return member
    ? `Slot ${index + 1}: ${name}, level ${member.level}, ${stars(member.stars)}`
    : `Slot ${index + 1}: ${name}`;
}

/** A newly unlocked slot pulses (the motion kill switch stills it under reduced motion). */
function SlotPulse() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 animate-pulse rounded-2xl ring-2 ring-primary"
    />
  );
}
