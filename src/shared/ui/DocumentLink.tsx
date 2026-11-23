import { forwardRef, type AnchorHTMLAttributes } from 'react';

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  /** App path, e.g. `/battle/?stage=3`. */
  href: string;
};

/**
 * A plain document navigation (full page load) instead of `next/link`.
 *
 * Use it for links into `/battle/?stage=…`: with the static export, Next 16 sometimes fetches the
 * route's RSC payload at `/battle/?…&_rsc=` (not `battle/index.txt`), the host answers with HTML and the
 * client navigation is dropped silently — the click does nothing. The battle page lazy-loads its 3D
 * chunk anyway, so a full load costs little. retire when: Next serves `.txt` payloads for every
 * static-export navigation (re-test Home → Fight in the built preview).
 */
export const DocumentLink = forwardRef<HTMLAnchorElement, Props>(function DocumentLink(
  { href, ...rest },
  ref,
) {
  return <a ref={ref} href={href} {...rest} />;
});
