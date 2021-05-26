import React, { useState, useCallback } from "react";
import { useSpring } from "react-spring";
import { usePrefersReducedMotion } from "./prefers-reduced-motion";
// Heavily inspired by Josh Comeau: https://www.joshwcomeau.com/react/boop/ 💖

// Wiggle function accepts various parameters specifying properties for the animation
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
  // Accessibility setting from the user system indicating that they prefer to minimize motion
  const prefersReducedMotion = usePrefersReducedMotion();

  // Declare state variable isActive, set initially to false
  const [isActive, setIsActive] = useState(false);

  // We offload the actual animation to spring: https://www.react-spring.io/docs/hooks/use-spring
  const style = useSpring({
    transform: isActive
      ? `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`
      : `translate(0px, 0px) rotate(0deg) scale(1)`,
    config: springConfig
  });

  // Timing parameter determines how long the wiggle lasts using browser setTimeout function
  // React useEffect function https://reactjs.org/docs/hooks-effect.html
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
  }, [isActive]); // Continue wiggle until isActive is set false when timeout elapses

  // Set wiggle to active when the triggering event occurs - will be set false when effect completes above
  const trigger = useCallback(() => {
    setIsActive(true);
  }, []);

  let appliedStyle = prefersReducedMotion ? {} : style;

  // Return animation style effect and function to apply on trigger in page
  return [appliedStyle, trigger];
}
