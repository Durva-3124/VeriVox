import React from 'react';
import { ShieldAlert, ShieldCheck, AlertTriangle, Zap } from 'lucide-react';

interface RiskGaugeProps {
  score: number; // 0 to 100
  status: string;
  size?: number;
  showIcon?: boolean;
}

export const RiskGauge: React.FC<RiskGaugeProps> = ({
  score,
  status,
  size = 220,
  showIcon = true,
}) => {
  const normalizedScore = Math.min(Math.max(score, 0), 100);
  
  // Angle for needle: -90deg (0%) to +90deg (100%)
  const needleAngle = -90 + (normalizedScore / 100) * 180;

  // Determine tier & styling
  let tier: 'SAFE' | 'ELEVATED' | 'CRITICAL' = 'SAFE';
  let activeColor = '#10B981'; // Green
  let glowFilter = 'drop-shadow(0 0 12px rgba(16, 185, 129, 0.4))';
  let badgeClasses = 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30';
  let Icon = ShieldCheck;

  if (normalizedScore >= 66) {
    tier = 'CRITICAL';
    activeColor = '#EF4444';
    glowFilter = 'drop-shadow(0 0 16px rgba(239, 68, 68, 0.6))';
    badgeClasses = 'bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/40 animate-pulse';
    Icon = ShieldAlert;
  } else if (normalizedScore >= 31) {
    tier = 'ELEVATED';
    activeColor = '#F59E0B';
    glowFilter = 'drop-shadow(0 0 14px rgba(245, 158, 11, 0.45))';
    badgeClasses = 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30';
    Icon = AlertTriangle;
  }

  return (
    <div 
      className="flex flex-col items-center justify-center relative w-full select-none cursor-help"
      title="Acoustic Impersonation Index: Real-time fused probability score (0-100) combining spectral vocoder phase distortion, pitch micro-tremors, and voiceprint cosine similarity."
    >
      <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size * 0.72 }}>
        
        {/* SVG Semicircular Arc Gauge */}
        <svg
          width={size}
          height={size * 0.65}
          viewBox="0 0 200 125"
          className="overflow-visible"
        >
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="35%" stopColor="#10B981" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="65%" stopColor="#F59E0B" />
              <stop offset="80%" stopColor="#EF4444" />
              <stop offset="100%" stopColor="#EF4444" />
            </linearGradient>
            
            <filter id="gaugeGlow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background track arc (Radius 75, Center 100, 100) */}
          <path
            d="M 25 100 A 75 75 0 0 1 175 100"
            fill="none"
            stroke="#1E293B"
            strokeWidth="14"
            strokeLinecap="round"
          />

          {/* Color zone segment indicators */}
          {/* Green Zone: 0-30% (angle ~ 0 to 54 deg along arc) */}
          <path
            d="M 25 100 A 75 75 0 0 1 175 100"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="14"
            strokeLinecap="round"
            opacity="0.25"
          />

          {/* Active progress arc */}
          {/* Circumference of half circle = PI * 75 = 235.619 */}
          <path
            d="M 25 100 A 75 75 0 0 1 175 100"
            fill="none"
            stroke={activeColor}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray="235.62"
            strokeDashoffset={235.62 * (1 - normalizedScore / 100)}
            style={{
              filter: glowFilter,
              transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.3s ease',
            }}
          />

          {/* Ticks & Zone Labels */}
          {/* Safe marker 0% */}
          <circle cx="25" cy="100" r="2.5" fill="#10B981" />
          <text x="20" y="118" fill="#64748B" fontSize="9" fontFamily="monospace" textAnchor="middle">0%</text>

          {/* Amber transition 30% */}
          <circle cx="56" cy="46" r="2.5" fill="#F59E0B" />
          <text x="56" y="38" fill="#64748B" fontSize="8" fontFamily="monospace" textAnchor="middle">30%</text>

          {/* Red transition 65% */}
          <circle cx="144" cy="46" r="2.5" fill="#EF4444" />
          <text x="144" y="38" fill="#64748B" fontSize="8" fontFamily="monospace" textAnchor="middle">65%</text>

          {/* 100% Marker */}
          <circle cx="175" cy="100" r="2.5" fill="#EF4444" />
          <text x="180" y="118" fill="#64748B" fontSize="9" fontFamily="monospace" textAnchor="middle">100%</text>

          {/* Center Needle pivot */}
          <g transform={`rotate(${needleAngle}, 100, 100)`} style={{ transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <line
              x1="100"
              y1="100"
              x2="100"
              y2="38"
              stroke={activeColor}
              strokeWidth="3.5"
              strokeLinecap="round"
              style={{ filter: glowFilter }}
            />
            <circle cx="100" cy="38" r="4" fill="#FFFFFF" />
          </g>
          <circle cx="100" cy="100" r="8" fill="#0B1120" stroke={activeColor} strokeWidth="3" />
          <circle cx="100" cy="100" r="3" fill="#FFFFFF" />
        </svg>

        {/* Center Digital readout */}
        <div className="absolute -bottom-2 flex flex-col items-center justify-center text-center">
          <div className="flex items-baseline justify-center">
            <span className="text-4xl sm:text-5xl font-bold font-mono tracking-tight text-white tabular-nums">
              {Math.round(normalizedScore)}
            </span>
            <span className="text-base font-mono text-slate-400 ml-1">/100</span>
          </div>
          <span className="text-[10px] uppercase font-mono tracking-widest font-bold text-slate-400">
            Threat Severity
          </span>
        </div>
      </div>

      {/* Status verdict pill */}
      <div className="mt-4 flex items-center justify-center">
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wide border transition-all duration-300 ${badgeClasses}`}
        >
          {showIcon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
          <span>{status}</span>
        </div>
      </div>
    </div>
  );
};
