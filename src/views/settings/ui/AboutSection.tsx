import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { GAME_VERSION } from '@/features/save-transfer';
import { LegalLinks } from '@/shared/ui/LegalLinks';
import { SETTINGS_COPY } from '../model/notice';
import { Panel } from './Panel';

const SOURCE_URL = 'https://github.com/edgergard/trainer-studio';
const POKEAPI_URL = 'https://pokeapi.co';

function OutLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
      <ExternalLink aria-hidden className="size-3.5" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/** Disclaimer, PokéAPI credit and the source link. */
export function AboutSection() {
  return (
    <Panel id="about" title="About">
      <div className="flex flex-col gap-3 text-sm text-muted-foreground">
        <p>{SETTINGS_COPY.disclaimer}.</p>
        <p>
          Pokémon data and sprites come from <OutLink href={POKEAPI_URL}>PokéAPI</OutLink>.
        </p>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <OutLink href={SOURCE_URL}>Source code on GitHub</OutLink>
          <span className="font-mono text-xs">v{GAME_VERSION}</span>
        </p>
        <LegalLinks className="-ml-2" />
      </div>
    </Panel>
  );
}
