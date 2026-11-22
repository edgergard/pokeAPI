/**
 * The only place creature image URLs are built (contract; idea.md IP risk mitigation): swapping this file
 * re-skins the whole game with original creatures. Callers must handle load errors (type-coloured silhouette).
 */
const RAW = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

export type ArtKind = 'artwork' | 'sprite' | 'animated';

export function getCreatureArt(speciesId: number, kind: ArtKind = 'artwork'): string {
  switch (kind) {
    case 'artwork':
      return `${RAW}/other/official-artwork/${speciesId}.png`;
    case 'animated':
      return `${RAW}/other/showdown/${speciesId}.gif`;
    case 'sprite':
      return `${RAW}/${speciesId}.png`;
  }
}
