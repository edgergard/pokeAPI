import type { BattleEvent, BattleTeam, Fighter, FighterSummary, Side } from '@/entities/battle';
import { formatName } from '@/shared/lib/format';

export type PopupTone = 'damage' | 'super' | 'weak' | 'crit' | 'miss' | 'immune';

export type HudPopup = { id: number; fighterId: string; text: string; tone: PopupTone };

export type HudResult = { winner: Side; reason: 'knockout' | 'turnCap'; summary: FighterSummary[] };

/** Everything the HUD shows, derived purely from the events delivered so far. */
export type HudState = {
  hp: Record<string, { current: number; max: number }>;
  active: Record<Side, string | null>;
  ko: Set<string>;
  lastMove: { attackerId: string; name: string } | null;
  popups: HudPopup[];
  result: HudResult | null;
};

/** Older popups have long finished animating; keeping a few lets overlapping ones coexist. */
const MAX_POPUPS = 6;

export function initialHud(red: BattleTeam, blue: BattleTeam): HudState {
  const hp: HudState['hp'] = {};
  for (const f of [...red.fighters, ...blue.fighters]) hp[f.id] = { current: f.stats.hp, max: f.stats.hp };
  return { hp, active: { red: null, blue: null }, ko: new Set(), lastMove: null, popups: [], result: null };
}

/** Fighter ids are `${side}-${slot}`. */
const sideOf = (fighterId: string): Side => (fighterId.startsWith('red') ? 'red' : 'blue');

const withPopup = (state: HudState, fighterId: string, text: string, tone: PopupTone): HudState => {
  const id = (state.popups.at(-1)?.id ?? 0) + 1;
  return { ...state, popups: [...state.popups, { id, fighterId, text, tone }].slice(-MAX_POPUPS) };
};

function hitTone(event: Extract<BattleEvent, { kind: 'hit' }>): PopupTone {
  if (event.critical) return 'crit';
  if (event.effectiveness > 1) return 'super';
  if (event.effectiveness < 1) return 'weak';
  return 'damage';
}

/** Pure: returns a new state (or the same one when the event changes nothing shown). */
export function reduceHud(state: HudState, event: BattleEvent): HudState {
  switch (event.kind) {
    case 'enter':
      return { ...state, active: { ...state.active, [sideOf(event.fighterId)]: event.fighterId } };
    case 'move':
      return { ...state, lastMove: { attackerId: event.attackerId, name: formatName(event.move.name) } };
    case 'hit': {
      const prev = state.hp[event.targetId];
      const hp = prev ? { ...state.hp, [event.targetId]: { ...prev, current: event.hpAfter } } : state.hp;
      return withPopup({ ...state, hp }, event.targetId, `−${event.damage}`, hitTone(event));
    }
    case 'miss':
      return withPopup(state, event.targetId, 'Miss', 'miss');
    case 'noEffect':
      return withPopup(state, event.targetId, 'No effect', 'immune');
    case 'ko': {
      const ko = new Set(state.ko);
      ko.add(event.fighterId);
      return { ...state, ko };
    }
    case 'end':
      return { ...state, result: { winner: event.winner, reason: event.reason, summary: event.summary } };
    default:
      return state;
  }
}

const SIDE_LABEL: Record<Side, string> = { red: 'Red', blue: 'Blue' };

/**
 * One battle-log line per event (null for events with nothing to say, e.g. turn starts).
 * `trainers` names the winner in the closing line; without it the side's colour is used.
 */
export function describeEvent(
  event: BattleEvent,
  fighters: Record<string, Fighter>,
  trainers?: Partial<Record<Side, string>>,
): string | null {
  const name = (id: string) => formatName(fighters[id]?.name ?? id);
  switch (event.kind) {
    case 'enter':
      return `${name(event.fighterId)} steps into the arena.`;
    case 'move':
      return `${name(event.attackerId)} used ${formatName(event.move.name)}!`;
    case 'hit': {
      const parts: string[] = [];
      if (event.critical) parts.push('A critical hit!');
      if (event.effectiveness > 1) parts.push('Super effective!');
      else if (event.effectiveness < 1) parts.push('Not very effective…');
      parts.push(event.hpAfter > 0
        ? `${name(event.targetId)} has ${event.hpAfter} HP left.`
        : `${name(event.targetId)} has no HP left.`);
      return parts.join(' ');
    }
    case 'miss':
      return `${name(event.targetId)} dodged ${name(event.attackerId)}’s attack!`;
    case 'noEffect':
      return `It doesn’t affect ${name(event.targetId)}…`;
    case 'ko':
      return `${name(event.fighterId)} is knocked out!`;
    case 'end': {
      const winner = trainers?.[event.winner] ?? SIDE_LABEL[event.winner];
      return event.reason === 'knockout'
        ? `${winner} wins by knockout!`
        : `Turn limit reached — ${winner} wins on remaining HP.`;
    }
    default:
      return null;
  }
}
