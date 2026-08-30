import React, { useEffect, useRef, useState } from 'react';
import { Radio, AlertOctagon, Activity, Sparkles, CheckCircle2, ShieldAlert } from 'lucide-react';

interface DualWaveformVisualizerProps {
  intensity?: number;
  riskScore?: number;
  anomalyBand?: [number, number];
  isCallActive?: boolean;
  sampleRate?: number;
  latencyMs?: number;
  enrolledSpeakerName?: string;
  enrolledId?: string;
}

export const DualWaveformVisualizer: React.FC<DualWaveformVisualizerProps> = ({
  intensity = 0.6,
  riskScore = 15,
  anomalyBand,
  isCallActive = true,
  sampleRate = 16000,
  latencyMs = 36,
  enrolledSpeakerName = 'Rajesh Mehta (CFO)',
  enrolledId = 'VP-IND-MUM-88412',
}) => {
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const enrolledCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viewMode, setViewMode] = useState<'spectrogram' | 'oscilloscope'>('spectrogram');

  useEffect(() => {
    let animationFrameId: number;
    const liveCanvas = liveCanvasRef.current;
    const enrolledCanvas = enrolledCanvasRef.current;
    if (!liveCanvas || !enrolledCanvas) return;

    const liveCtx = liveCanvas.getContext('2d');
    const enrolledCtx = enrolledCanvas.getContext('2d');
    if (!liveCtx || !enrolledCtx) return;

    let phase = 0;
    const barCount = 44;

    const render = () => {
      const w = liveCanvas.width;
      const h = liveCanvas.height;

      liveCtx.clearRect(0, 0, w, h);
      enrolledCtx.clearRect(0, 0, w, h);

      // Grid background on both
      [liveCtx, enrolledCtx].forEach((ctx) => {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
        ctx.lineWidth = 1;
        for (let y = 10; y < h; y += 14) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
      });

      if (!isCallActive) {
        [liveCtx, enrolledCtx].forEach((ctx) => {
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, h / 2);
          ctx.lineTo(w, h / 2);
          ctx.stroke();
        });
        return;
      }

      phase += 0.08;

      if (viewMode === 'spectrogram') {
        const barWidth = (w / barCount) - 2;

        // Render Live Stream (Top Canvas)
        for (let i = 0; i < barCount; i++) {
          const x = i * (barWidth + 2);
          const freqHz = (i / barCount) * 8000;
          const isAnomaly = anomalyBand && freqHz >= anomalyBand[0] && freqHz <= anomalyBand[1] && riskScore >= 50;

          // Synthetic speech has unnatural energy spikes in vocoder range & robotic pitch flatline
          const baseWave = Math.sin(phase + i * 0.28) * 0.4 + Math.cos(phase * 0.8 + i * 0.15) * 0.3;
          const noise = Math.sin((phase * 2) + i * 1.7) * 0.25;
          let amp = Math.abs(baseWave + noise) * intensity;
          if (isAnomaly) {
            amp = Math.min(1.0, amp * 1.85 + 0.35);
          }

          const barHeight = Math.max(3, amp * (h - 10));
          const y = h - barHeight - 2;

          const liveGradient = liveCtx.createLinearGradient(0, h, 0, 0);
          if (isAnomaly) {
            liveGradient.addColorStop(0, '#EF4444');
            liveGradient.addColorStop(0.6, '#F87171');
            liveGradient.addColorStop(1, '#FCA5A5');
          } else if (riskScore >= 66) {
            liveGradient.addColorStop(0, '#DC2626');
            liveGradient.addColorStop(1, '#FB7185');
          } else if (riskScore >= 31) {
            liveGradient.addColorStop(0, '#D97706');
            liveGradient.addColorStop(1, '#FCD34D');
          } else {
            liveGradient.addColorStop(0, '#0E7490');
            liveGradient.addColorStop(0.5, '#22D3EE');
            liveGradient.addColorStop(1, '#2DD4BF');
          }

          liveCtx.fillStyle = liveGradient;
          liveCtx.beginPath();
          liveCtx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
          liveCtx.fill();

          if (isAnomaly && amp > 0.4) {
            liveCtx.fillStyle = '#FFFFFF';
            liveCtx.fillRect(x + (barWidth / 2) - 1, y - 3, 2, 2);
          }
        }

        // Render Enrolled Reference Profile (Bottom Canvas)
        for (let i = 0; i < barCount; i++) {
          const x = i * (barWidth + 2);
          // Biological vocal tract has harmonic resonant peaks (F1, F2, F3) with smooth decay
          const formant1 = Math.exp(-Math.pow(i - 8, 2) / 12) * 0.9;
          const formant2 = Math.exp(-Math.pow(i - 18, 2) / 16) * 0.75;
          const formant3 = Math.exp(-Math.pow(i - 28, 2) / 20) * 0.55;
          const organicTremor = Math.sin(phase * 0.6 + i * 0.2) * 0.15;
          const amp = Math.min(1.0, (formant1 + formant2 + formant3 + organicTremor) * 0.75);

          const barHeight = Math.max(3, amp * (h - 10));
          const y = h - barHeight - 2;

          const refGradient = enrolledCtx.createLinearGradient(0, h, 0, 0);
          refGradient.addColorStop(0, '#064E3B');
          refGradient.addColorStop(0.5, '#10B981');
          refGradient.addColorStop(1, '#34D399');

          enrolledCtx.fillStyle = refGradient;
          enrolledCtx.beginPath();
          enrolledCtx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
          enrolledCtx.fill();

          if (amp > 0.6) {
            enrolledCtx.fillStyle = '#6EE7B7';
            enrolledCtx.fillRect(x + (barWidth / 2) - 1, y - 2, 2, 2);
          }
        }
      } else {
        // Time-Domain Oscilloscope
        // Live
        liveCtx.beginPath();
        liveCtx.lineWidth = 2;
        liveCtx.strokeStyle = riskScore >= 66 ? '#EF4444' : riskScore >= 31 ? '#F59E0B' : '#22D3EE';
        for (let x = 0; x < w; x++) {
          const normX = x / w;
          const wave1 = Math.sin(normX * 24 + phase * 2) * (h * 0.25 * intensity);
          const wave2 = Math.sin(normX * 48 - phase) * (h * 0.12 * intensity);
          const glitch = (riskScore >= 66 && x % 14 === 0) ? (Math.random() - 0.5) * 18 : 0;
          const y = h / 2 + wave1 + wave2 + glitch;
          if (x === 0) liveCtx.moveTo(x, y);
          else liveCtx.lineTo(x, y);
        }
        liveCtx.stroke();

        // Enrolled
        enrolledCtx.beginPath();
        enrolledCtx.lineWidth = 2;
        enrolledCtx.strokeStyle = '#10B981';
        for (let x = 0; x < w; x++) {
          const normX = x / w;
          const wave1 = Math.sin(normX * 18 + phase * 1.2) * (h * 0.28 * 0.7);
          const wave2 = Math.cos(normX * 36 - phase * 0.8) * (h * 0.1 * 0.7);
          const y = h / 2 + wave1 + wave2;
          if (x === 0) enrolledCtx.moveTo(x, y);
          else enrolledCtx.lineTo(x, y);
        }
        enrolledCtx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [intensity, riskScore, anomalyBand, isCallActive, viewMode]);

  return (
    <div 
      className="w-full console-panel p-4 flex flex-col gap-3"
      title="Dual Spectrogram Analyzer: Live Ingest vs Enrolled Reference Voiceprint with real-time acoustic anomaly band highlighting."
    >
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgba(148,163,184,0.12)] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${riskScore >= 66 ? 'bg-[#EF4444]' : 'bg-[#22D3EE]'}`}></span>
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${riskScore >= 66 ? 'bg-[#EF4444]' : 'bg-[#22D3EE]'}`}></span>
          </span>
          <span className="font-mono text-xs font-bold text-white tracking-wider uppercase">
            Dual Spectrogram: Live Ingest vs Enrolled Baseline
          </span>
        </div>

        <div className="flex items-center gap-2">
          {anomalyBand && riskScore >= 50 && (
            <span 
              className="inline-flex items-center gap-1 text-[10px] font-bold text-[#EF4444] bg-[#EF4444]/15 border border-[#EF4444]/35 px-2 py-0.5 rounded font-mono uppercase tracking-wider animate-pulse cursor-help"
              title="Acoustic Discontinuity: Neural vocoder high-frequency synthesis artifact isolated between 2.2kHz and 4.2kHz."
            >
              <AlertOctagon className="w-3 h-3" />
              Artifact: {anomalyBand[0]}Hz - {anomalyBand[1]}Hz
            </span>
          )}

          <span 
            className="font-mono text-[10px] text-slate-400 bg-[#05070B] px-2 py-0.5 rounded border border-[rgba(148,163,184,0.12)] cursor-help"
            title="Sampling Rate: Standard 16kHz telephony audio ingested in 40ms sliding windows for zero-latency detection."
          >
            FFT Frame: <strong className="text-[#22D3EE]">40ms ({sampleRate / 1000}kHz)</strong>
          </span>

          {/* Mode switch */}
          <div className="flex bg-[#05070B] border border-[rgba(148,163,184,0.12)] rounded p-0.5 text-[10px] font-mono">
            <button
              onClick={() => setViewMode('spectrogram')}
              title="Switch to Mel-Frequency Spectrogram Bar View"
              className={`px-2 py-0.5 rounded transition-colors uppercase font-bold cursor-pointer ${
                viewMode === 'spectrogram' ? 'bg-[#22D3EE] text-[#05070B]' : 'text-slate-400 hover:text-white'
              }`}
            >
              FFT Bars
            </button>
            <button
              onClick={() => setViewMode('oscilloscope')}
              title="Switch to Real-Time Oscilloscope Waveform View"
              className={`px-2 py-0.5 rounded transition-colors uppercase font-bold cursor-pointer ${
                viewMode === 'oscilloscope' ? 'bg-[#22D3EE] text-[#05070B]' : 'text-slate-400 hover:text-white'
              }`}
            >
              Waveform
            </button>
          </div>
        </div>
      </div>

      {/* Dual Waveform Stack */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Stream 1: Live Incoming Audio */}
        <div 
          className="flex flex-col gap-1.5 bg-[#05070B] p-2.5 rounded-lg border border-[rgba(148,163,184,0.12)]"
          title="Live Call Audio: Real-time frequency spectrum of active inbound voice stream."
        >
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <Radio className="w-3.5 h-3.5 text-[#22D3EE] animate-pulse" />
              Live Inbound Call Audio Stream
            </span>
            {riskScore >= 66 ? (
              <span className="text-[#EF4444] font-bold text-[10px] flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" /> CLONE ANOMALIES
              </span>
            ) : (
              <span className="text-[#10B981] font-bold text-[10px]">
                NATURAL ACOUSTICS
              </span>
            )}
          </div>
          
          <div className="relative w-full h-20 bg-[#080D1A] rounded overflow-hidden border border-[rgba(148,163,184,0.08)]">
            <canvas
              ref={liveCanvasRef}
              width={400}
              height={80}
              className="w-full h-full object-cover"
            />
            {/* Anomaly zone marker */}
            {anomalyBand && riskScore >= 50 && (
              <div 
                className="absolute top-0 bottom-0 bg-[#EF4444]/20 border-x border-[#EF4444]/50 pointer-events-none"
                style={{ left: '28%', width: '38%' }}
              >
                <span className="absolute top-1 left-1 text-[8px] font-mono text-[#EF4444] font-bold uppercase bg-[#05070B]/80 px-1 rounded">
                  Vocoder Cutoff Phase Jitter
                </span>
              </div>
            )}
          </div>
          <div className="flex justify-between text-[9px] font-mono text-slate-500">
            <span>0 Hz</span>
            <span>2.5 kHz (Pitch Formants)</span>
            <span>4 kHz</span>
            <span>8 kHz (Nyquist)</span>
          </div>
        </div>

        {/* Stream 2: Enrolled Genuine Reference Voiceprint */}
        <div className="flex flex-col gap-1.5 bg-[#05070B] p-2.5 rounded-lg border border-[rgba(148,163,184,0.12)]">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
              Enrolled Voiceprint: {enrolledSpeakerName}
            </span>
            <span className="text-[#10B981] font-mono text-[10px] font-bold">
              ID: {enrolledId}
            </span>
          </div>

          <div className="relative w-full h-20 bg-[#080D1A] rounded overflow-hidden border border-[rgba(148,163,184,0.08)]">
            <canvas
              ref={enrolledCanvasRef}
              width={400}
              height={80}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex justify-between text-[9px] font-mono text-slate-500">
            <span>F1: 720 Hz</span>
            <span>F2: 1840 Hz</span>
            <span>F3: 2750 Hz (Vocal Tract Baseline)</span>
            <span>Biometric: 128D</span>
          </div>
        </div>
      </div>
    </div>
  );
};
