import { useId } from 'react';
import { Check, Lock, RotateCcw, Sparkles } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

export type TalentNodeState = 'learned' | 'available' | 'locked';

/** One talent as the tree shows it. Views map domain node states to this. */
export type TalentNodeView = {
  id: string;
  name: string;
  description: string;
  /** Id of the group (branch / line) the node sits in. */
  group: string;
  /** 1-based position inside its group (the tier for Pokémon branches). */
  tier: number;
  /** Names of the talents it needs, repeated as text ("Requires: Quick Draw"). */
  requires: readonly string[];
  state: TalentNodeState;
  /** Why a locked node can't be learned yet, as text ("First talent point at Lv 5"). */
  reason?: string;
  /** Short extra tag on the node (e.g. "Lv 6" for trainer talents). */
  tag?: string;
};

export type TalentGroupView = { id: string; label: string; description?: string };

type Props = {
  /** 'pokemon': 3 branches × 4 tiers; 'trainer': rule talents in lines with dependency links. */
  variant: 'pokemon' | 'trainer';
  title: string;
  /** Group order and labels; nodes of unknown groups are not shown. */
  groups: readonly TalentGroupView[];
  nodes: readonly TalentNodeView[];
  pointsAvailable: number;
  /** Shown under the points when none are left ("Next point at Lv 10"). */
  pointsNote?: string;
  onLearn: (id: string) => void;
  onReset: () => void;
  /** "Reset talents · free" / "Reset tree". */
  resetLabel: string;
};

const pointsText = (n: number) => `${n} ${n === 1 ? 'point' : 'points'} available`;

/**
 * Talent tree (design.md component `TalentTree`): a list of labelled groups of node buttons. A node is a
 * real button: `aria-pressed` when learned, `aria-disabled` + the reason in text when locked; pressing an
 * available node learns it. Prerequisites are repeated as text, never shown by line or colour alone.
 */
export function TalentTree({
  variant,
  title,
  groups,
  nodes,
  pointsAvailable,
  pointsNote,
  onLearn,
  onReset,
  resetLabel,
}: Props) {
  const headingId = useId();
  const resetReasonId = useId();
  const anyLearned = nodes.some((n) => n.state === 'learned');

  return (
    <section
      aria-labelledby={headingId}
      data-variant={variant}
      className="flex flex-col gap-4 rounded-3xl p-4 glass sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={headingId} className="font-display text-xl font-bold tracking-tight">
            {title}
          </h2>
          <p className="flex items-center gap-1.5 text-sm text-foreground">
            <Sparkles
              aria-hidden
              className={cn(
                'size-4',
                pointsAvailable > 0 ? 'text-primary' : 'text-muted-foreground',
              )}
            />
            <span data-testid="talent-points">{pointsText(pointsAvailable)}</span>
          </p>
          {pointsAvailable === 0 && pointsNote && (
            <p className="text-sm text-muted-foreground">{pointsNote}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={() => {
              if (anyLearned) onReset();
            }}
            aria-disabled={!anyLearned || undefined}
            aria-describedby={anyLearned ? undefined : resetReasonId}
            className={cn(
              'inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-input px-4 text-sm font-semibold text-foreground transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              anyLearned
                ? 'cursor-pointer hover:border-foreground hover:bg-secondary'
                : 'cursor-not-allowed text-muted-foreground',
            )}
          >
            <RotateCcw aria-hidden className="size-4" />
            {resetLabel}
          </button>
          {!anyLearned && (
            <span id={resetReasonId} className="text-xs text-muted-foreground">
              No talents learned yet
            </span>
          )}
        </div>
      </div>

      <ul
        aria-label={variant === 'pokemon' ? 'Talent branches' : 'Talent lines'}
        className={cn(
          'grid gap-3',
          variant === 'pokemon' ? 'sm:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-4',
        )}
      >
        {groups.map((group) => (
          <TalentGroup
            key={group.id}
            group={group}
            nodes={nodes.filter((n) => n.group === group.id).sort((a, b) => a.tier - b.tier)}
            onLearn={onLearn}
          />
        ))}
      </ul>
    </section>
  );
}

function TalentGroup({
  group,
  nodes,
  onLearn,
}: {
  group: TalentGroupView;
  nodes: readonly TalentNodeView[];
  onLearn: (id: string) => void;
}) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-2xl bg-muted/60 p-3">
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={group.description ? descriptionId : undefined}
        className="flex flex-col gap-2"
      >
        <div className="flex flex-col gap-0.5">
          <h3
            id={labelId}
            className="font-mono text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase"
          >
            {group.label}
          </h3>
          {group.description && (
            <p id={descriptionId} className="text-xs text-muted-foreground">
              {group.description}
            </p>
          )}
        </div>
        <ol className="flex flex-col">
          {nodes.map((node, i) => {
            const previous = nodes[i - 1];
            // A visual link to the node above when this one depends on it (repeated as text below).
            const linked = previous !== undefined && node.requires.includes(previous.name);
            return (
              <li key={node.id} className="flex flex-col items-stretch">
                {i > 0 && (
                  <span
                    aria-hidden
                    data-linked={linked || undefined}
                    className={cn(
                      'mx-auto h-3 w-0.5 rounded-full',
                      !linked && 'opacity-0',
                      previous?.state === 'learned' ? 'bg-primary' : 'bg-border',
                    )}
                  />
                )}
                <TalentNode node={node} onLearn={onLearn} />
              </li>
            );
          })}
        </ol>
      </div>
    </li>
  );
}

