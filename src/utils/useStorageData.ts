import { useState, useEffect, useCallback, useRef } from "react";

/**
 * useStorageData — Reactive localStorage hook.
 *
 * Runs `selector` on every poll interval (default 3s) and returns a fresh
 * value whenever the serialized result differs from the previous snapshot.
 * This avoids stale `useMemo(fn, [])` patterns across admin pages where the
 * underlying localStorage data can change without a React state update.
 *
 * @param selector  Pure function that reads from localStorage and returns data.
 * @param interval  Poll interval in milliseconds (default 3000).
 */
export function useStorageData<T>(selector: () => T, interval = 3000): [T, () => void] {
  const [data, setData] = useState<T>(selector);
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const refresh = useCallback(() => {
    setData(selectorRef.current());
  }, []);

  useEffect(() => {
    // Poll on a fixed interval
    const id = setInterval(() => {
      const next = selectorRef.current();
      setData((prev) => {
        // Only trigger re-render if data actually changed
        try {
          if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
        } catch {
          // ignore serialization errors
        }
        return next;
      });
    }, interval);

    return () => clearInterval(id);
  }, [interval]);

  return [data, refresh];
}
