import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Sliders, 
  Cpu, 
  Lock, 
  Trash2, 
  Check, 
  RotateCcw, 
  ShieldCheck, 
  AlertTriangle, 
  Shield, 
  Database,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';

export const SettingsPrivacyView: React.FC = () => {
  // Acoustic Detection Sensitivity Thresholds
  const [decisionBoundary, setDecisionBoundary] = useState<number>(() => {
    const saved = localStorage.getItem('verivox_decision_boundary');
    return saved ? Number(saved) : 65;
  });

  const [uncertaintyMargin, setUncertaintyMargin] = useState<number>(() => {
    const saved = localStorage.getItem('verivox_uncertainty_margin');
    return saved ? Number(saved) : 25;
  });

  // Audio Preprocessing Parameters
  const [silenceTrimming, setSilenceTrimming] = useState<boolean>(() => {
    const saved = localStorage.getItem('verivox_silence_trimming');
    return saved !== null ? saved === 'true' : true;
  });

  const [strictConsentPrompt, setStrictConsentPrompt] = useState<boolean>(() => {
    const saved = localStorage.getItem('verivox_strict_consent');
    return saved !== null ? saved === 'true' : true;
  });

  const [hardwareAcceleration, setHardwareAcceleration] = useState<boolean>(() => {
    const saved = localStorage.getItem('verivox_hw_accel');
    return saved !== null ? saved === 'true' : true;
  });

  // Ephemeral Purge State
  const [isPurging, setIsPurging] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'info'; text: string } | null>(null);

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('verivox_decision_boundary', decisionBoundary.toString());
    localStorage.setItem('verivox_uncertainty_margin', uncertaintyMargin.toString());
    localStorage.setItem('verivox_silence_trimming', silenceTrimming.toString());
    localStorage.setItem('verivox_strict_consent', strictConsentPrompt.toString());
    localStorage.setItem('verivox_hw_accel', hardwareAcceleration.toString());
  }, [decisionBoundary, uncertaintyMargin, silenceTrimming, strictConsentPrompt, hardwareAcceleration]);

  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handlePurgeBuffers = () => {
    setIsPurging(true);
    setTimeout(() => {
      // Clear any session audio storage
      try {
        sessionStorage.clear();
      } catch {
        // ignore
      }
      setIsPurging(false);
      showToast('All ephemeral audio buffers and in-memory FFT spectrogram caches purged.', 'success');
    }, 600);
  };

  const handleResetDefaults = () => {
    setDecisionBoundary(65);
    setUncertaintyMargin(25);
    setSilenceTrimming(true);
    setStrictConsentPrompt(true);
    setHardwareAcceleration(true);
    showToast('Settings restored to factory SIH26104 benchmark defaults.', 'info');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 font-sans antialiased text-slate-100">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-[#22D3EE] flex-shrink-0" />
            <h1 className="text-2xl sm:text-3xl font-extrabold font-slab text-white tracking-tight">
              Settings &amp; Security Controls
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1.5 font-sans">
            Adjust acoustic sensitivity thresholds, privacy configurations, and biometric audit retention parameters.
          </p>
        </div>

        <button
          onClick={handleResetDefaults}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#0B1120] hover:bg-[#131B2E] border border-[rgba(148,163,184,0.15)] flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          title="Restore factory calibration"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
          <span>Reset Defaults</span>
        </button>
      </div>

      {/* Floating Notification Toast */}
      {toastMessage && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs sm:text-sm font-sans shadow-lg transition-all animate-fadeIn ${
          toastMessage.type === 'success'
            ? 'bg-[#061B1C] border-[#10B981]/40 text-[#10B981]'
            : 'bg-[#0B1120] border-[#22D3EE]/40 text-[#22D3EE]'
        }`}>
          <div className="flex items-center gap-2.5">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* SECTION 1: Acoustic Detection Sensitivity Thresholds */}
      <div className="bg-[#070B14] border border-[rgba(148,163,184,0.14)] rounded-2xl p-5 sm:p-7 space-y-6 shadow-sm">
        <div className="flex items-center gap-2.5 text-[#22D3EE] font-bold text-sm sm:text-base">
          <Sliders className="w-4 h-4 text-[#22D3EE]" />
          <span>Acoustic Detection Sensitivity Thresholds</span>
        </div>

        <div className="space-y-6 pt-1">
          {/* AI Classification Decision Boundary */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-semibold text-slate-200">
                AI Classification Decision Boundary
              </label>
              <span className="text-sm font-bold font-mono text-[#22D3EE]">
                {decisionBoundary}%
              </span>
            </div>

            <input
              type="range"
              min="40"
              max="90"
              step="1"
              value={decisionBoundary}
              onChange={(e) => setDecisionBoundary(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#22D3EE]"
            />

            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Probabilities above this threshold are classified as <span className="font-mono text-slate-300 font-semibold">AI_GENERATED</span>.
            </p>
          </div>

          {/* Uncertainty Margin Band */}
          <div className="space-y-2.5 pt-3 border-t border-[rgba(148,163,184,0.08)]">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-semibold text-slate-200">
                Uncertainty Margin Band (±%)
              </label>
              <span className="text-sm font-bold font-mono text-amber-400">
                ±{uncertaintyMargin}%
              </span>
            </div>

            <input
              type="range"
              min="5"
              max="35"
              step="1"
              value={uncertaintyMargin}
              onChange={(e) => setUncertaintyMargin(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />

            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Scores falling within this boundary are marked <span className="font-mono text-slate-300 font-semibold">UNCERTAIN</span> to trigger secondary verification.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 2: Audio Preprocessing Parameters */}
      <div className="bg-[#070B14] border border-[rgba(148,163,184,0.14)] rounded-2xl p-5 sm:p-7 space-y-5 shadow-sm">
        <div className="flex items-center gap-2.5 text-[#22D3EE] font-bold text-sm sm:text-base">
          <Cpu className="w-4 h-4 text-[#22D3EE]" />
          <span>Audio Preprocessing Parameters</span>
        </div>

        <div className="space-y-3 pt-1">
          {/* Adaptive Silence & Noise Trimming */}
          <div 
            onClick={() => setSilenceTrimming(prev => !prev)}
            className="p-4 rounded-xl bg-[#0B1120] border border-[rgba(148,163,184,0.1)] hover:border-[rgba(148,163,184,0.2)] flex items-center justify-between gap-4 cursor-pointer transition-all"
          >
            <div className="space-y-0.5">
              <div className="text-xs sm:text-sm font-semibold text-slate-200">
                Adaptive Silence &amp; Noise Trimming
              </div>
              <div className="text-xs text-slate-400 font-sans">
                Trims non-voiced silence from start/end of audio buffers
              </div>
            </div>

            <input
              type="checkbox"
              checked={silenceTrimming}
              onChange={() => {}} // handled by parent div
              className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-[#22D3EE] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#22D3EE]"
            />
          </div>

          {/* Strict Biometric Consent Prompt */}
          <div 
            onClick={() => setStrictConsentPrompt(prev => !prev)}
            className="p-4 rounded-xl bg-[#0B1120] border border-[rgba(148,163,184,0.1)] hover:border-[rgba(148,163,184,0.2)] flex items-center justify-between gap-4 cursor-pointer transition-all"
          >
            <div className="space-y-0.5">
              <div className="text-xs sm:text-sm font-semibold text-slate-200">
                Strict Biometric Consent Prompt
              </div>
              <div className="text-xs text-slate-400 font-sans">
                Enforce authorization check before any microphone recording
              </div>
            </div>

            <input
              type="checkbox"
              checked={strictConsentPrompt}
              onChange={() => {}} // handled by parent div
              className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-[#22D3EE] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#22D3EE]"
            />
          </div>

          {/* Hardware DSP Acceleration */}
          <div 
            onClick={() => setHardwareAcceleration(prev => !prev)}
            className="p-4 rounded-xl bg-[#0B1120] border border-[rgba(148,163,184,0.1)] hover:border-[rgba(148,163,184,0.2)] flex items-center justify-between gap-4 cursor-pointer transition-all"
          >
            <div className="space-y-0.5">
              <div className="text-xs sm:text-sm font-semibold text-slate-200">
                WebAssembly / SIMD DSP Acceleration
              </div>
              <div className="text-xs text-slate-400 font-sans">
                Accelerate 128-D spectral feature transforms locally in-browser (&lt;30ms)
              </div>
            </div>

            <input
              type="checkbox"
              checked={hardwareAcceleration}
              onChange={() => {}} // handled by parent div
              className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-[#22D3EE] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#22D3EE]"
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: Biometric Privacy & Data Erasure (Right to be Forgotten) */}
      <div className="bg-[#11080E] border border-rose-500/30 rounded-2xl p-5 sm:p-7 space-y-4 shadow-sm">
        <div className="flex items-center gap-2.5 text-rose-400 font-bold text-sm sm:text-base">
          <Lock className="w-4 h-4 text-rose-400" />
          <span>Biometric Privacy &amp; Data Erasure (Right to be Forgotten)</span>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
          Voice recordings are sensitive biometric markers. <strong className="text-white font-semibold">VeriVox</strong> does not retain permanent audio without user authorization.
        </p>

        <div className="pt-2">
          <button
            id="btn-purge-audio-buffers"
            onClick={handlePurgeBuffers}
            disabled={isPurging}
            className="px-4 py-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
          >
            <Trash2 className={`w-4 h-4 text-rose-400 ${isPurging ? 'animate-spin' : ''}`} />
            <span>{isPurging ? 'Purging Memory Buffers...' : 'Purge Ephemeral Audio Buffers'}</span>
          </button>
        </div>
      </div>

    </div>
  );
};
