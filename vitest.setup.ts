import '@testing-library/jest-dom/vitest';

import { afterEach } from 'vitest';

// Component tests run beside other heavy suites (three.js stage, lazy species chunks) and, during builds,
// beside other worktrees' checks: give Testing Library's async queries room before they time out.
if (typeof document !== 'undefined') {
  const { configure } = await import('@testing-library/react');
  configure({ asyncUtilTimeout: 4000 });
}

// Vitest globals are off, so Testing Library can't register its auto-cleanup.
// Most tests run in the node environment; only jsdom tests (`// @vitest-environment jsdom`) mount React.
afterEach(async () => {
  if (typeof document === 'undefined') return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
});
