import '@testing-library/jest-dom/vitest';

import { afterEach } from 'vitest';

// Vitest globals are off, so Testing Library can't register its auto-cleanup.
// Most tests run in the node environment; only jsdom tests (`// @vitest-environment jsdom`) mount React.
afterEach(async () => {
  if (typeof document === 'undefined') return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
});
