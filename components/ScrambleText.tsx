import React, { useState, useEffect, useRef } from 'react';

const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%*+=|/<>!?_';

function buildFrame(target: string, progress: number): string {
  const revealCount = Math.floor(progress * target.length);
  return target
    .split('')
    .map((c, i) => {
      if (c === ' ') return ' ';
      if (i < revealCount) return c;
      return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
    })
    .join('');
}

interface ScrambleRevealProps {
  /** Texto a revelar */
  text: string;
  /** Milisegundos para completar la revelación */
  duration?: number;
  /** Milisegundos antes de empezar */
  delay?: number;
  /** Si se repite periódicamente en un intervalo aleatorio */
  repeat?: boolean;
  /** Rango [min, max] en ms entre repeticiones */
  repeatRange?: [number, number];
  className?: string;
}

/**
 * Revela un texto con animación de "scramble" (caracteres aleatorios que se
 * ordenan). Se reproduce al montar/cambiar `text` y, si `repeat` es true, se
 * vuelve a disparar cada cierto tiempo aleatorio.
 */
export function ScrambleReveal({
  text,
  duration = 900,
  delay = 0,
  repeat = true,
  repeatRange = [4000, 9000],
  className,
}: ScrambleRevealProps) {
  const [displayed, setDisplayed] = useState<string>(() => buildFrame(text, 0));
  const rafRef = useRef<number>(0);
  const timerRef = useRef<number>(0);

  useEffect(() => {
    const [minGap, maxGap] = repeatRange;

    const play = (startDelay: number) => {
      cancelAnimationFrame(rafRef.current);
      const startTime = performance.now() + startDelay;

      const tick = (now: number) => {
        if (now < startTime) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        const p = Math.min((now - startTime) / duration, 1);
        setDisplayed(buildFrame(text, p));
        if (p < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else if (repeat) {
          // Programar la próxima repetición en un tiempo aleatorio.
          const gap = minGap + Math.random() * (maxGap - minGap);
          timerRef.current = window.setTimeout(() => play(0), gap);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    setDisplayed(buildFrame(text, 0));
    play(delay);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, duration, delay, repeat]);

  return <span className={className}>{displayed}</span>;
}
