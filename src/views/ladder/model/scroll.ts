/** What `centeredScrollTop` needs from the scrolling list and the node, all in viewport pixels. */
export type ScrollGeometry = {
  /** `list.getBoundingClientRect().top + list.clientTop` (top of the scroll area, under the border). */
  listTop: number;
  /** `node.getBoundingClientRect().top` / `.height` — measured, not `offsetTop`, which is relative
   * to the nearest positioned ancestor (each `<li>` of the path is `relative`). */
  nodeTop: number;
  nodeHeight: number;
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
};

/** The list's `scrollTop` that centres the node in the scroll area, clamped to what can scroll. */
export function centeredScrollTop(g: ScrollGeometry): number {
  const target = g.scrollTop + (g.nodeTop - g.listTop) - (g.clientHeight - g.nodeHeight) / 2;
  const max = Math.max(0, g.scrollHeight - g.clientHeight);
  return Math.round(Math.min(Math.max(target, 0), max));
}
