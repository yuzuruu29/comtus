import { useEffect } from "react";

/** The landing's own <title>/<description>, restored when a public page
 *  unmounts. Kept in one place so index.html and this hook cannot drift. */
export const DEFAULT_TITLE = "Comtus — AI Study Companion for Students";
const DEFAULT_DESCRIPTION =
  "Comtus is an AI study companion that helps students understand difficult lessons, organize notes, practice concepts, and master what they are learning. Rough thought, polished.";

/** Each public page gets its own title and description. Crawlers read the
 *  static index.html; this is for tabs, history, and shared links. */
export function usePageMeta(title: string, description: string): void {
  useEffect(() => {
    document.title = title;
    const meta = document.querySelector('meta[name="description"]');
    meta?.setAttribute("content", description);
    return () => {
      document.title = DEFAULT_TITLE;
      meta?.setAttribute("content", DEFAULT_DESCRIPTION);
    };
  }, [title, description]);
}
