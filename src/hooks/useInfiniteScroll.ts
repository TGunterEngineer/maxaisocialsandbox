import { useEffect, useRef } from "react";

/**
 * Observes a sentinel element and invokes `onIntersect` when it enters the viewport.
 * Use by attaching the returned ref to a sentinel <div /> at the bottom of a list.
 */
export function useInfiniteScroll<T extends HTMLElement = HTMLDivElement>(
  onIntersect: () => void,
  options: { enabled?: boolean; rootMargin?: string } = {},
) {
  const { enabled = true, rootMargin = "200px" } = options;
  const ref = useRef<T | null>(null);
  const cbRef = useRef(onIntersect);
  cbRef.current = onIntersect;

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) cbRef.current();
      },
      { rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [enabled, rootMargin]);

  return ref;
}
