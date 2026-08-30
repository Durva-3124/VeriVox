import React, { useEffect, useRef, useState } from 'react';
import { useInView, useMotionValue, useSpring, useReducedMotion } from 'motion/react';

interface SpringCounterProps {
  value?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  duration?: number;
  stiffness?: number;
  damping?: number;
}

export const SpringCounter: React.FC<SpringCounterProps> = ({
  value = 0,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
  stiffness = 50,
  damping = 15,
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-20px' });
  const shouldReduceMotion = useReducedMotion();

  const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
  const safeDecimals = Math.max(0, typeof decimals === 'number' ? decimals : 0);

  const motionVal = useMotionValue(0);
  const springVal = useSpring(motionVal, {
    stiffness,
    damping,
    mass: 0.8,
  });

  const [displayNumber, setDisplayNumber] = useState<string>(
    shouldReduceMotion ? safeValue.toFixed(safeDecimals) : '0'
  );

  useEffect(() => {
    if (shouldReduceMotion) {
      setDisplayNumber(safeValue.toFixed(safeDecimals));
      return;
    }

    if (isInView) {
      motionVal.set(safeValue);
    }
  }, [isInView, safeValue, shouldReduceMotion, motionVal, safeDecimals]);

  useEffect(() => {
    if (shouldReduceMotion) return;

    const unsubscribe = springVal.on('change', (latest) => {
      const safeLatest = typeof latest === 'number' && !isNaN(latest) ? latest : 0;
      setDisplayNumber(safeLatest.toFixed(safeDecimals));
    });

    return () => unsubscribe();
  }, [springVal, safeDecimals, shouldReduceMotion]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {shouldReduceMotion ? safeValue.toFixed(safeDecimals) : displayNumber}
      {suffix}
    </span>
  );
};
