import React, { useState, useCallback } from "react";
import { useSpring } from "react-spring";
import { usePrefersReducedMotion } from "./prefers-reduced-motion";
// Heavily inspired by Josh Comeau: https://www.joshwcomeau.com/react/boop/ 💖

export function useWiggle({
  x = 0,
  y = 0,
  rotation = 0,
  scale = 1,
  timing = 150,
  springConfig = {
    tension: 300,
    friction: 10
  }
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isActive, setIsActive] = useState(false);
  // We offload the actual animation to spring: https://www.react-spring.io/docs/hooks/use-spring
  const style = useSpring({
    transform: isActive
      ? `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`
      : `translate(0px, 0px) rotate(0deg) scale(1)`,
    config: springConfig
  });

  React.useEffect(() => {
    if (!isActive) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setIsActive(false);
    }, timing);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isActive]);

  const trigger = useCallback(() => {
    setIsActive(true);
  }, []);

  let appliedStyle = prefersReducedMotion ? {} : style;

  return [appliedStyle, trigger];
}
