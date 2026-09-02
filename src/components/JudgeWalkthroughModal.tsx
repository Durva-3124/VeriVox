import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  X,
  ArrowLeft,
  ArrowRight,
  Radio,
  Activity,
  Flame,
  Cpu,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface JudgeWalkthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const JudgeWalkthroughModal: React.FC<JudgeWalkthroughModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('Hindi (हिन्दी)');
  
  // Audio player states
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [activePlayerType, setActivePlayerType] = useState<'authentic' | 'synthetic'>('authentic');
  
  // Web Audio Context reference
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorNodesRef = useRef<OscillatorNode[]>([]);
  const gainNodeRef = useRef<GainNode | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const TOTAL_STEPS = 11;
  const AUDIO_DURATION = 10.2; // 10.2s

  // Stop audio synthesis helper
  const stopAudio = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    oscillatorNodesRef.current.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // already stopped
      }
    });
    oscillatorNodesRef.current = [];
    if (gainNodeRef.current) {
      try {
        gainNodeRef.current.disconnect();
      } catch {
        // already disconnected
      }
      gainNodeRef.current = null;
    }
    setIsPlaying(false);
  };

  // Start audio synthesis
  const startAudio = (type: 'authentic' | 'synthetic') => {
    stopAudio();
    setActivePlayerType(type);
    setIsPlaying(true);
    setCurrentTime(0);

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContextClass();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.18, ctx.currentTime);
    masterGain.connect(ctx.destination);
    gainNodeRef.current = masterGain;

    const baseFreq = type === 'authentic' ? 140 : 135;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();

    if (type === 'authentic') {
      // Natural human speech formant simulation with organic micro-vibrato
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(baseFreq * 2.1, ctx.currentTime);

      // Pitch micro-variation (biological jitter)
      for (let t = 0; t < AUDIO_DURATION; t += 0.25) {
        const jitter = (Math.sin(t * 7) + Math.cos(t * 13)) * 4.5;
        osc1.frequency.setValueAtTime(baseFreq + jitter, ctx.currentTime + t);
        osc2.frequency.setValueAtTime((baseFreq * 2.1) + jitter, ctx.currentTime + t);
      }
    } else {
      // Synthetic robotic vocoder simulation: flat, rigid pitch with high-frequency buzz
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(baseFreq * 3.0, ctx.currentTime);

      // Quantized steps without natural jitter
      for (let t = 0; t < AUDIO_DURATION; t += 0.5) {
        const steppedFreq = baseFreq + ((Math.floor(t) % 2 === 0) ? 0 : 20);
        osc1.frequency.setValueAtTime(steppedFreq, ctx.currentTime + t);
        osc2.frequency.setValueAtTime(steppedFreq * 2, ctx.currentTime + t);
      }
    }

    osc1.connect(masterGain);
    osc2.connect(masterGain);
    osc1.start();
    osc2.start();
    oscillatorNodesRef.current = [osc1, osc2];

    const startTime = Date.now();
    timerIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed >= AUDIO_DURATION) {
        stopAudio();
        setCurrentTime(AUDIO_DURATION);
      } else {
        setCurrentTime(elapsed);
      }
    }, 100);
  };

  const togglePlayPause = (type: 'authentic' | 'synthetic') => {
    if (isPlaying) {
      stopAudio();
    } else {
      startAudio(type);
    }
  };

  // Reset playback and clean up on step change or modal close
  useEffect(() => {
    stopAudio();
    setCurrentTime(0);

    if (currentStep === 11) {
      // Trigger festive confetti on Step 11 completion!
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#22D3EE', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'],
        });
      } catch {
        // confetti fallback
      }
    }
  }, [currentStep, isOpen]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && currentStep < TOTAL_STEPS) {
        setCurrentStep(prev => prev + 1);
      } else if (e.key === 'ArrowLeft' && currentStep > 1) {
        setCurrentStep(prev => prev - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStep, onClose]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="relative w-full max-w-2xl bg-[#0B1120] border border-[#22D3EE]/30 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-[0_0_50px_rgba(34,211,238,0.15)] flex flex-col space-y-6 my-auto"
      >
        {/* Header Bar */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-2.5 shadow-lg shadow-orange-500/20 text-white flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-slab text-base sm:text-lg font-bold text-white tracking-tight">
                  SIH26104 Guided Judge Walkthrough
                </h3>
                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded font-mono">
                  LIVE DEMO
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans tracking-tight">
                End-to-end Attack Simulation &amp; Multi-lingual Acoustic Detection Lifecycle
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
              title="Close Walkthrough"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-[11px] font-mono font-bold text-[#22D3EE]">
              STEP {currentStep} of {TOTAL_STEPS}
            </div>
            <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#22D3EE] to-amber-400 transition-all duration-300 rounded-full"
                style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Step Body Content with Smooth Transition */}
        <div className="min-h-[300px] flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {/* STEP 1: Target Voice Sample Selection */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-[#22D3EE] font-mono text-sm font-bold">
                  <Radio className="w-4 h-4 text-[#22D3EE]" />
                  <span>STEP 1: Target Voice Sample Selection</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                  In a real voice impersonation attack, bad actors harvest 5–10 seconds of a victim's voice from social media or public interviews.
                </p>

                <div className="bg-[#070B14] border border-[rgba(148,163,184,0.12)] rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">Authorized Target Voice Sample (Marathi)</span>
                    <span className="text-[#10B981] font-mono font-semibold">10.2 sec | 16kHz</span>
                  </div>

                  <div className="bg-[#0D1527] border border-[rgba(148,163,184,0.1)] rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                        <span className="text-xs font-semibold text-slate-300">Target Speaker Reference Sample</span>
                      </div>
                      <span className="bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 text-[10px] font-bold px-2 py-0.5 rounded font-mono">
                        AUTHENTIC VOICE
                      </span>
                    </div>

                    {/* Waveform Bar Graphic */}
                    <div className="flex items-center gap-1.5 h-7 py-1 px-2 bg-[#05070B] rounded-lg">
                      {[18, 28, 40, 65, 45, 30, 50, 75, 90, 60, 40, 55, 70, 85, 45, 30, 50, 65, 35, 20, 35, 45, 60, 30, 20, 15].map((h, i) => (
                        <div
                          key={i}
                          style={{ height: `${h}%` }}
                          className={`flex-1 rounded-full transition-all duration-150 ${
                            isPlaying && activePlayerType === 'authentic'
                              ? 'bg-[#22D3EE] shadow-[0_0_8px_#22D3EE]'
                              : i === 0 ? 'bg-[#22D3EE]' : 'bg-slate-700/50'
                          }`}
                        />
                      ))}
                    </div>

                    {/* Progress line */}
                    <div className="w-full bg-slate-800 h-1 rounded-full relative">
                      <div
                        className="bg-[#22D3EE] h-full rounded-full transition-all duration-100"
                        style={{ width: `${(currentTime / AUDIO_DURATION) * 100}%` }}
                      />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[#22D3EE] rounded-full shadow-md"
                        style={{ left: `calc(${(currentTime / AUDIO_DURATION) * 100}% - 6px)` }}
                      />
                    </div>

                    {/* Controls Row */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => togglePlayPause('authentic')}
                          className="w-9 h-9 rounded-full bg-[#06B6D4] hover:bg-[#22D3EE] text-slate-950 flex items-center justify-center font-bold transition-all shadow-md cursor-pointer"
                        >
                          {isPlaying && activePlayerType === 'authentic' ? (
                            <Pause className="w-4 h-4 fill-slate-950" />
                          ) : (
                            <Play className="w-4 h-4 fill-slate-950 ml-0.5" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            stopAudio();
                            setCurrentTime(0);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400">
                          {formatTime(currentTime)} / {formatTime(AUDIO_DURATION)}
                        </span>
                        <Volume2 className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: Target Regional Language Selection */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-[#22D3EE] font-mono text-sm font-bold">
                  <Activity className="w-4 h-4 text-[#22D3EE]" />
                  <span>STEP 2: Target Regional Language Selection</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                  Impersonation fraudsters operate in regional Indian dialects to target victims who may trust local language calls more than English.
                </p>

                <div className="bg-[#070B14] border border-[rgba(148,163,184,0.12)] rounded-xl p-5 space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300 block">
                      Active Regional Language
                    </label>
                    <div className="relative">
                      <select
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        className="w-full bg-[#0B1120] border border-[rgba(148,163,184,0.2)] rounded-xl px-4 py-3 text-sm text-slate-200 font-sans focus:outline-none focus:border-[#22D3EE] transition-colors appearance-none cursor-pointer"
                      >
                        <option value="Hindi (हिन्दी)">Hindi (हिन्दी)</option>
                        <option value="Marathi (मराठी)">Marathi (मराठी)</option>
                        <option value="Tamil (தமிழ்)">Tamil (தமிழ்)</option>
                        <option value="Telugu (తెలుగు)">Telugu (తెలుగు)</option>
                        <option value="Bengali (বাংলা)">Bengali (বাংলা)</option>
                        <option value="Kannada (ಕನ್ನಡ)">Kannada (ಕನ್ನಡ)</option>
                        <option value="Gujarati (ગુજરાતી)">Gujarati (ગુજરાતી)</option>
                        <option value="Malayalam (മലയാളം)">Malayalam (മലയാളം)</option>
                        <option value="Indian English">Indian English</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-[rgba(148,163,184,0.1)]">
                    <span className="text-slate-400 font-sans">
                      Language Confidence:{' '}
                      <strong className="text-[#10B981] font-mono">96.8%</strong>
                    </span>
                    <span className="text-slate-400 font-sans">
                      Dialect Mapping:{' '}
                      <strong className="text-[#22D3EE] font-mono">Western Indic</strong>
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 3: Phishing Attack Scenario Script */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-[#22D3EE] font-mono text-sm font-bold">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>STEP 3: Phishing Attack Scenario Script</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                  Fraudsters craft urgent, emotion-driven scripts to coerce immediate action.
                </p>

                <div className="bg-[#070B14] border border-[rgba(148,163,184,0.12)] rounded-xl p-5 space-y-4">
                  <div className="text-xs font-bold text-amber-400 font-mono tracking-wide">
                    Scenario: Urgent Bank Impersonation
                  </div>

                  <div className="bg-[#05070B] border border-[rgba(148,163,184,0.15)] rounded-lg p-4 text-slate-200 font-sans text-sm leading-relaxed">
                    नमस्कार, मी बँकेतून बोलत आहे. तुमच्या खात्यामध्ये तात्काळ संशयास्पद व्यवहार आढळला आहे. खाते सुरक्षित ठेवण्यासाठी त्वरित ₹५०,००० रुपये व्हेरिफिकेशन खात्यावर ट्रान्सफर करा.
                  </div>

                  <div className="text-xs text-slate-400 leading-relaxed font-sans bg-[#0B1120]/60 p-3 rounded-lg border border-[rgba(148,163,184,0.08)]">
                    <strong className="text-slate-300">English Translation:</strong> Hello, I am calling from the bank. Suspicious activity was detected on your account. Transfer ₹50,000 to the verification account immediately to avoid blockage.
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 4: Synthetic Cloned Audio Generated (Module A) */}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-rose-400 font-mono text-sm font-bold">
                  <Cpu className="w-4 h-4 text-rose-400" />
                  <span>STEP 4: Synthetic Cloned Audio Generated (Module A)</span>
                </div>

                <div className="bg-[#070B14] border border-rose-500/30 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-rose-400 font-bold font-mono tracking-wider">
                      AI-GENERATED DEMONSTRATION AUDIO
                    </span>
                    <span className="text-slate-400 font-mono">Status: Synthesized</span>
                  </div>

                  <div className="bg-[#150A10] border border-rose-500/20 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        <span className="text-xs font-semibold text-slate-200">
                          Cloned Voice Phishing Attack (Marathi)
                        </span>
                      </div>
                      <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold px-2 py-0.5 rounded font-mono">
                        AI-GENERATED SYNTHETIC
                      </span>
                    </div>

                    {/* Rose Waveform Graphic */}
                    <div className="flex items-center gap-1.5 h-7 py-1 px-2 bg-[#05070B] rounded-lg">
                      {[30, 45, 60, 50, 70, 85, 95, 90, 80, 70, 60, 55, 75, 80, 85, 70, 60, 50, 40, 30, 45, 60, 40, 30, 20, 15].map((h, i) => (
                        <div
                          key={i}
                          style={{ height: `${h}%` }}
                          className={`flex-1 rounded-full transition-all duration-150 ${
                            isPlaying && activePlayerType === 'synthetic'
                              ? 'bg-rose-500 shadow-[0_0_8px_#F43F5E]'
                              : i === 0 ? 'bg-rose-500' : 'bg-slate-700/50'
                          }`}
                        />
                      ))}
                    </div>

                    {/* Progress line */}
                    <div className="w-full bg-slate-800 h-1 rounded-full relative">
                      <div
                        className="bg-rose-500 h-full rounded-full transition-all duration-100"
                        style={{ width: `${(currentTime / AUDIO_DURATION) * 100}%` }}
                      />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[#22D3EE] rounded-full shadow-md"
                        style={{ left: `calc(${(currentTime / AUDIO_DURATION) * 100}% - 6px)` }}
                      />
                    </div>

                    {/* Controls Row */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => togglePlayPause('synthetic')}
                          className="w-9 h-9 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center font-bold transition-all shadow-md cursor-pointer"
                        >
                          {isPlaying && activePlayerType === 'synthetic' ? (
                            <Pause className="w-4 h-4 fill-white" />
                          ) : (
                            <Play className="w-4 h-4 fill-white ml-0.5" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            stopAudio();
                            setCurrentTime(0);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400">
                          {formatTime(currentTime)} / {formatTime(AUDIO_DURATION)}
                        </span>
                        <Volume2 className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  </div>

                  <p className="text-slate-400 text-xs italic">
                    Note: Audio generated in controlled simulation environment. Labeled for defensive analysis.
                  </p>
                </div>
              </motion.div>
            )}

            {/* STEP 5: Listen to Original Human Voice */}
            {currentStep === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-[#10B981] font-mono text-sm font-bold">
                  <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                  <span>STEP 5: Listen to Original Human Voice</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                  Notice natural human cadence, breathing, and pitch micro-tremors in the authentic sample.
                </p>

                <div className="bg-[#070B14] border border-[rgba(148,163,184,0.12)] rounded-xl p-5 space-y-4">
                  <div className="bg-[#0D1527] border border-[rgba(148,163,184,0.1)] rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                        <span className="text-xs font-semibold text-slate-300">Authentic Human Reference</span>
                      </div>
                      <span className="bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 text-[10px] font-bold px-2 py-0.5 rounded font-mono">
                        AUTHENTIC VOICE
                      </span>
                    </div>

                    {/* Waveform graphic */}
                    <div className="flex items-center gap-1.5 h-7 py-1 px-2 bg-[#05070B] rounded-lg">
                      {[25, 35, 45, 60, 50, 40, 55, 70, 80, 65, 50, 45, 60, 75, 55, 40, 50, 60, 45, 30, 40, 50, 45, 35, 25, 15].map((h, i) => (
                        <div
                          key={i}
                          style={{ height: `${h}%` }}
                          className={`flex-1 rounded-full transition-all duration-150 ${
                            isPlaying && activePlayerType === 'authentic'
                              ? 'bg-[#10B981] shadow-[0_0_8px_#10B981]'
                              : i === 0 ? 'bg-[#22D3EE]' : 'bg-slate-700/50'
                          }`}
                        />
                      ))}
                    </div>

                    {/* Progress line */}
                    <div className="w-full bg-slate-800 h-1 rounded-full relative">
                      <div
                        className="bg-[#22D3EE] h-full rounded-full transition-all duration-100"
                        style={{ width: `${(currentTime / AUDIO_DURATION) * 100}%` }}
                      />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[#22D3EE] rounded-full shadow-md"
                        style={{ left: `calc(${(currentTime / AUDIO_DURATION) * 100}% - 6px)` }}
                      />
                    </div>

                    {/* Controls Row */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => togglePlayPause('authentic')}
                          className="w-9 h-9 rounded-full bg-[#06B6D4] hover:bg-[#22D3EE] text-slate-950 flex items-center justify-center font-bold transition-all shadow-md cursor-pointer"
                        >
                          {isPlaying && activePlayerType === 'authentic' ? (
                            <Pause className="w-4 h-4 fill-slate-950" />
                          ) : (
                            <Play className="w-4 h-4 fill-slate-950 ml-0.5" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            stopAudio();
                            setCurrentTime(0);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400">
                          {formatTime(currentTime)} / {formatTime(AUDIO_DURATION)}
                        </span>
                        <Volume2 className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 6: Listen to AI-Generated Clone */}
            {currentStep === 6 && (
              <motion.div
                key="step6"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-rose-400 font-mono text-sm font-bold">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>STEP 6: Listen to AI-Generated Clone</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                  Notice how the cloned voice mimics the timbre, but contains subtle robotic prosody and high-frequency cuts.
                </p>

                <div className="bg-[#070B14] border border-rose-500/30 rounded-xl p-5 space-y-4">
                  <div className="bg-[#150A10] border border-rose-500/20 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        <span className="text-xs font-semibold text-slate-200">
                          Synthetic AI Clone (Phishing Pretext)
                        </span>
                      </div>
                      <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold px-2 py-0.5 rounded font-mono">
                        AI-GENERATED SYNTHETIC
                      </span>
                    </div>

                    {/* Rose Waveform */}
                    <div className="flex items-center gap-1.5 h-7 py-1 px-2 bg-[#05070B] rounded-lg">
                      {[30, 45, 60, 50, 70, 85, 95, 90, 80, 70, 60, 55, 75, 80, 85, 70, 60, 50, 40, 30, 45, 60, 40, 30, 20, 15].map((h, i) => (
                        <div
                          key={i}
                          style={{ height: `${h}%` }}
                          className={`flex-1 rounded-full transition-all duration-150 ${
                            isPlaying && activePlayerType === 'synthetic'
                              ? 'bg-rose-500 shadow-[0_0_8px_#F43F5E]'
                              : i === 0 ? 'bg-rose-500' : 'bg-slate-700/50'
                          }`}
                        />
                      ))}
                    </div>

                    {/* Progress line */}
                    <div className="w-full bg-slate-800 h-1 rounded-full relative">
                      <div
                        className="bg-rose-500 h-full rounded-full transition-all duration-100"
                        style={{ width: `${(currentTime / AUDIO_DURATION) * 100}%` }}
                      />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[#22D3EE] rounded-full shadow-md"
                        style={{ left: `calc(${(currentTime / AUDIO_DURATION) * 100}% - 6px)` }}
                      />
                    </div>

                    {/* Controls Row */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => togglePlayPause('synthetic')}
                          className="w-9 h-9 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center font-bold transition-all shadow-md cursor-pointer"
                        >
                          {isPlaying && activePlayerType === 'synthetic' ? (
                            <Pause className="w-4 h-4 fill-white" />
                          ) : (
                            <Play className="w-4 h-4 fill-white ml-0.5" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            stopAudio();
                            setCurrentTime(0);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400">
                          {formatTime(currentTime)} / {formatTime(AUDIO_DURATION)}
                        </span>
                        <Volume2 className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 7: Submit to VeriVox Detection Engine */}
            {currentStep === 7 && (
              <motion.div
                key="step7"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="py-6 flex flex-col items-center justify-center text-center space-y-4"
              >
                <div className="w-14 h-14 rounded-full bg-[#22D3EE]/10 border border-[#22D3EE]/30 text-[#22D3EE] flex items-center justify-center shadow-lg shadow-[#22D3EE]/20 animate-pulse">
                  <Radio className="w-7 h-7" />
                </div>
                
                <h4 className="text-white font-bold text-base sm:text-lg font-sans">
                  STEP 7: Submit to VeriVox Detection Engine
                </h4>

                <p className="text-slate-300 text-xs sm:text-sm max-w-md mx-auto leading-relaxed font-sans">
                  Now we pass the suspicious audio directly into VeriVox's multi-stage acoustic preprocessor and ML classifier.
                </p>

                <p className="text-[#22D3EE] font-mono text-xs font-semibold pt-2">
                  Click 'Next' to execute real-time acoustic pipeline
                </p>
              </motion.div>
            )}

            {/* STEP 8: Preprocessing & Feature Extraction Complete */}
            {currentStep === 8 && (
              <motion.div
                key="step8"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-[#22D3EE] font-mono text-sm font-bold">
                  <Activity className="w-4 h-4 text-[#22D3EE]" />
                  <span>STEP 8: Preprocessing &amp; Feature Extraction Complete</span>
                </div>

                <div className="bg-[#070B14] border border-[rgba(148,163,184,0.12)] rounded-xl p-5 space-y-3">
                  {[
                    '16kHz Mono Resampling & Butterworth Filter',
                    '13 MFCCs & Spectral Rolloff Extracted',
                    'F0 Pitch Micro-Jitter & Shimmer Scored',
                    'Neural Vocoder Phase Discontinuity Computed',
                  ].map((feature, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-2 border-b border-[rgba(148,163,184,0.06)] last:border-none text-xs"
                    >
                      <div className="flex items-center gap-2 text-slate-200 font-sans">
                        <span className="text-[#10B981] font-bold">✓</span>
                        <span>{feature}</span>
                      </div>
                      <span className="text-[#10B981] font-mono font-bold">Passed</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 9: Authenticity Score & Confidence Meter */}
            {currentStep === 9 && (
              <motion.div
                key="step9"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-rose-400 font-mono text-sm font-bold">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>STEP 9: Authenticity Score &amp; Confidence Meter</span>
                </div>

                <div className="bg-[#070B14] border border-rose-500/20 rounded-xl p-5 flex flex-col items-center space-y-4">
                  {/* Circular Radial Gauge */}
                  <div className="relative w-28 h-28 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        className="stroke-slate-800"
                        strokeWidth="8"
                        fill="transparent"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        className="stroke-rose-500 shadow-[0_0_15px_#F43F5E]"
                        strokeWidth="8"
                        strokeDasharray="251.2"
                        strokeDashoffset={251.2 * (1 - 0.94)}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-2xl font-bold font-mono text-white">94%</span>
                      <span className="text-[9px] font-mono text-slate-400 uppercase tracking-tight">AI PROBABILITY</span>
                    </div>
                  </div>

                  <div className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-1.5 text-rose-400 font-bold text-sm">
                      <AlertTriangle className="w-4 h-4" />
                      <span>AI-GENERATED VOICE SUSPECTED</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-xs">
                      <span className="bg-rose-500/20 text-rose-400 border border-rose-500/40 font-bold font-mono px-3 py-0.5 rounded">
                        RISK: HIGH
                      </span>
                      <span className="bg-[#0B1120] text-slate-300 border border-slate-700 px-3 py-0.5 rounded font-mono">
                        Confidence: 94%
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 w-full pt-2">
                    <div className="bg-[#0B1120] border border-[rgba(148,163,184,0.1)] rounded-lg p-3 text-center">
                      <div className="text-[10px] font-mono text-slate-400 uppercase">HUMAN PROBABILITY</div>
                      <div className="text-lg font-bold font-mono text-[#10B981]">5.8%</div>
                    </div>
                    <div className="bg-[#0B1120] border border-[rgba(148,163,184,0.1)] rounded-lg p-3 text-center">
                      <div className="text-[10px] font-mono text-slate-400 uppercase">AI PROBABILITY</div>
                      <div className="text-lg font-bold font-mono text-rose-500">94.2%</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 10: High-Risk Impersonation Alert Triggered */}
            {currentStep === 10 && (
              <motion.div
                key="step10"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-rose-400 font-mono text-sm font-bold">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>STEP 10: High-Risk Impersonation Alert Triggered</span>
                </div>

                <div className="bg-[#150A10] border border-rose-500/30 rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4" />
                    <span>AI-GENERATED VOICE SUSPECTED</span>
                  </div>

                  <ul className="space-y-2 text-xs text-slate-300 font-sans pl-2">
                    <li className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">•</span>
                      <span>High-frequency spectral rolloff cutoff (&gt;3.8kHz) detected</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">•</span>
                      <span>Unnatural pitch micro-regularity (lack of biological jitter)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">•</span>
                      <span>STFT phase reconstruction artifacts consistent with neural TTS vocoders</span>
                    </li>
                  </ul>
                </div>
              </motion.div>
            )}

            {/* STEP 11: Actionable Impersonation Prevention */}
            {currentStep === 11 && (
              <motion.div
                key="step11"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-[#10B981] font-mono text-sm font-bold">
                  <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                  <span>STEP 11: Actionable Impersonation Prevention</span>
                </div>

                <div className="bg-[#070B14] border border-[rgba(148,163,184,0.12)] rounded-xl p-5 space-y-4">
                  <div className="text-xs font-bold text-white font-sans">
                    Recommended Safeguards:
                  </div>

                  <ul className="space-y-2.5 text-xs text-slate-300 font-sans">
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />
                      <span>Hang up and dial the official bank/organization branch number directly.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />
                      <span>Perform out-of-band identity verification via known channel.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />
                      <span>Never transfer funds or provide OTPs based solely on voice requests.</span>
                    </li>
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Navigation Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-[rgba(148,163,184,0.12)]">
          <div>
            {currentStep > 1 && (
              <button
                onClick={handlePrev}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-700 border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
            )}
          </div>

          <div>
            {currentStep < TOTAL_STEPS ? (
              <button
                onClick={handleNext}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:from-amber-400 hover:via-orange-400 hover:to-rose-500 shadow-lg shadow-orange-500/25 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Next Step</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={onComplete}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-[#06B6D4] hover:bg-[#22D3EE] shadow-lg shadow-[#22D3EE]/25 active:scale-95 transition-all flex items-center gap-2 cursor-pointer font-mono"
              >
                <Radio className="w-4 h-4" />
                <span>Open Full Detection Workspace</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
