/**
 * Test-only stand-ins for browser APIs jsdom lacks: HTMLDialogElement.showModal/close (shared/ui Dialog,
 * CapsuleReveal) and window.matchMedia (pointer tilt, motion). Same idea as the capsule-reveal helper,
 * kept local so slices don't import each other.
 */
export function polyfillDom(): void {
  const Ctor = (globalThis as { HTMLDialogElement?: typeof HTMLElement }).HTMLDialogElement;
  const proto = (Ctor ?? HTMLElement).prototype as HTMLElement & {
    showModal?: () => void;
    close?: () => void;
  };
  if (typeof proto.showModal !== 'function') {
    proto.showModal = function showModal(this: HTMLElement) {
      this.setAttribute('open', '');
    };
  }
  if (typeof proto.close !== 'function') {
    proto.close = function close(this: HTMLElement) {
      this.removeAttribute('open');
    };
  }
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }
}