function TalentNode({ node, onLearn }: { node: TalentNodeView; onLearn: (id: string) => void }) {
  const nameId = useId();
  const detailId = useId();
  const requiresText = node.requires.length > 0 ? `Requires: ${node.requires.join(', ')}` : null;
  // The reason often repeats the prerequisite ("Requires: Quick Draw"): say it once.
  const reason = node.state === 'locked' ? node.reason : undefined;
  const showRequires = requiresText !== null && requiresText !== reason;
  const status =
    node.state === 'learned' ? 'Learned' : node.state === 'available' ? 'Learn talent' : reason;

  return (
    <button
      type="button"
      data-state={node.state}
      aria-pressed={node.state === 'learned'}
      aria-disabled={node.state === 'locked' || undefined}
      aria-labelledby={nameId}
      aria-describedby={detailId}
      onClick={() => {
        if (node.state === 'available') onLearn(node.id);
      }}
      className={cn(
        'group/node flex min-h-11 w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        node.state === 'learned' && 'cursor-default border-primary bg-primary/10',
        node.state === 'available' &&
          'cursor-pointer border-input bg-card hover:border-primary hover:bg-secondary',
        node.state === 'locked' && 'cursor-not-allowed border-dashed border-border bg-card/60',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full',
          node.state === 'learned' && 'bg-primary text-primary-foreground',
          node.state === 'available' && 'border border-primary text-primary',
          node.state === 'locked' && 'border border-border text-muted-foreground',
        )}
      >
        {node.state === 'learned' ? (
          <Check className="size-3.5" />
        ) : node.state === 'locked' ? (
          <Lock className="size-3" />
        ) : (
          <span className="size-2 rounded-full bg-primary" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-baseline justify-between gap-x-2">
          <span id={nameId} className="font-semibold text-card-foreground">
            {node.name}
          </span>
          {node.tag && <span className="font-mono text-xs text-muted-foreground">{node.tag}</span>}
        </span>
        <span id={detailId} className="flex flex-col gap-0.5 text-xs">
          <span className="text-muted-foreground">{node.description}</span>
          {showRequires && <span className="text-muted-foreground">{requiresText}</span>}
          <span
            className={cn(
              'font-semibold',
              node.state === 'learned' && 'text-primary',
              node.state === 'available' && 'text-foreground',
              node.state === 'locked' && 'text-muted-foreground',
            )}
          >
            {status}
          </span>
        </span>
      </span>
    </button>
  );
}
