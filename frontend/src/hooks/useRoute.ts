import { useEffect, useState } from "react";
export const navigate = (path: string) => {
  window.location.hash = path;
};
export function useRoute() {
  const [path, setPath] = useState(() => window.location.hash.slice(1) || "/");
  useEffect(() => {
    const update = () => setPath(window.location.hash.slice(1) || "/");
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
    const frame = requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>("main h1")
        ?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, [path]);
  return path;
}
