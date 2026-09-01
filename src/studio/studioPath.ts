/** Parse `/studio/:id` from the location path.

    `useParams()` on the optional `/studio/:notebookId?` route can stay
    empty after a client navigate (URL updates, shelf stays). Pathname
    is the source of truth. */
export function studioNotebookIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/studio\/([^/]+)$/);
  const id = match?.[1];
  if (!id) return undefined;
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}
