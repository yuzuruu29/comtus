import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

export function usePublicPageEntry() {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    // Keep native anchor targeting and browser history restoration intact.
    if (hash || navigationType === "POP") return;
    // A new page begins at its title. The landing glides between its own
    // sections, so this must say "instant" or it would glide here as well.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    titleRef.current?.focus({ preventScroll: true });
  }, [pathname, hash, navigationType]);

  return titleRef;
}
