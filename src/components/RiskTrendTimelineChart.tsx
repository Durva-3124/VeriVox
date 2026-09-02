import React from 'react';
import { Activity, ShieldAlert, ShieldCheck, Fingerprint } from 'lucide-react';

export interface TimelineDataPoint {
  timeSec: number;
  timeLabel: string;
  overallRisk: number;
  syntheticScore: number;
  speakerMismatch: number;
  statusText: string;
}

interface RiskTrendTimelineChartProps {
  currentPlaybackTime?: number; // in seconds (e.g. 0.0 to 7.5)
  totalDuration?: number; // default 7.5s
  isClonedScenario?: boolean;
  historyData?: TimelineDataPoint[];
}

export const RiskTrendTimelineChart: React.FC<RiskTrendTimelineChartProps> = ({
  currentPlaybackTime = 0,
  totalDuration = 7.5,
  isClonedScenario = false,
  historyData = [],
}) => {
  const safePlaybackTime = typeof currentPlaybackTime === 'number' && !isNaN(currentPlaybackTime)
    ? currentPlaybackTime
    : 0;

  // Filter points that have occurred up to current playback time (strictly point-by-point, never future data!)
  const visiblePoints = (historyData || []).filter((p) => p.timeSec <= safePlaybackTime + 0.05);

  // If at t=0 and empty, make sure at least the initial zero-point is present
  const currentPoints = visiblePoints.length > 0 ? visiblePoints : [(historyData && historyData[0]) || {
    timeSec: 0,
    timeLabel: '0.0s',
    overallRisk: isClonedScenario ? 8 : 6,
    syntheticScore: isClonedScenario ? 5 : 4,
    speakerMismatch: isClonedScenario ? 12 : 5,
    statusText: 'Analyzing baseline...'
  }];

  const currentLatestPoint = currentPoints[currentPoints.length - 1] || {
    timeSec: 0,
    timeLabel: '0.0s',
    overallRisk: 0,
    syntheticScore: 0,
    speakerMismatch: 0,
    statusText: 'Standby'
  };

  // SVG dimensions
  const width = 640;
  const height = 180;
  const padding = { top: 20, right: 30, bottom: 28, left: 38 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  // Scale functions
  const getX = (t: number) => padding.left + (Math.min(t, totalDuration) / totalDuration) * graphWidth;
  const getY = (val: number) => padding.top + graphHeight - (Math.min(Math.max(val, 0), 100) / 100) * graphHeight;

  // Build SVG Path strings for visible points
  const buildPath = (accessor: (p: TimelineDataPoint) => number) => {
    if (currentPoints.length === 0) return '';
    return currentPoints
      .map((p, idx) => {
        const x = getX(p.timeSec);
        const y = getY(accessor(p));
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const buildAreaPath = (accessor: (p: TimelineDataPoint) => number) => {
    if (currentPoints.length === 0) return '';
    const linePart = currentPoints
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(p.timeSec).toFixed(1)} ${getY(accessor(p)).toFixed(1)}`)
      .join(' ');
    const lastX = getX(currentPoints[currentPoints.length - 1].timeSec).toFixed(1);
    const firstX = getX(currentPoints[0].timeSec).toFixed(1);
    const bottomY = (padding.top + graphHeight).toFixed(1);
    return `${linePart} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  };

  const riskLinePath = buildPath((p) => p.overallRisk);
  const riskAreaPath = buildAreaPath((p) => p.overallRisk);
  const speakerMismatchPath = buildPath((p) => p.speakerMismatch);
  const syntheticScorePath = buildPath((p) => p.syntheticScore);

  const currentCursorX = getX(currentPlaybackTime);
  const currentRiskY = getY(currentLatestPoint.overallRisk);

  return (
    <div 
      className="card-raised p-md space-y-md"
      title="Real-Time Risk Trajectory: Temporal progression of fused risk, vocoder distortion, and biometric mismatch without lookahead bias."
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[rgba(148,163,184,0.12)] pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#22D3EE]/10 text-[#22D3EE] border border-[#22D3EE]/30">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-white tracking-wider uppercase">
                Real-Time Risk Trajectory (Point-by-Point Ingestion)
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-[#05070B] text-[#22D3EE] border border-[#22D3EE]/30">
                LIVE STREAM
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              Synchronized acoustic and speaker biometric signals revealed incrementally over call duration
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 font-mono text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
            <span className="text-slate-300">Composite Risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" />
            <span className="text-slate-300">Speaker Mismatch</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#22D3EE]" />
            <span className="text-slate-300">Vocoder Score</span>
          </div>
        </div>
      </div>

      {/* Point-by-Point SVG Chart Container */}
      <div className="w-full relative overflow-hidden bg-[#05070B] rounded-lg border border-[rgba(148,163,184,0.12)] p-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            <linearGradient id="riskAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isClonedScenario ? '#EF4444' : '#10B981'} stopOpacity="0.35" />
              <stop offset="100%" stopColor={isClonedScenario ? '#EF4444' : '#10B981'} stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="riskLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="45%" stopColor="#F59E0B" />
              <stop offset="80%" stopColor="#EF4444" />
            </linearGradient>
            <filter id="chartGlow">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Zone Tiers */}
          {/* Critical Zone: 70% to 100% */}
          <rect
            x={padding.left}
            y={getY(100)}
            width={graphWidth}
            height={getY(70) - getY(100)}
            fill="#EF4444"
            fillOpacity="0.04"
          />
          {/* Elevated Zone: 30% to 70% */}
          <rect
            x={padding.left}
            y={getY(70)}
            width={graphWidth}
            height={getY(30) - getY(70)}
            fill="#F59E0B"
            fillOpacity="0.03"
          />
          {/* Safe Zone: 0% to 30% */}
          <rect
            x={padding.left}
            y={getY(30)}
            width={graphWidth}
            height={getY(0) - getY(30)}
            fill="#10B981"
            fillOpacity="0.02"
          />

          {/* Horizontal Grid lines & Axis values */}
          {[0, 30, 70, 100].map((val) => {
            const y = getY(val);
            let strokeColor = 'rgba(148, 163, 184, 0.12)';
            let labelColor = '#64748B';
            if (val === 70) {
              strokeColor = 'rgba(239, 68, 68, 0.35)';
              labelColor = '#EF4444';
            } else if (val === 30) {
              strokeColor = 'rgba(245, 158, 11, 0.3)';
              labelColor = '#F59E0B';
            }
            return (
              <g key={val}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + graphWidth}
                  y2={y}
                  stroke={strokeColor}
                  strokeWidth={val === 70 || val === 30 ? 1 : 0.8}
                  strokeDasharray={val === 70 || val === 30 ? '4 3' : undefined}
                />
                <text
                  x={padding.left - 6}
                  y={y + 3}
                  fill={labelColor}
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="end"
                  fontWeight="bold"
                >
                  {val}%
                </text>
              </g>
            );
          })}

          {/* Vertical Time Grid lines */}
          {[0, 1.5, 3.0, 4.5, 6.0, 7.5].map((t) => {
            const x = getX(t);
            return (
              <g key={t}>
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={padding.top + graphHeight}
                  stroke="rgba(148, 163, 184, 0.08)"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={padding.top + graphHeight + 16}
                  fill="#64748B"
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {t.toFixed(1)}s
                </text>
              </g>
            );
          })}

          {/* Area Fill for Overall Risk */}
          {riskAreaPath && (
            <path
              d={riskAreaPath}
              fill="url(#riskAreaGrad)"
            />
          )}

          {/* Secondary Series: Synthetic Vocoder Score (Cyan Dotted Line) */}
          {syntheticScorePath && (
            <path
              d={syntheticScorePath}
              fill="none"
              stroke="#22D3EE"
              strokeWidth="1.8"
              strokeDasharray="3 2"
              opacity="0.85"
            />
          )}

          {/* Secondary Series: Speaker Mismatch Score (Violet Line) */}
          {speakerMismatchPath && (
            <path
              d={speakerMismatchPath}
              fill="none"
              stroke="#8B5CF6"
              strokeWidth="2"
              opacity="0.9"
            />
          )}

          {/* Primary Series: Overall Composite Risk Line */}
          {riskLinePath && (
            <path
              d={riskLinePath}
              fill="none"
              stroke={isClonedScenario ? 'url(#riskLineGrad)' : '#10B981'}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: 'url(#chartGlow)' }}
            />
          )}

          {/* Render individual discrete data points drawn so far */}
          {currentPoints.map((pt, idx) => {
            const cx = getX(pt.timeSec);
            const cy = getY(pt.overallRisk);
            const isLatest = idx === currentPoints.length - 1;
            let pointColor = pt.overallRisk >= 70 ? '#EF4444' : pt.overallRisk >= 30 ? '#F59E0B' : '#10B981';

            return (
              <g key={idx}>
                {/* Speaker mismatch point marker */}
                {isClonedScenario && pt.timeSec >= 3.2 && (
                  <circle
                    cx={cx}
                    cy={getY(pt.speakerMismatch)}
                    r={3}
                    fill="#8B5CF6"
                    stroke="#FFFFFF"
                    strokeWidth="1"
                  />
                )}

                {/* Risk Point Dot */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isLatest ? 4.5 : 2.5}
                  fill={pointColor}
                  stroke="#0B1120"
                  strokeWidth={isLatest ? 2 : 1}
                />
              </g>
            );
          })}

          {/* Real-time Scanning Cursor Line */}
          <line
            x1={currentCursorX}
            y1={padding.top}
            x2={currentCursorX}
            y2={padding.top + graphHeight}
            stroke="#22D3EE"
            strokeWidth="1.5"
            strokeDasharray="2 2"
            opacity="0.85"
          />

          {/* Active Head Pulse & Tooltip */}
          <g transform={`translate(${currentCursorX}, ${currentRiskY})`}>
            <circle
              r="7"
              fill="none"
              stroke={isClonedScenario && currentLatestPoint.overallRisk >= 70 ? '#EF4444' : '#22D3EE'}
              strokeWidth="1.5"
              className="animate-ping opacity-75"
            />
            <circle
              r="4.5"
              fill={isClonedScenario && currentLatestPoint.overallRisk >= 70 ? '#EF4444' : '#22D3EE'}
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
          </g>

          {/* Live floating callout box on scanning head */}
          <g transform={`translate(${Math.min(currentCursorX, width - 110)}, ${Math.max(padding.top + 10, currentRiskY - 14)})`}>
            <rect
              x="-6"
              y="-18"
              width="100"
              height="22"
              rx="4"
              fill="#0B1120"
              stroke={isClonedScenario && currentLatestPoint.overallRisk >= 70 ? '#EF4444' : '#22D3EE'}
              strokeWidth="1"
              opacity="0.95"
            />
            <text
              x="44"
              y="-4"
              fill="#FFFFFF"
              fontSize="9"
              fontFamily="monospace"
              fontWeight="bold"
              textAnchor="middle"
            >
              T={safePlaybackTime.toFixed(1)}s · Risk: {Math.round(currentLatestPoint.overallRisk)}%
            </text>
          </g>
        </svg>
      </div>

      {/* Subtext info bar */}
      <div className="flex flex-wrap items-center justify-between text-[10px] font-mono text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
          <span>Safe: 0-30%</span>
          <span className="text-slate-600">|</span>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span>Elevated: 31-69%</span>
          <span className="text-slate-600">|</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
          <span>Critical: 70-100%</span>
        </div>

        <div className="text-[#22D3EE]">
          Latest Sample: {currentLatestPoint.statusText}
        </div>
      </div>
    </div>
  );
};
