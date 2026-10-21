import { useCallback, useEffect, useRef, useState } from 'react';
/** 1 s réelle = 1 ms physique à vitesse 1×, indépendamment de la fréquence. */
export const PEDAGOGICAL_TIME_SCALE = 0.001;
export function useSimulationClock(active: boolean, running: boolean, speed: number) {
  const [time, setDisplayTime] = useState(0);
  const value = useRef(0);
  const setTime = useCallback((next: number | ((current: number) => number)) => {
    const result = typeof next === 'function' ? next(value.current) : next;
    value.current = Math.max(0, result); setDisplayTime(value.current);
  }, []);
  useEffect(() => {
    if (!active || !running) return;
    let frame = 0, previous: number | null = null, disposed = false;
    const tick = (now: number) => {
      if (disposed) return;
      if (previous !== null) value.current += Math.min((now - previous) / 1000, 0.04) * PEDAGOGICAL_TIME_SCALE * speed;
      previous = now; setDisplayTime(value.current);
      frame = requestAnimationFrame(tick);
    };
    const stop = () => { cancelAnimationFrame(frame); frame = 0; previous = null; };
    const visibility = () => { stop(); if (!document.hidden && !disposed) frame = requestAnimationFrame(tick); };
    document.addEventListener('visibilitychange', visibility); visibility();
    return () => { disposed = true; stop(); document.removeEventListener('visibilitychange', visibility); };
  }, [active, running, speed]);
  return { time, setTime };
}
