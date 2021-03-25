import React from "react";

const query = "(prefers-reduced-motion: no-preference)";

export function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(
    !window.matchMedia(query).matches
  );
  React.useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const listener = event => {
      setPrefersReducedMotion(!event.matches);
    };
    mediaQueryList.addListener(listener);
    return () => {
      mediaQueryList.removeListener(listener);
    };
  }, []);
  return prefersReducedMotion;
}
