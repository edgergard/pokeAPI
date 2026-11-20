/** "mr-mime" → "Mr Mime" */
export const formatName = (slug: string) =>
  slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

/** 25 → "#025" */
export const formatDexNumber = (id: number) => `#${String(id).padStart(3, '0')}`;
