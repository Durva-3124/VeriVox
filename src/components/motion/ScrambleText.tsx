import React, { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';

interface ScrambleTextProps {
  text: string;
  durationMs?: number;
  className?: string;
  delayMs?: number;
}

const GLYPHS = '01#@$%&*<>[]{}~_+!X∆ΣΩψλ';

export const ScrambleText: React.FC<ScrambleTextProps> = ({
  text,
  durationMs = 600,
  className = '',
  delayMs = 80,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [displayText, setDisplayText] = useState<string>(shouldReduceMotion ? text : '');

  useEffect(() => {
    if (shouldReduceMotion) {
      setDisplayText(text);
      return;
    }

    let timeoutId: NodeJS.Timeout;
    let intervalId: NodeJS.Timeout;
    const startTime = Date.now();
    const length = text.length;

    // Start with fully scrambled random glyphs
    const getRandomGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

    timeoutId = setTimeout(() => {
      intervalId = setInterval(() => {
        const elapsed = Date.now() - (startTime + delayMs);
        const progress = Math.min(1, Math.max(0, elapsed / durationMs));
        
        // Number of characters resolved from left to right
        const resolvedCount = Math.floor(progress * length);

        let result = '';
        for (let i = 0; i < length; i++) {
          if (text[i] === ' ') {
            result += ' ';
          } else if (i < resolvedCount) {
            result += text[i];
          } else {
            result += getRandomGlyph();
          }
        }

        setDisplayText(result);

        if (progress >= 1) {
          clearInterval(intervalId);
          setDisplayText(text);
        }
      }, 30);
    }, delayMs);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [text, durationMs, delayMs, shouldReduceMotion]);

  return <span className={className}>{displayText || text}</span>;
};
