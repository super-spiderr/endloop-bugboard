import { useEffect, useState } from "react";

/** useState that remembers its value in localStorage (per browser). */
export function useLocalState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage blocked */
    }
  }, [key, value]);
  return [value, setValue];
}
