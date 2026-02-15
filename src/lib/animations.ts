import { useState, useEffect, useRef } from "react";

// Animation utilities for dashboard

export const TIMING = {
  micro: 150,      // 150ms - micro-interactions
  fast: 200,       // 200ms - fast feedback
  standard: 300,   // 300ms - standard transitions
  moderate: 400,   // 400ms - moderate animations
  slow: 600,       // 600ms - emphasis animations
} as const;

export const EASING = {
  swift: 'cubic-bezier(0.4, 0, 0.2, 1)',
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
} as const;

// Stagger delay calculator
export function staggerDelay(index: number, baseDelay: number = 50): number {
  return index * baseDelay;
}

// Count-up animation hook
export function useCountUp(
  targetValue: number,
  duration: number = TIMING.slow,
  startOnMount: boolean = true
): number {
  const [currentValue, setCurrentValue] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!startOnMount) return;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      
      // easeOutQuart
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      
      setCurrentValue(Math.round(targetValue * easeProgress));

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [targetValue, duration, startOnMount]);

  return currentValue;
}

// CSS classes for animations
export const animationClasses = {
  entrance: 'animate-entrance',
  fadeIn: 'animate-fade-in',
  slideUp: 'animate-slide-up',
  scaleIn: 'animate-scale-in',
  barGrow: 'animate-bar-grow',
} as const;