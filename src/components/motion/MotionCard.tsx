import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface MotionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  accentColor?: string; // hex or rgb for hover border
  className?: string;
  liftAmount?: number;
  onClick?: () => void;
}

export const MotionCard: React.FC<MotionCardProps> = ({
  children,
  accentColor = '#22D3EE',
  className = '',
  liftAmount = -2,
  onClick,
  ...props
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      onClick={onClick}
      whileHover={
        shouldReduceMotion
          ? { opacity: 0.95 }
          : {
              y: liftAmount,
              borderColor: accentColor.startsWith('#')
                ? `${accentColor}70`
                : 'rgba(34, 211, 238, 0.45)',
              boxShadow: `0 8px 24px -4px ${accentColor.startsWith('#') ? `${accentColor}18` : 'rgba(34, 211, 238, 0.1)'}`,
            }
      }
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={`transition-colors duration-150 ${className}`}
      {...(props as any)}
    >
      {children}
    </motion.div>
  );
};
