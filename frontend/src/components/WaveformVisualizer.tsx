import React, { useEffect, useRef, useState } from 'react';
import { Activity, Radio, AlertOctagon, Volume2, VolumeX, Sparkles } from 'lucide-react';

interface WaveformVisualizerProps {
  intensity?: number; // 0.1 to 1.0
  riskScore?: number;
  anomalyBand?: [number, number]; // e.g. [2200, 4100]
  isCallActive?: boolean;
  sampleRate?: number;
  latencyMs?: number;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  intensity = 0.5,
  riskScore = 15,
  anomalyBand,
  isCallActive = true,
  sampleRate = 16000,
  latencyMs = 36,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viewMode, setViewMode] = useState<'spectrogram' | 'oscilloscope'>('spectrogram');
  const [audioFeedbackEnabled, setAudioFeedbackEnabled] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Sound generator toggle for live judge demo experience
  const toggleAudioSim = () => {
    if (!audioFeedbackEnabled) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          audioContextRef.current = ctx;
          // Create subtle hum and synthetic blips if high risk
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = riskScore > 70 ? 'sawtooth' : 'sine';
          osc.frequency.setValueAtTime(riskScore > 70 ? 440 : 220, ctx.currentTime);
          gain.gain.setValueAtTime(0.02, ctx.currentTime);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          setTimeout(() => {
            try { osc.stop(); } catch(e){}
          }, 800);
        }
      } catch {
        // Audio Context blocked or unavailable in frame
      }
      setAudioFeedbackEnabled(true);
    } else {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      setAudioFeedbackEnabled(false);
    }
  };

  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;
    const barCount = 48;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Background subtle grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (let y = 10; y < height; y += 15) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (!isCallActive) {
        // Flatline idle state
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        return;
      }

      phase += 0.08;

      if (viewMode === 'spectrogram') {
        const barWidth = (width / barCount) - 2;

        for (let i = 0; i < barCount; i++) {
          const x = i * (barWidth + 2);
          const freqHz = (i / barCount) * 8000;
          const isAnomaly = anomalyBand && freqHz >= anomalyBand[0] && freqHz <= anomalyBand[1] && riskScore >= 50;

          // Frequency amplitude formula
          const baseWave = Math.sin(phase + i * 0.28) * 0.4 + Math.cos(phase * 0.8 + i * 0.15) * 0.3;
          const noise = Math.sin((phase * 2) + i * 1.7) * 0.25;
          let amp = Math.abs(baseWave + noise) * intensity;
          
          if (isAnomaly) {
            // Unnatural synthetic energy spike in artifact band
            amp = Math.min(1.0, amp * 1.8 + 0.35);
          }

          const barHeight = Math.max(4, amp * (height - 12));
          const y = height - barHeight - 4;

          // Gradient color depending on risk and anomaly
          const gradient = ctx.createLinearGradient(0, height, 0, 0);
          if (isAnomaly) {
            gradient.addColorStop(0, '#EF4444');
            gradient.addColorStop(0.6, '#F87171');
            gradient.addColorStop(1, '#FCA5A5');
          } else if (riskScore >= 70) {
            gradient.addColorStop(0, '#DC2626');
            gradient.addColorStop(1, '#FB7185');
          } else if (riskScore >= 40) {
            gradient.addColorStop(0, '#D97706');
            gradient.addColorStop(1, '#FCD34D');
          } else {
            gradient.addColorStop(0, '#1D4ED8');
            gradient.addColorStop(0.5, '#2E7DFF');
            gradient.addColorStop(1, '#3AC1FF');
          }

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
          ctx.fill();

          // Peak dots on top
          if (amp > 0.4) {
            ctx.fillStyle = isAnomaly ? '#FFFFFF' : '#60A5FA';
            ctx.fillRect(x + (barWidth / 2) - 1, y - 2, 2, 2);
          }
        }
      } else {
        // Oscilloscope / Real-Time Waveform line
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = riskScore >= 70 ? '#EF4444' : riskScore >= 40 ? '#F59E0B' : '#3AC1FF';

        for (let x = 0; x < width; x++) {
          const normX = x / width;
          const wave1 = Math.sin(normX * 24 + phase * 2) * (height * 0.22 * intensity);
          const wave2 = Math.sin(normX * 48 - phase) * (height * 0.12 * intensity);
          const glitch = (riskScore >= 70 && x % 16 === 0) ? (Math.random() - 0.5) * 16 : 0;
          const y = height / 2 + wave1 + wave2 + glitch;

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [intensity, riskScore, anomalyBand, isCallActive, viewMode]);

  return (
    <div className="w-full bg-[#131A2A] border border-[#1F2937] rounded-xl p-3.5 flex flex-col gap-2.5 shadow-inner">
      {/* Header bar */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${riskScore >= 70 ? 'bg-[#EF4444]' : 'bg-[#22C55E]'}`}></span>
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${riskScore >= 70 ? 'bg-[#EF4444] shadow-[0_0_8px_#EF4444]' : 'bg-[#22C55E] shadow-[0_0_8px_#22C55E]'}`}></span>
          </span>
          <span className="font-semibold text-[#E2E8F0] flex items-center gap-1.5 font-mono text-[11px]">
            <Radio className="w-3.5 h-3.5 text-[#2E7DFF] animate-pulse" />
            Live Ingest Stream · {sampleRate / 1000} kHz PCM
          </span>
        </div>

        <div className="flex items-center gap-2">
          {anomalyBand && riskScore >= 50 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/30 px-2 py-0.5 rounded font-mono uppercase tracking-wider animate-pulse">
              <AlertOctagon className="w-3 h-3" />
              Artifact: {anomalyBand[0]}Hz - {anomalyBand[1]}Hz
            </span>
          )}

          <span className="font-mono text-[11px] text-slate-400 bg-[#0A0E17] px-2 py-0.5 rounded border border-[#1F2937]">
            Latency: <strong className="text-[#22C55E]">{latencyMs}ms</strong>
          </span>

          {/* Mode switch */}
          <div className="flex bg-[#0A0E17] border border-[#1F2937] rounded p-0.5 text-[10px] font-mono">
            <button
              onClick={() => setViewMode('spectrogram')}
              className={`px-1.5 py-0.5 rounded transition-colors uppercase font-bold ${viewMode === 'spectrogram' ? 'bg-[#2E7DFF] text-white' : 'text-slate-400 hover:text-slate-200'}`}
              title="FFT Frequency Spectrogram"
            >
              FFT Bars
            </button>
            <button
              onClick={() => setViewMode('oscilloscope')}
              className={`px-1.5 py-0.5 rounded transition-colors uppercase font-bold ${viewMode === 'oscilloscope' ? 'bg-[#2E7DFF] text-white' : 'text-slate-400 hover:text-slate-200'}`}
              title="Time-Domain Oscilloscope Waveform"
            >
              Waveform
            </button>
          </div>
        </div>
      </div>

      {/* Canvas container */}
      <div className="relative w-full h-20 bg-[#0A0E17] rounded-lg overflow-hidden border border-[#1F2937] flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={480}
          height={80}
          className="w-full h-full object-cover"
        />

        {/* Frequency scale markers */}
        <div className="absolute bottom-1 left-2 right-2 flex justify-between text-[9px] font-mono text-slate-500 pointer-events-none uppercase">
          <span>100 Hz</span>
          <span>1 kHz</span>
          <span className={anomalyBand && riskScore >= 50 ? 'text-[#EF4444] font-bold' : ''}>2.5 kHz (Vocoder Zone)</span>
          <span>4 kHz</span>
          <span>8 kHz</span>
        </div>
      </div>
    </div>
  );
};
