import { useState, useEffect, useCallback } from "react";
import { Router, Route } from "wouter";

/**
* We use hash based location https://github.com/molefrog/wouter#customizing-the-location-hook
* The router in app.jsx uses this hook
*/

// Return the current hash location (excluding the '#' symbol)
const currentLoc = () => window.location.hash.replace("#", "") || "/";

const useHashLocation = () => {
  const [loc, setLoc] = useState(currentLoc());

  useEffect(() => {
    const handler = () => setLoc(currentLoc());

    // Subscribe on hash changes
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const navigate = useCallback(to => (window.location.hash = to), []);
  return [loc, navigate];
};

export default useHashLocation;
