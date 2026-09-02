import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'motion/react';

interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  maxDistance?: number;
  className?: string;
  id?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export const MagneticButton: React.FC<MagneticButtonProps> = ({
  children,
  maxDistance = 6,
  className = '',
  id,
  onClick,
  ...props
}) => {
  const ref = useRef<HTMLButtonElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Spring physics for smooth magnetic follow & return
  const springX = useSpring(x, { stiffness: 260, damping: 18, mass: 0.1 });
  const springY = useSpring(y, { stiffness: 260, damping: 18, mass: 0.1 });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (shouldReduceMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Calculate offset from center, normalized and clamped to maxDistance (6px)
    const deltaX = (e.clientX - centerX) / (rect.width / 2);
    const deltaY = (e.clientY - centerY) / (rect.height / 2);

    x.set(Math.max(-maxDistance, Math.min(maxDistance, deltaX * maxDistance)));
    y.set(Math.max(-maxDistance, Math.min(maxDistance, deltaY * maxDistance)));
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      id={id}
      style={shouldReduceMotion ? {} : { x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileTap={shouldReduceMotion ? { opacity: 0.85 } : { scale: 0.97 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      className={className}
      {...(props as any)}
    >
      {children}
    </motion.button>
  );
};
