import { MOTION_STORAGE_KEY } from '@/shared/lib/motionKey';

/**
 * Resolves <html data-motion> before first paint (mirrors shared/lib/motion.ts — keep in sync), so CSS motion rules
 * never flash on for visitors who turned motion off. Inlined into <head> by the root layout.
 */
export const motionScript = `(function(){var p='system';try{p=localStorage.getItem(${JSON.stringify(
  MOTION_STORAGE_KEY,
)})||'system'}catch(e){}var r=p==='off'||(p!=='on'&&matchMedia('(prefers-reduced-motion: reduce)').matches);document.documentElement.dataset.motion=r?'reduced':'full'})();`;
