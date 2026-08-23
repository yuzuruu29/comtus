import type { ComponentPropsWithoutRef, MouseEvent } from "react";
import type { Components } from "react-markdown";
import { isTauri } from "../lib/desktop";

type Props = ComponentPropsWithoutRef<"a"> & { href: string };

function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Opens HTTP(S) links in the system browser under Tauri and keeps normal
 * browser behavior on the website. Unsafe or malformed schemes are inert. */
export default function ExternalLink({ href, onClick, children, ...props }: Props) {
  const safe = isWebUrl(href);
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (!safe) {
      event.preventDefault();
      return;
    }
    if (!isTauri()) return;
    event.preventDefault();
    void import("@tauri-apps/plugin-opener")
      .then(({ openUrl }) => openUrl(href))
      .catch(() => {
        // The href remains visible and copyable if the OS rejects the request.
      });
  };

  return (
    <a
      {...props}
      href={safe ? href : undefined}
      target="_blank"
      rel="noreferrer noopener"
      onClick={handleClick}
    >
      {children}
    </a>
  );
}

/** Shared renderer for Markdown that may contain model- or source-authored links. */
export const externalMarkdownComponents: Components = {
  a: ({ href, children }) => (
    <ExternalLink href={href ?? ""}>{children}</ExternalLink>
  ),
};
