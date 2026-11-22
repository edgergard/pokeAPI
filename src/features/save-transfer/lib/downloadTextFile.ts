/** Keep the object URL alive a moment after the click: some browsers start the download asynchronously. */
const REVOKE_DELAY_MS = 1000;

/** Saves `text` as a file through a temporary `<a download>` (static site: no server involved). */
export function downloadTextFile(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
