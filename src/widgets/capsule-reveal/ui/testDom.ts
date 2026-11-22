/**
 * jsdom lacks a few browser APIs the UI uses: HTMLDialogElement.showModal/close (shared/ui Dialog) and
 * window.matchMedia (pointer tilt). Minimal stand-ins so components mount in tests. Test-only.
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
