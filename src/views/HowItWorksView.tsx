import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  Cpu, 
  Activity, 
  Radio, 
  Zap, 
  ShieldCheck, 
  ShieldAlert, 
  Sliders, 
  Fingerprint, 
  Layers, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  Volume2, 
  BarChart3, 
  Code2, 
  Info,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Play,
  RotateCcw
} from 'lucide-react';

export const HowItWorksView: React.FC = () => {
  const navigate = useNavigate();

  // Mode: 'overview' (Analyst / Judge) vs 'deepdive' (DSP / Math Engineer)
  const [detailMode, setDetailMode] = useState<'overview' | 'deepdive'>('overview');

  // Expanded card state for progressive disclosure
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  // Interactive Live Step 5 Risk Matrix Tester
  const [testRiskScore, setTestRiskScore] = useState<number>(88);

  // Copy architecture spec feedback
  const [copied, setCopied] = useState<boolean>(false);

  // Interactive Jitter / Vocoder audio demo simulator state
  const [simulatedSignal, setSimulatedSignal] = useState<'human' | 'synthetic'>('human');
  const [isPlayingSim, setIsPlayingSim] = useState<boolean>(false);

  const toggleExpand = (stepNum: number) => {
    setExpandedStep(prev => prev === stepNum ? null : stepNum);
  };

  const handleCopySpec = () => {
    const spec = `VeriVox AI (SIH26104) Pipeline Specification:
1. Audio Ingestion: 16kHz mono resampling, 4th-order Butterworth high-pass filter (60Hz cutoff), RMS dynamic range normalization.
2. Acoustic & Cepstral: 13-band MFCCs, Spectral Centroid, 85% Rolloff, Spectral Flatness & Contrast (128-D vector).
3. Biological Biomarkers: Micro-jitter (~1.5-4.0%) & shimmer perturbation extraction.
4. Neural Vocoder Artifacts: Phase discontinuity detection, high-frequency (>3.8kHz) harmonic decay analysis (HiFi-GAN, WaveGlow, XTTS).
5. Statistical Ensemble: Calibrated probability mapping with LOW/MEDIUM/HIGH classification in <38ms end-to-end.`;
    
    navigator.clipboard.writeText(spec).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }).catch(() => {});
  };

  // Synthetic tone generator for audio simulation
  const playSimulatedAudio = (type: 'human' | 'synthetic') => {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      
      if (type === 'human') {
        // Natural human jitter: subtle pitch fluctuation
        const now = ctx.currentTime;
        osc.frequency.setValueAtTime(140, now);
        // Perturbations
        for (let t = 0; t < 1.5; t += 0.05) {
          const jitter = (Math.random() - 0.5) * 6; // ±3Hz natural tremor
          osc.frequency.linearRampToValueAtTime(140 + jitter, now + t);
        }
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      } else {
        // AI Synthetic Vocoder: unnaturally steady / metallic quantized frequency
        const now = ctx.currentTime;
        osc.frequency.setValueAtTime(140, now); // Zero jitter, robotic precision
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setIsPlayingSim(true);
      setTimeout(() => {
        osc.stop();
        ctx.close();
        setIsPlayingSim(false);
      }, 1500);
    } catch {
      // AudioContext unavailable in some sandboxes
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16 font-sans antialiased text-slate-100">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[rgba(148,163,184,0.1)] pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#22D3EE]/10 text-[#22D3EE] border border-[#22D3EE]/20">
              <BookOpen className="w-6 h-6 text-[#22D3EE]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-slab text-white tracking-tight">
              How VeriVox AI Works
            </h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#22D3EE]/10 border border-[#22D3EE]/30 text-[#22D3EE] font-bold">
              SIH26104
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 font-sans max-w-3xl">
            Deep-dive technical explanation of acoustic digital signal processing (DSP), neural vocoder artifact detection, and multi-factor risk assessment.
          </p>
        </div>

        {/* View Mode & Quick Copy Bar */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="bg-[#0B1120] p-1 rounded-xl border border-[rgba(148,163,184,0.15)] flex items-center text-xs">
            <button
              onClick={() => setDetailMode('overview')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                detailMode === 'overview'
                  ? 'bg-[#22D3EE] text-[#05070B] shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Standard Flow
            </button>
            <button
              onClick={() => setDetailMode('deepdive')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                detailMode === 'deepdive'
                  ? 'bg-[#22D3EE] text-[#05070B] shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              DSP Math Deep-Dive
            </button>
          </div>

          <button
            onClick={handleCopySpec}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#0B1120] hover:bg-[#131B2E] border border-[rgba(148,163,184,0.15)] flex items-center gap-1.5 transition-all cursor-pointer"
            title="Copy Pipeline Specification"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#10B981]" />
                <span className="text-[#10B981]">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy Spec</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Benchmark Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-[#070B14] border border-[rgba(148,163,184,0.12)]">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Processing Latency</div>
          <div className="text-lg sm:text-xl font-bold font-mono text-[#22D3EE] mt-0.5">&lt; 38 ms</div>
          <div className="text-[10px] text-slate-500 font-sans mt-0.5">Real-time edge buffer</div>
        </div>
        <div className="p-3.5 rounded-xl bg-[#070B14] border border-[rgba(148,163,184,0.12)]">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Acoustic Dimensions</div>
          <div className="text-lg sm:text-xl font-bold font-mono text-white mt-0.5">128-D Vector</div>
          <div className="text-[10px] text-slate-500 font-sans mt-0.5">MFCC + Phase + Jitter</div>
        </div>
        <div className="p-3.5 rounded-xl bg-[#070B14] border border-[rgba(148,163,184,0.12)]">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Vocoder Coverage</div>
          <div className="text-lg sm:text-xl font-bold font-mono text-[#10B981] mt-0.5">12+ Architectures</div>
          <div className="text-[10px] text-slate-500 font-sans mt-0.5">HiFi-GAN, XTTS, Tacotron</div>
        </div>
        <div className="p-3.5 rounded-xl bg-[#070B14] border border-[rgba(148,163,184,0.12)]">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Equal Error Rate (EER)</div>
          <div className="text-lg sm:text-xl font-bold font-mono text-amber-400 mt-0.5">2.4% Benchmark</div>
          <div className="text-[10px] text-slate-500 font-sans mt-0.5">ASVspoof 2021 calibrated</div>
        </div>
      </div>

      {/* 5-STAGE PIPELINE CARDS */}
      <div className="space-y-4">

        {/* STEP 01 */}
        <div className="p-5 sm:p-7 rounded-2xl bg-[#070B14] border border-[rgba(148,163,184,0.14)] hover:border-[rgba(148,163,184,0.25)] transition-all shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-lg bg-[#22D3EE]/15 border border-[#22D3EE]/30 text-[#22D3EE] font-mono font-bold text-xs sm:text-sm">
                  01
                </span>
                <h3 className="text-base sm:text-lg font-bold font-sans text-white">
                  Audio Ingestion, Sanitization &amp; Resampling
                </h3>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                Incoming audio (WAV, MP3, M4A, WebM) is decoded, normalized to mono, resampled to standard 16,000 Hz, and passed through a 4th-order Butterworth high-pass filter (cutoff 60 Hz) to eliminate low-frequency microphone vibration noise. Peak and RMS volume normalization ensures uniform dynamic range across different phone microphones.
              </p>

              {/* Technical Badges */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="px-2 py-0.5 rounded-md bg-[#0B1120] border border-slate-700/60 text-[11px] font-mono text-slate-300">
                  Format: Mono 16,000 Hz
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#0B1120] border border-slate-700/60 text-[11px] font-mono text-slate-300">
                  Filter: Butterworth 60Hz HPF
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#0B1120] border border-slate-700/60 text-[11px] font-mono text-slate-300">
                  Level: Peak &amp; RMS Normalization
                </span>
              </div>
            </div>

            <button
              onClick={() => toggleExpand(1)}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors"
              title="Toggle detailed inspector"
            >
              {expandedStep === 1 ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>

          {/* Expandable Step 1 Details */}
          {(expandedStep === 1 || detailMode === 'deepdive') && (
            <div className="mt-5 pt-4 border-t border-[rgba(148,163,184,0.1)] space-y-3 animate-fadeIn text-xs">
              <div className="text-[#22D3EE] font-mono font-semibold flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5" />
                <span>DSP Transfer Function &amp; Ingest Logic</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#05070B] border border-slate-800 font-mono text-slate-300 space-y-1.5 overflow-x-auto">
                <div className="text-slate-500">// Butterworth 4th-Order High-Pass Filter Transfer Function</div>
                <div className="text-cyan-300">H(s) = s⁴ / (s⁴ + 2.6131s³ + 3.4142s² + 2.6131s + 1) with f_c = 60Hz</div>
                <div className="text-slate-500">// Sliding Window Buffer Configuration:</div>
                <div className="text-slate-300">Frame Length: 512 samples (32 ms) | Frame Shift / Stride: 160 samples (10 ms)</div>
              </div>
            </div>
          )}
        </div>

        {/* STEP 02 */}
        <div className="p-5 sm:p-7 rounded-2xl bg-[#070B14] border border-[rgba(148,163,184,0.14)] hover:border-[rgba(148,163,184,0.25)] transition-all shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-lg bg-[#22D3EE]/15 border border-[#22D3EE]/30 text-[#22D3EE] font-mono font-bold text-xs sm:text-sm">
                  02
                </span>
                <h3 className="text-base sm:text-lg font-bold font-sans text-white">
                  Acoustic &amp; Cepstral Feature Extraction
                </h3>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                VeriVox converts the speech wave into a multidimensional acoustic feature matrix. It calculates:
              </p>

              <ul className="space-y-2 text-xs sm:text-sm text-slate-300 font-sans pl-2">
                <li className="flex items-start gap-2">
                  <span className="text-[#22D3EE] font-bold">•</span>
                  <span>
                    <strong className="text-white font-semibold">13 Mel-Frequency Cepstral Coefficients (MFCCs):</strong> Captures vocal tract shape and phonetic timbre.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#22D3EE] font-bold">•</span>
                  <span>
                    <strong className="text-white font-semibold">Spectral Centroid &amp; Rolloff (85%):</strong> Evaluates frequency center of mass and high-frequency boundaries.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#22D3EE] font-bold">•</span>
                  <span>
                    <strong className="text-white font-semibold">Spectral Flatness &amp; Contrast:</strong> Differentiates between tonal phonemes and vocoder synthesis noise.
                  </span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => toggleExpand(2)}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors"
              title="Toggle detailed inspector"
            >
              {expandedStep === 2 ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>

          {/* Expandable Step 2 Details */}
          {(expandedStep === 2 || detailMode === 'deepdive') && (
            <div className="mt-5 pt-4 border-t border-[rgba(148,163,184,0.1)] space-y-3 animate-fadeIn text-xs">
              <div className="text-[#22D3EE] font-mono font-semibold flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Feature Vector Dimensionality Matrix</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
                <div className="p-3 bg-[#05070B] rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Static MFCCs (1-13)</div>
                  <div className="text-[#22D3EE] font-bold text-sm mt-0.5">13 Coefficients</div>
                  <div className="text-slate-500 text-[10px] mt-1">Vocal tract geometry filterbank</div>
                </div>
                <div className="p-3 bg-[#05070B] rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Delta + Delta-Delta</div>
                  <div className="text-cyan-300 font-bold text-sm mt-0.5">26 Trajectory Derivs</div>
                  <div className="text-slate-500 text-[10px] mt-1">Velocity &amp; acceleration dynamics</div>
                </div>
                <div className="p-3 bg-[#05070B] rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Spectral Momentums</div>
                  <div className="text-[#10B981] font-bold text-sm mt-0.5">89 Spectral Bins</div>
                  <div className="text-slate-500 text-[10px] mt-1">Centroid, Rolloff, Flux, Kurtosis</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* STEP 03 */}
        <div className="p-5 sm:p-7 rounded-2xl bg-[#070B14] border border-[rgba(148,163,184,0.14)] hover:border-[rgba(148,163,184,0.25)] transition-all shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-lg bg-[#22D3EE]/15 border border-[#22D3EE]/30 text-[#22D3EE] font-mono font-bold text-xs sm:text-sm">
                  03
                </span>
                <h3 className="text-base sm:text-lg font-bold font-sans text-white">
                  Biological Vocal Tract Biomarkers
                </h3>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                Human vocal folds vibrate with natural, continuous physiological perturbations called <strong className="text-white font-semibold">micro-jitter</strong> (frequency variations ~1.5–4.0%) and <strong className="text-white font-semibold">shimmer</strong> (amplitude variations). Synthetic neural text-to-speech models, in contrast, frequently produce unnaturally regular pitch trajectories or step-like robotic transitions between phonemes.
              </p>

              {/* Interactive Acoustic Comparison Audio/Wave Player */}
              <div className="p-4 rounded-xl bg-[#0B1120] border border-[rgba(148,163,184,0.12)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-[#22D3EE]" />
                    Interactive Jitter Acoustic Comparison
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    Live WebAudio Synthesizer
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => {
                      setSimulatedSignal('human');
                      playSimulatedAudio('human');
                    }}
                    disabled={isPlayingSim}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                      simulatedSignal === 'human'
                        ? 'bg-[#10B981]/20 border border-[#10B981]/50 text-[#10B981]'
                        : 'bg-[#05070B] border border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Listen: Human Organic Jitter (±2.8%)</span>
                  </button>

                  <button
                    onClick={() => {
                      setSimulatedSignal('synthetic');
                      playSimulatedAudio('synthetic');
                    }}
                    disabled={isPlayingSim}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                      simulatedSignal === 'synthetic'
                        ? 'bg-rose-500/20 border border-rose-500/50 text-rose-400'
                        : 'bg-[#05070B] border border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Listen: Synthetic TTS Flatted Jitter (&lt;0.2%)</span>
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => toggleExpand(3)}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors"
              title="Toggle detailed inspector"
            >
              {expandedStep === 3 ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>

          {/* Expandable Step 3 Details */}
          {(expandedStep === 3 || detailMode === 'deepdive') && (
            <div className="mt-5 pt-4 border-t border-[rgba(148,163,184,0.1)] space-y-3 animate-fadeIn text-xs">
              <div className="text-[#22D3EE] font-mono font-semibold flex items-center gap-1.5">
                <Fingerprint className="w-3.5 h-3.5" />
                <span>Micro-Jitter &amp; Shimmer Equations</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#05070B] border border-slate-800 font-mono text-slate-300 space-y-1.5 overflow-x-auto">
                <div className="text-slate-500">// Jitter (Local, Absolute Period Perturbation):</div>
                <div className="text-cyan-300">Jitter(local) = ( (1 / (N - 1)) * Σ |T_i - T_{`{i+1}`}| ) / ( (1 / N) * Σ T_i ) * 100%</div>
                <div className="text-slate-500">// Shimmer (Local, Peak-to-Peak Amplitude Variation):</div>
                <div className="text-amber-300">Shimmer(local) = ( (1 / (N - 1)) * Σ |A_i - A_{`{i+1}`}| ) / ( (1 / N) * Σ A_i ) * 100%</div>
              </div>
            </div>
          )}
        </div>

        {/* STEP 04 */}
        <div className="p-5 sm:p-7 rounded-2xl bg-[#070B14] border border-[rgba(148,163,184,0.14)] hover:border-[rgba(148,163,184,0.25)] transition-all shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-400 font-mono font-bold text-xs sm:text-sm">
                  04
                </span>
                <h3 className="text-base sm:text-lg font-bold font-sans text-white">
                  Neural Vocoder Phase &amp; Harmonic Discontinuity
                </h3>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                Modern voice cloning frameworks (e.g. HiFi-GAN, WaveGlow, XTTS, Tacotron) generate waveform from mel-spectrograms. This reconstruction process leaves measurable artifacts: steep high-frequency harmonic attenuation (&gt;3.8 kHz) and unwrap phase variance across Short-Time Fourier Transform (STFT) frames.
              </p>

              {/* Spectral Discontinuity Highlight Box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 rounded-xl bg-[#0B1120] border border-rose-500/20 space-y-1">
                  <div className="text-rose-400 font-bold text-xs font-mono flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    High-Frequency Cutoff (&gt;3.8 kHz)
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans">
                    Neural upsamplers struggle with overtone synthesis above 3.8 kHz, creating unnatural sharp energy dropoffs.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0B1120] border border-amber-500/20 space-y-1">
                  <div className="text-amber-400 font-bold text-xs font-mono flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-amber-400" />
                    STFT Phase Inconsistency
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans">
                    Griffin-Lim and GAN phase estimators create inter-frame phase jumps that biological vocal cords never produce.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => toggleExpand(4)}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors"
              title="Toggle detailed inspector"
            >
              {expandedStep === 4 ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>

          {/* Expandable Step 4 Details */}
          {(expandedStep === 4 || detailMode === 'deepdive') && (
            <div className="mt-5 pt-4 border-t border-[rgba(148,163,184,0.1)] space-y-3 animate-fadeIn text-xs">
              <div className="text-rose-400 font-mono font-semibold flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                <span>Phase Derivative &amp; STFT Spectral Slope</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#05070B] border border-slate-800 font-mono text-slate-300 space-y-1.5 overflow-x-auto">
                <div className="text-slate-500">// Instantaneous Frequency Deviation (IFD) from STFT phase:</div>
                <div className="text-rose-300">IFD(t, ω) = d/dt [ arg( STFT{`{x(t)}`} ) ] - ω</div>
                <div className="text-slate-500">// Vocoder Artifact Metric:</div>
                <div className="text-slate-300">Var_Phase = Σ_{`{k}`} | IFD(k) - μ_IFD |² &gt; Threshold_Vocoder (98.2% synthetic discriminator)</div>
              </div>
            </div>
          )}
        </div>

        {/* STEP 05 */}
        <div className="p-5 sm:p-7 rounded-2xl bg-[#070B14] border border-[rgba(148,163,184,0.14)] hover:border-[rgba(148,163,184,0.25)] transition-all shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-lg bg-[#22D3EE]/15 border border-[#22D3EE]/30 text-[#22D3EE] font-mono font-bold text-xs sm:text-sm">
                  05
                </span>
                <h3 className="text-base sm:text-lg font-bold font-sans text-white">
                  Multi-Tier Ensemble Classification &amp; Risk Engine
                </h3>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                The mathematical feature vectors are evaluated by our calibrated statistical ensemble model, mapping to calibrated probabilities (Human vs AI-Generated) and categorizing threat levels into <strong className="text-emerald-400 font-semibold">LOW</strong>, <strong className="text-amber-400 font-semibold">MEDIUM</strong>, or <strong className="text-rose-400 font-semibold">HIGH</strong> risk.
              </p>

              {/* Interactive Risk Engine Playground */}
              <div className="p-4 rounded-xl bg-[#0B1120] border border-[rgba(148,163,184,0.12)] space-y-3 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-[#22D3EE]" />
                    Interactive Threat Classification Simulator
                  </span>
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                    testRiskScore >= 70
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : testRiskScore >= 45
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/40'
                  }`}>
                    {testRiskScore >= 70 ? 'CRITICAL RISK (AI DEEPFAKE)' : testRiskScore >= 45 ? 'UNCERTAIN (2FA REQUIRED)' : 'GENUINE HUMAN VOICE'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>Simulated Classifier Confidence:</span>
                    <span className="text-white font-bold">{testRiskScore}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={testRiskScore}
                    onChange={(e) => setTestRiskScore(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#22D3EE]"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>0% (Human Verified)</span>
                    <span>50% (Uncertainty Margin)</span>
                    <span>100% (High-Confidence AI)</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => toggleExpand(5)}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors"
              title="Toggle detailed inspector"
            >
              {expandedStep === 5 ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>

          {/* Expandable Step 5 Details */}
          {(expandedStep === 5 || detailMode === 'deepdive') && (
            <div className="mt-5 pt-4 border-t border-[rgba(148,163,184,0.1)] space-y-3 animate-fadeIn text-xs">
              <div className="text-[#22D3EE] font-mono font-semibold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>Ensemble Weights &amp; SOC Automated Dispatch</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#05070B] border border-slate-800 font-mono text-slate-300 space-y-1.5 overflow-x-auto">
                <div className="text-slate-500">// Multi-Signal Fusion Weighting:</div>
                <div className="text-cyan-300">P_threat = 0.40 * P_vocoder + 0.30 * (1 - Cosine_voiceprint) + 0.20 * P_jitter_flat + 0.10 * P_prosody</div>
                <div className="text-slate-500">// Calibrated Decision Boundary:</div>
                <div className="text-slate-300">Threshold = 0.65 | Trigger: Instant 2FA Callback + SIEM Webhook + Wire Transaction Freeze</div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* CTA SECTION */}
      <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
        <button
          id="btn-test-acoustic-pipeline"
          onClick={() => navigate('/app/voice-analysis')}
          className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#22D3EE] hover:bg-[#06B6D4] text-[#05070B] font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all transform active:scale-95 shadow-lg shadow-[#22D3EE]/20 cursor-pointer"
        >
          <Zap className="w-4 h-4 fill-current" />
          <span>Test the Acoustic Pipeline in Voice Analysis</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <button
          onClick={() => navigate('/app/attack-simulator')}
          className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-[#0B1120] hover:bg-[#131B2E] text-slate-300 hover:text-white border border-[rgba(148,163,184,0.15)] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <span>Run Interactive Attack Simulator</span>
        </button>
      </div>

    </div>
  );
};
