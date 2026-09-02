import React, { useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'motion/react';

interface CursorHeroGlowProps {
  className?: string;
}

export const CursorHeroGlow: React.FC<CursorHeroGlowProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const mouseX = useMotionValue(400);
  const mouseY = useMotionValue(250);

  // Smooth easing spring for cursor trailing
  const smoothX = useSpring(mouseX, { stiffness: 90, damping: 22, mass: 0.5 });
  const smoothY = useSpring(mouseY, { stiffness: 90, damping: 22, mass: 0.5 });

  useEffect(() => {
    if (shouldReduceMotion) return;

    const handlePointerMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      // Relative coordinates inside container
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      mouseX.set(x);
      mouseY.set(y);
    };

    const container = containerRef.current;
    if (container) {
      window.addEventListener('pointermove', handlePointerMove);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, [shouldReduceMotion, mouseX, mouseY]);

  if (shouldReduceMotion) {
    return (
      <div
        ref={containerRef}
        aria-hidden="true"
        className={`absolute inset-0 overflow-hidden pointer-events-none select-none z-0 ${className}`}
      >
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[450px] bg-[#22D3EE]/10 rounded-full blur-3xl" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`absolute inset-0 overflow-hidden pointer-events-none select-none z-0 ${className}`}
    >
      <motion.div
        style={{
          x: smoothX,
          y: smoothY,
          translateX: '-50%',
          translateY: '-50%',
        }}
        className="absolute w-[600px] h-[600px] rounded-full blur-[100px] pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.15 }}
        transition={{ duration: 0.8 }}
      >
        <div
          className="w-full h-full rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(34, 211, 238, 0.45) 0%, rgba(45, 212, 191, 0.2) 35%, rgba(139, 92, 246, 0.08) 60%, transparent 80%)',
          }}
        />
      </motion.div>
    </div>
  );
};
