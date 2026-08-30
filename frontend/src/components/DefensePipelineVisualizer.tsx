import React from 'react';
import { 
  Radio, 
  Activity, 
  Cpu, 
  Fingerprint, 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle,
  Zap, 
  CheckCircle2, 
  Clock, 
  ArrowRight,
  Sparkles
} from 'lucide-react';

export interface PipelineStageInfo {
  id: string;
  name: string;
  shortLabel: string;
  description: string;
  tooltip: string;
  latencyMs: number;
  status: 'idle' | 'processing' | 'passed' | 'warning' | 'mismatch' | 'critical';
  details: string;
  accentColor: string;
}

interface DefensePipelineVisualizerProps {
  currentPlaybackTime?: number; // in seconds (0.0 to 7.5)
  isClonedScenario?: boolean;
  speakerMismatchFired?: boolean;
  overallRisk?: number;
  speakerCosine?: number;
  activeStageIndex?: number;
  riskScore?: number;
  stageLatencyMs?: number[];
}

export const DefensePipelineVisualizer: React.FC<DefensePipelineVisualizerProps> = ({
  currentPlaybackTime,
  isClonedScenario = false,
  speakerMismatchFired = false,
  overallRisk,
  speakerCosine = 0.92,
  activeStageIndex,
  riskScore,
  stageLatencyMs = [3, 9, 14, 6, 4, 2],
}) => {
  // Normalize playback time and risk values from either prop interface
  const effectivePlaybackTime = typeof currentPlaybackTime === 'number' 
    ? currentPlaybackTime 
    : typeof activeStageIndex === 'number' 
    ? (activeStageIndex + 1) * 1.2 
    : 0;

  const effectiveRisk = typeof overallRisk === 'number' 
    ? overallRisk 
    : typeof riskScore === 'number' 
    ? riskScore 
    : 0;

  const safeSpeakerCosine = typeof speakerCosine === 'number' && !isNaN(speakerCosine) 
    ? speakerCosine 
    : 0.92;

  // Compute stage progression deterministically based on playback time
  // Stage 1: Ingest (0.0s -> 0.8s)
  // Stage 2: Spectral FFT (0.8s -> 2.2s)
  // Stage 3: Neural Vocoder Detection (2.2s -> 4.8s)
  // Stage 4: Speaker Biometric Verification (1.5s -> 3.4s) -> distinct violet mismatch!
  // Stage 5: Threat Scoring Engine (3.8s -> 5.8s)
  // Stage 6: Policy & SOC Enforcement (5.8s -> 7.5s)

  const stages: PipelineStageInfo[] = [
    {
      id: 'stage-1',
      name: 'PCM Audio Ingest',
      shortLabel: '1. Ingest',
      description: '16kHz / 40ms Jitter Buffer',
      tooltip: 'Audio Ingest: Buffers incoming SIP 16kHz PCM audio stream in 40ms ephemeral frames with zero disk persistence.',
      latencyMs: stageLatencyMs[0] ?? 3,
      status: effectivePlaybackTime < 0.2 ? 'idle' : effectivePlaybackTime < 0.8 ? 'processing' : 'passed',
      details: effectivePlaybackTime < 0.8 ? 'Buffering SIP frame...' : '16kHz Baseline Locked',
      accentColor: '#22D3EE',
    },
    {
      id: 'stage-2',
      name: 'Spectral FFT',
      shortLabel: '2. Spectral FFT',
      description: '128-D Log-Mel Energy',
      tooltip: 'Spectral FFT: Extracts 128-band Log-Mel spectrograms to detect high-frequency acoustic discontinuities.',
      latencyMs: stageLatencyMs[1] ?? 9,
      status: effectivePlaybackTime < 0.8 
        ? 'idle' 
        : effectivePlaybackTime < 2.0 
        ? 'processing' 
        : (isClonedScenario && effectivePlaybackTime >= 4.5) 
        ? 'warning' 
        : 'passed',
      details: effectivePlaybackTime < 0.8 
        ? 'Standby' 
        : effectivePlaybackTime < 2.0 
        ? 'Extracting Mel bands...' 
        : (isClonedScenario && effectivePlaybackTime >= 4.5) 
        ? 'Phase Jitter > 2.2kHz' 
        : 'Harmonic Decay Normal',
      accentColor: isClonedScenario && effectivePlaybackTime >= 4.5 ? '#F59E0B' : '#22D3EE',
    },
    {
      id: 'stage-3',
      name: 'Synthetic Vocoder Scan',
      shortLabel: '3. Vocoder Scan',
      description: 'Neural Artifact Detector',
      tooltip: 'Synthetic Vocoder Scan: Identifies neural vocoder fingerprints (HiFi-GAN, VITS, WaveGlow) in 2.2-4.2kHz spectrum.',
      latencyMs: stageLatencyMs[2] ?? 14,
      status: effectivePlaybackTime < 2.0 
        ? 'idle' 
        : effectivePlaybackTime < 4.8 
        ? 'processing' 
        : isClonedScenario 
        ? 'critical' 
        : 'passed',
      details: effectivePlaybackTime < 2.0 
        ? 'Standby' 
        : effectivePlaybackTime < 4.8 
        ? 'Scanning HiFi-GAN / VITS...' 
        : isClonedScenario 
        ? 'Neural Clone Artifact (98.6%)' 
        : 'Biological Tremor Verified',
      accentColor: isClonedScenario && effectivePlaybackTime >= 4.8 ? '#EF4444' : '#10B981',
    },
    {
      id: 'stage-4',
      name: 'Speaker Verification',
      shortLabel: '4. Voiceprint Cosine',
      description: 'Biometric Voiceprint Match',
      tooltip: 'Speaker Biometrics: Calculates cosine similarity between live speaker vector and enrolled genuine executive voiceprint.',
      latencyMs: stageLatencyMs[3] ?? 6,
      // In cloned scenario, at T >= 3.4s it flips to DISTINCT VIOLET MISMATCH!
      status: effectivePlaybackTime < 1.5 
        ? 'idle' 
        : effectivePlaybackTime < 3.4 
        ? 'processing' 
        : isClonedScenario 
        ? 'mismatch' // Special violet state!
        : 'passed',
      details: effectivePlaybackTime < 1.5 
        ? 'Standby' 
        : effectivePlaybackTime < 3.4 
        ? 'Cross-referencing enrolled ID...' 
        : isClonedScenario 
        ? `MISMATCH (Cosine ${safeSpeakerCosine.toFixed(2)})` 
        : `MATCH VERIFIED (Cosine ${safeSpeakerCosine.toFixed(2)})`,
      accentColor: isClonedScenario && effectivePlaybackTime >= 3.4 ? '#8B5CF6' : '#10B981',
    },
    {
      id: 'stage-5',
      name: 'Threat Scoring Engine',
      shortLabel: '5. Risk Matrix',
      description: 'Multi-Signal Fusion Score',
      tooltip: 'Threat Scoring Engine: Fuses spectral artifacts, prosody naturalness, pitch variance, and voiceprint cosine similarity.',
      latencyMs: stageLatencyMs[4] ?? 4,
      status: effectivePlaybackTime < 3.4 
        ? 'idle' 
        : effectivePlaybackTime < 5.6 
        ? 'processing' 
        : isClonedScenario 
        ? 'critical' 
        : 'passed',
      details: effectivePlaybackTime < 3.4 
        ? 'Standby' 
        : effectivePlaybackTime < 5.6 
        ? 'Evaluating risk vectors...' 
        : isClonedScenario 
        ? `Risk Score: ${Math.round(effectiveRisk)}/100 (CRITICAL)` 
        : `Risk Score: ${Math.round(effectiveRisk)}/100 (SAFE)`,
      accentColor: isClonedScenario && effectivePlaybackTime >= 5.6 ? '#EF4444' : '#10B981',
    },
    {
      id: 'stage-6',
      name: 'SOC Automated Policy',
      shortLabel: '6. Enforcement',
      description: 'Multi-Channel Dispatch',
      tooltip: 'Automated Policy Dispatch: Dispatches instant 2FA callback, wire freeze, SIEM syslog alert, and SIP call severance.',
      latencyMs: stageLatencyMs[5] ?? 2,
      status: effectivePlaybackTime < 5.6 
        ? 'idle' 
        : effectivePlaybackTime < 6.8 
        ? 'processing' 
        : isClonedScenario 
        ? 'critical' 
        : 'passed',
      details: effectivePlaybackTime < 5.6 
        ? 'Standby' 
        : effectivePlaybackTime < 6.8 
        ? 'Dispatching protocols...' 
        : isClonedScenario 
        ? 'SMS + Email + Wire Frozen' 
        : 'Call Allowed (Clear)',
      accentColor: isClonedScenario && effectivePlaybackTime >= 6.8 ? '#EF4444' : '#10B981',
    },
  ];

  return (
    <div className="card-raised p-md space-y-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[rgba(148,163,184,0.12)] pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#22D3EE]/10 text-[#22D3EE] border border-[#22D3EE]/30">
            <Cpu className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-white tracking-wider uppercase">
                Synchronized 6-Stage Defense Pipeline
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-[#05070B] text-slate-400 border border-slate-700">
                &lt;38ms End-to-End
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              Deterministic real-time execution · Stage 4 isolates biometrics independently from acoustic vocoder scan
            </p>
          </div>
        </div>

        {/* Global Pipeline Status Pill */}
        <div className="flex items-center gap-2 font-mono text-[10px]">
          {isClonedScenario && speakerMismatchFired ? (
            <span className="px-2 py-0.5 rounded bg-[#8B5CF6]/20 border border-[#8B5CF6]/50 text-[#C4B5FD] font-bold flex items-center gap-1.5 shadow-sm shadow-[#8B5CF6]/20 animate-pulse">
              <Fingerprint className="w-3 h-3 text-[#A855F7]" />
              SPEAKER MISMATCH SIGNAL ISOLATED
            </span>
          ) : isClonedScenario && overallRisk >= 70 ? (
            <span className="px-2 py-0.5 rounded bg-[#EF4444]/20 border border-[#EF4444]/50 text-[#FCA5A5] font-bold flex items-center gap-1.5 animate-pulse">
              <ShieldAlert className="w-3 h-3 text-[#EF4444]" />
              CRITICAL THREAT ACTIVE
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded bg-[#10B981]/15 border border-[#10B981]/40 text-[#6EE7B7] font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-[#10B981]" />
              PIPELINE OPERATIONAL
            </span>
          )}
        </div>
      </div>

      {/* 6-Stage Horizontal Interactive Flow */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {stages.map((stage, idx) => {
          const isProcessing = stage.status === 'processing';
          const isPassed = stage.status === 'passed';
          const isWarning = stage.status === 'warning';
          const isMismatch = stage.status === 'mismatch';
          const isCritical = stage.status === 'critical';
          const isIdle = stage.status === 'idle';

          // Base style classes
          let containerClasses = 'bg-[#05070B] border-[rgba(148,163,184,0.12)] text-slate-400';
          let statusBadgeClasses = 'bg-slate-800 text-slate-400 border-slate-700';
          let statusText = 'IDLE';

          if (isProcessing) {
            containerClasses = 'bg-[#05070B] border-[#22D3EE]/60 text-white shadow-md shadow-[#22D3EE]/10 ring-1 ring-[#22D3EE]/30';
            statusBadgeClasses = 'bg-[#22D3EE]/20 text-[#22D3EE] border-[#22D3EE]/40 animate-pulse';
            statusText = 'PROCESSING';
          } else if (isMismatch) {
            // Distinct Violet for Speaker Biometric Mismatch!
            containerClasses = 'bg-[#1E112A] border-[#8B5CF6]/70 text-[#E9D5FF] shadow-lg shadow-[#8B5CF6]/25 ring-1 ring-[#8B5CF6]/50 animate-pulse-subtle';
            statusBadgeClasses = 'bg-[#8B5CF6] text-white border-[#8B5CF6] font-bold';
            statusText = 'MISMATCH DETECTED';
          } else if (isCritical) {
            containerClasses = 'bg-[#2A0F13] border-[#EF4444]/70 text-[#FCA5A5] shadow-lg shadow-[#EF4444]/25 ring-1 ring-[#EF4444]/50 animate-pulse-subtle';
            statusBadgeClasses = 'bg-[#EF4444] text-white border-[#EF4444] font-bold';
            statusText = 'ALERT EXECUTED';
          } else if (isWarning) {
            containerClasses = 'bg-[#1F1707] border-amber-500/50 text-amber-200 shadow-md shadow-amber-500/10';
            statusBadgeClasses = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
            statusText = 'ANOMALY';
          } else if (isPassed) {
            containerClasses = 'bg-[#061A14] border-[#10B981]/40 text-slate-200';
            statusBadgeClasses = 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/40';
            statusText = 'VERIFIED';
          }

          return (
            <div
              key={stage.id}
              title={stage.tooltip}
              className={`p-3 rounded-lg border flex flex-col justify-between gap-2 transition-all duration-300 relative overflow-hidden cursor-help ${containerClasses}`}
            >
              {/* Active top glow indicator */}
              {(isProcessing || isMismatch || isCritical || isPassed) && (
                <div 
                  className="absolute top-0 left-0 right-0 h-0.5"
                  style={{
                    backgroundColor: isMismatch ? '#8B5CF6' : isCritical ? '#EF4444' : isWarning ? '#F59E0B' : '#10B981'
                  }}
                />
              )}

              <div>
                {/* Stage Number & Latency */}
                <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                  <span className="text-slate-400 font-semibold">{stage.shortLabel}</span>
                  <span className="text-slate-400 text-[9px] flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5 text-slate-400" />
                    {stage.latencyMs}ms
                  </span>
                </div>

                {/* Stage Title */}
                <div className="text-xs font-bold font-mono tracking-tight leading-snug">
                  {stage.name}
                </div>
              </div>

              {/* Status Badge & Dynamic Detail */}
              <div className="space-y-1.5 pt-1 border-t border-[rgba(148,163,184,0.08)]">
                <div className="flex items-center justify-between">
                  <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded border tracking-wider font-bold ${statusBadgeClasses}`}>
                    {statusText}
                  </span>
                  {isMismatch && (
                    <Fingerprint className="w-3 h-3 text-[#A855F7] animate-bounce" />
                  )}
                  {isCritical && (
                    <ShieldAlert className="w-3 h-3 text-[#EF4444]" />
                  )}
                  {isPassed && (
                    <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
                  )}
                </div>

                <div 
                  className={`text-[10px] font-mono leading-tight truncate ${
                    isMismatch ? 'text-[#C4B5FD] font-bold' : isCritical ? 'text-rose-300 font-semibold' : 'text-slate-400'
                  }`}
                  title={stage.details}
                >
                  {stage.details}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
