import React, { useState, useRef, useEffect } from 'react';
import { 
  FlaskConical, 
  Play, 
  Pause, 
  RotateCcw, 
  Zap, 
  Volume2, 
  VolumeX, 
  Sliders, 
  ShieldAlert, 
  ShieldCheck, 
  Sparkles, 
  Cpu, 
  Activity, 
  Radio, 
  CheckCircle2, 
  AlertTriangle,
  Fingerprint,
  RefreshCw,
  Globe,
  SlidersHorizontal
} from 'lucide-react';
import { SOURCE_VOICE_SAMPLES, INDIAN_LANGUAGES_COVERAGE } from '../data/mockData';
import { AttackSimulationState, SourceVoiceSample } from '../types';
import { MagneticButton } from '../components/motion/MagneticButton';
import { MotionCard } from '../components/motion/MotionCard';

export const AttackSimulationView: React.FC = () => {
  const [selectedSourceId, setSelectedSourceId] = useState<string>('src-rajesh');
  const [selectedLanguageCode, setSelectedLanguageCode] = useState<string>('en-in');
  const [synthesisEngine, setSynthesisEngine] = useState<AttackSimulationState['synthesisEngine']>('VITS_DIFFUSION');
  
  // Adversarial perturbation sliders
  const [pitchFlattenRate, setPitchFlattenRate] = useState<number>(82);
  const [spectralArtifactIntensity, setSpectralArtifactIntensity] = useState<number>(88);
  const [phaseJitterRate, setPhaseJitterRate] = useState<number>(76);
  const [glottalIrregularity, setGlottalIrregularity] = useState<number>(84);

  // Generation & playback state
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [synthProgress, setSynthProgress] = useState<number>(0);
  const [isGenerated, setIsGenerated] = useState<boolean>(true);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [detectionResult, setDetectionResult] = useState<AttackSimulationState['detectionResult']>({
    overallRisk: 94,
    classification: 'SYNTHETIC_VOICE_CLONE',
    biomarkers: {
      spectralRolloffAnomaly: 92,
      pitchMicroTremorDeficit: 88,
      stftPhaseDiscontinuity: 95,
      speakerBiometricMismatch: 86,
    },
    detectedVocoder: 'VITS-Diffusion Neural Vocoder (p=0.982)',
    defenseAction: 'Immediate 2FA Out-of-Band Callback Enqueued',
    latencyMs: 36.2,
  });

  const selectedSource: SourceVoiceSample = SOURCE_VOICE_SAMPLES.find(s => s.id === selectedSourceId) || SOURCE_VOICE_SAMPLES[0];
  const selectedLanguage = INDIAN_LANGUAGES_COVERAGE.find(l => l.code === selectedLanguageCode) || INDIAN_LANGUAGES_COVERAGE[0];

  // Audio Context for Web Audio API tone synthesis
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const startAudioTone = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      // Set base pitch matching selected executive voice
      osc.type = synthesisEngine === 'VITS_DIFFUSION' ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(selectedSource.pitchBaseHz, audioCtx.currentTime);

      // Pitch micro-flattening vs natural tremor modulation
      const tremorRate = (100 - pitchFlattenRate) / 20; // Human tremor freq ~5Hz
      const tremorAmount = (100 - pitchFlattenRate) * 0.1;
      
      // Simple frequency modulation
      const modOsc = audioCtx.createOscillator();
      const modGain = audioCtx.createGain();
      modOsc.frequency.value = tremorRate;
      modGain.gain.value = tremorAmount;
      modOsc.connect(osc.frequency);
      modOsc.start();

      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();

      oscillatorRef.current = osc;
      gainNodeRef.current = gain;
      setIsPlayingAudio(true);

      // Stop after 4 seconds automatically
      setTimeout(() => {
        stopAudioTone();
      }, 4000);
    } catch {
      setIsPlayingAudio(false);
    }
  };

  const stopAudioTone = () => {
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
      } catch (e) {}
      oscillatorRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
    setIsPlayingAudio(false);
  };

  useEffect(() => {
    return () => {
      stopAudioTone();
    };
  }, []);

  // Handle Synthesis Generation
  const handleGenerateClone = () => {
    setIsSynthesizing(true);
    setSynthProgress(0);
    setIsGenerated(false);

    let current = 0;
    const interval = setInterval(() => {
      current += 15;
      if (current >= 100) {
        clearInterval(interval);
        setSynthProgress(100);
        setIsSynthesizing(false);
        setIsGenerated(true);
        handleRunDetector();
      } else {
        setSynthProgress(current);
      }
    }, 120);
  };

  // Handle Running Detector on Synthesized Sample
  const handleRunDetector = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      const avgArtifact = (pitchFlattenRate + spectralArtifactIntensity + phaseJitterRate + glottalIrregularity) / 4;
      const risk = Math.min(99, Math.max(12, Math.round(avgArtifact)));

      setDetectionResult({
        overallRisk: risk,
        classification: risk >= 60 ? 'SYNTHETIC_VOICE_CLONE' : 'NATURAL_HUMAN_VOICE',
        biomarkers: {
          spectralRolloffAnomaly: spectralArtifactIntensity,
          pitchMicroTremorDeficit: pitchFlattenRate,
          stftPhaseDiscontinuity: phaseJitterRate,
          speakerBiometricMismatch: Math.round(glottalIrregularity * 0.95),
        },
        detectedVocoder: `${synthesisEngine.replace('_', '-')} Neural Architecture (p=0.984)`,
        defenseAction: risk >= 75 
          ? 'Mandatory Out-of-Band 2FA Callback Enqueued' 
          : risk >= 50 
          ? 'Operator Whisper Alert Dispatched' 
          : 'Verified Natural Voice (Allowed)',
        latencyMs: Number((32 + Math.random() * 6).toFixed(1)),
      });
      setIsAnalyzing(false);
    }, 450);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-16">
      
      {/* Top Header */}
      <div className="card-raised p-lg flex flex-col md:flex-row md:items-center justify-between gap-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/30 shadow-inner">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-page-title">
                Adversarial Attack Simulation Lab
              </h1>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/30 font-mono uppercase tracking-wider">
                RED-TEAM BENCH
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Stress-test VeriVox neural detection boundaries against fine-tuned Indic synthesis engines
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-slate-400 bg-[#05070B] px-3 py-1.5 rounded-lg border border-[rgba(148,163,184,0.12)]">
            Consortium EER: <strong className="text-[#10B981]">1.18%</strong>
          </span>
          <span className="text-slate-400 bg-[#05070B] px-3 py-1.5 rounded-lg border border-[rgba(148,163,184,0.12)]">
            Engines Covered: <strong className="text-[#22D3EE]">6 Neural Vocoders</strong>
          </span>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Synthesis Configuration & Generator Controls (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* Step 1: Select Executive Source Target */}
          <div className="card-raised p-lg space-y-md\">
            <div className="flex items-center justify-between pb-2 border-b border-[rgba(148,163,184,0.12)]">
              <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-300 flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-[#8B5CF6]" />
                <span>1. Select Executive Voice Target to Clone</span>
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">
                {SOURCE_VOICE_SAMPLES.length} Enrolled Profiles
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SOURCE_VOICE_SAMPLES.map((sample) => {
                const isSelected = sample.id === selectedSourceId;
                return (
                  <MotionCard
                    key={sample.id}
                    accentColor="#8B5CF6"
                    liftAmount={-2}
                    onClick={() => setSelectedSourceId(sample.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/60 shadow-md shadow-[#8B5CF6]/10'
                        : 'bg-[#05070B] border-[rgba(148,163,184,0.12)] hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-white text-xs">{sample.name}</div>
                      <span className="text-[9px] font-mono text-slate-400 bg-[#0B1120] px-1.5 py-0.5 rounded border border-[rgba(148,163,184,0.12)]">
                        {sample.pitchBaseHz}Hz
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">{sample.role}</div>
                    <div className="text-[10px] text-[#22D3EE] font-mono mt-1 truncate">{sample.accent}</div>
                  </MotionCard>
                );
              })}
            </div>

            {/* Target Sample Quote preview */}
            <div className="p-3 rounded-lg bg-[#05070B] border border-[rgba(148,163,184,0.12)] text-xs font-mono space-y-1">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Voiceprint Sample Phrasing:</div>
              <p className="text-slate-300 italic">
                "{selectedSource.sampleText}"
              </p>
            </div>
          </div>

          {/* Step 2: Synthesis Engine & Language Selection */}
          <div className="card-raised p-lg space-y-md\">
            <div className="flex items-center justify-between pb-2 border-b border-[rgba(148,163,184,0.12)]">
              <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-300 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#22D3EE]" />
                <span>2. Synthesis Architecture &amp; Indic Language</span>
              </h3>
            </div>

            {/* Synthesis Engine selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400">Neural Synthesis Model:</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                {[
                  { id: 'VITS_DIFFUSION', label: 'VITS Diffusion v2' },
                  { id: 'HIFI_GAN_NEURAL', label: 'HiFi-GAN Neural' },
                  { id: 'RVC_V2_VOICECHANGER', label: 'RVC v2 VoiceChanger' },
                  { id: 'STYLETTS_2', label: 'StyleTTS-2' },
                  { id: 'ELEVENLABS_V2', label: 'ElevenLabs Fine-Tune' },
                ].map((engine) => (
                  <button
                    key={engine.id}
                    onClick={() => setSynthesisEngine(engine.id as any)}
                    className={`p-2 rounded-lg border text-left font-semibold transition-all ${
                      synthesisEngine === engine.id
                        ? 'bg-[#22D3EE]/15 border-[#22D3EE] text-[#22D3EE]'
                        : 'bg-[#05070B] border-[rgba(148,163,184,0.12)] text-slate-400 hover:text-white'
                    }`}
                  >
                    {engine.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Indic Language Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-[#22D3EE]" />
                <span>Target Language / Accent Vector:</span>
              </label>
              <select
                value={selectedLanguageCode}
                onChange={(e) => setSelectedLanguageCode(e.target.value)}
                className="w-full py-2 px-3 rounded-lg bg-[#05070B] border border-[rgba(148,163,184,0.12)] text-xs text-white font-mono focus:outline-none focus:border-[#22D3EE]"
              >
                {INDIAN_LANGUAGES_COVERAGE.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name} ({lang.nativeName}) — {lang.region}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {/* Step 3: Adversarial Acoustic Perturbation Sliders */}
          <div className="card-raised p-lg space-y-md\">
            <div className="flex items-center justify-between pb-2 border-b border-[rgba(148,163,184,0.12)]">
              <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-300 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                <span>3. Adversarial Perturbation Parameters</span>
              </h3>
              <span className="text-[10px] text-amber-400 font-mono">
                Acoustic Injections
              </span>
            </div>

            <div className="space-y-4 text-xs font-mono">
              
              {/* Pitch Flatline */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Pitch Micro-Flatten Rate (Eliminate Biological Tremor):</span>
                  <strong className="text-[#EF4444]">{pitchFlattenRate}%</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={pitchFlattenRate}
                  onChange={(e) => setPitchFlattenRate(Number(e.target.value))}
                  className="w-full accent-[#EF4444] cursor-pointer"
                />
              </div>

              {/* Spectral Artifact Intensity */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>2.2kHz–4.2kHz Vocoder Spectral Distortion:</span>
                  <strong className="text-[#22D3EE]">{spectralArtifactIntensity}%</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={spectralArtifactIntensity}
                  onChange={(e) => setSpectralArtifactIntensity(Number(e.target.value))}
                  className="w-full accent-[#22D3EE] cursor-pointer"
                />
              </div>

              {/* STFT Phase Jitter */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>STFT Phase Incoherence / Jitter:</span>
                  <strong className="text-[#8B5CF6]">{phaseJitterRate}%</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={phaseJitterRate}
                  onChange={(e) => setPhaseJitterRate(Number(e.target.value))}
                  className="w-full accent-[#8B5CF6] cursor-pointer"
                />
              </div>

            </div>

            {/* Synthesize Action Trigger Button with Magnetic Hover */}
            <div className="pt-2">
              <MagneticButton
                onClick={handleGenerateClone}
                disabled={isSynthesizing}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-[#F97316] to-[#EF4444] hover:opacity-90 text-white font-bold text-xs uppercase tracking-wider font-mono shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Zap className={`w-4 h-4 ${isSynthesizing ? 'animate-bounce' : ''}`} />
                <span>{isSynthesizing ? `Synthesizing Neural Diffusion Vector (${synthProgress}%)...` : 'Generate Synthetic Voice Clone & Run Detector'}</span>
              </MagneticButton>
            </div>

          </div>

        </div>

        {/* RIGHT COLUMN: Real-Time Audio Output & VeriVox Forensic Evaluation (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* Synthesized Audio Player Card */}
          <div className="card-elevated p-lg space-y-md\">
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(148,163,184,0.12)]">
              <div className="flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-[#22D3EE]" />
                <h3 className="text-sm font-bold font-slab text-white">
                  Synthesized Adversarial Audio Ingest
                </h3>
              </div>
              <span className="text-[10px] font-mono text-[#10B981] bg-[#10B981]/15 px-2 py-0.5 rounded border border-[#10B981]/30 uppercase">
                16kHz PCM READY
              </span>
            </div>

            {/* Waveform Visual representation */}
            <div className="p-4 rounded-lg bg-[#05070B] border border-[rgba(148,163,184,0.12)] space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Clone Target: <strong className="text-white">{selectedSource.name}</strong></span>
                <span>Language: <strong className="text-[#22D3EE]">{selectedLanguage.name}</strong></span>
              </div>

              {/* Dynamic waveform bars */}
              <div className="h-16 flex items-center justify-center gap-1 overflow-hidden py-1">
                {Array.from({ length: 48 }).map((_, i) => {
                  const barHeight = isPlayingAudio 
                    ? Math.max(15, Math.sin(i * 0.4 + Date.now() * 0.005) * 80 + Math.random() * 20)
                    : Math.max(10, Math.sin(i * 0.3) * 60);
                  const isAnomaly = i >= 18 && i <= 32;

                  return (
                    <div
                      key={i}
                      className={`w-1 rounded-full transition-all duration-150 ${
                        isAnomaly 
                          ? 'bg-[#EF4444] shadow-[0_0_6px_#EF4444]' 
                          : 'bg-[#22D3EE]'
                      }`}
                      style={{ height: `${barHeight}%` }}
                    />
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={isPlayingAudio ? stopAudioTone : startAudioTone}
                  className="px-4 py-2 rounded-lg bg-[#22D3EE] hover:bg-[#06B6D4] text-[#05070B] font-bold text-xs font-mono uppercase tracking-wider flex items-center gap-2 shadow transition-colors"
                >
                  {isPlayingAudio ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>{isPlayingAudio ? 'Stop Playback' : 'Listen Synthesized Audio (Web Audio API)'}</span>
                </button>

                <div className="text-[10px] font-mono text-slate-400">
                  4.0s PCM Ingest
                </div>
              </div>
            </div>

          </div>

          {/* VeriVox Live Detection Verdict Panel */}
          {detectionResult && (
            <div className="card-elevated p-lg space-y-md">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(148,163,184,0.12)]">
                <div>
                  <div className="text-[10px] uppercase font-mono text-slate-400">VERIVOX MULTI-STAGE INFERENCE</div>
                  <h3 className="text-base font-bold font-slab text-white">Detection Classification &amp; Biomarkers</h3>
                </div>
                <span className="font-mono text-xs text-slate-400 bg-[#05070B] px-2.5 py-1 rounded border border-[rgba(148,163,184,0.12)]">
                  Inference: <strong className="text-[#10B981]">{detectionResult.latencyMs}ms</strong>
                </span>
              </div>

              {/* Main Score Box */}
              <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                detectionResult.overallRisk >= 70
                  ? 'bg-[rgba(239,68,68,0.12)] border-[#EF4444]/40 text-[#EF4444]'
                  : 'bg-[#10B981]/10 border-[#10B981]/40 text-[#10B981]'
              }`}>
                <div className="flex items-center gap-3">
                  {detectionResult.overallRisk >= 70 ? (
                    <ShieldAlert className="w-8 h-8 flex-shrink-0 text-[#EF4444]" />
                  ) : (
                    <ShieldCheck className="w-8 h-8 flex-shrink-0 text-[#10B981]" />
                  )}
                  <div>
                    <div className="text-xs uppercase font-mono font-bold">
                      {detectionResult.classification.replace(/_/g, ' ')}
                    </div>
                    <div className="text-[11px] text-slate-300 font-mono mt-0.5">
                      {detectionResult.detectedVocoder}
                    </div>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <div className="text-2xl font-bold text-white">{detectionResult.overallRisk}%</div>
                  <div className="text-[10px] text-slate-400 uppercase">Threat Index</div>
                </div>
              </div>

              {/* Biomarkers Breakdown */}
              <div className="space-y-3 text-xs font-mono">
                <div className="text-[11px] uppercase font-bold text-slate-400">Acoustic Biomarker Vector Decomposition:</div>

                <div className="space-y-2">
                  <div className="p-2.5 rounded-lg bg-[#05070B] border border-[rgba(148,163,184,0.12)] flex items-center justify-between">
                    <span className="text-slate-300">STFT Phase Discontinuity (2-4kHz):</span>
                    <span className="text-[#EF4444] font-bold">{detectionResult.biomarkers.stftPhaseDiscontinuity}%</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#05070B] border border-[rgba(148,163,184,0.12)] flex items-center justify-between">
                    <span className="text-slate-300">Pitch Micro-Tremor Deficit (Flatline):</span>
                    <span className="text-[#EF4444] font-bold">{detectionResult.biomarkers.pitchMicroTremorDeficit}%</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#05070B] border border-[rgba(148,163,184,0.12)] flex items-center justify-between">
                    <span className="text-slate-300">Speaker Biometric Cosine Divergence:</span>
                    <span className="text-amber-400 font-bold">{detectionResult.biomarkers.speakerBiometricMismatch}%</span>
                  </div>
                </div>
              </div>

              {/* Automated SOC Policy Trigger */}
              <div className="p-3 rounded-lg bg-[#05070B] border border-[rgba(148,163,184,0.12)] text-xs font-mono space-y-1">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Automated Policy Enforcement:</div>
                <div className="text-[#10B981] font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{detectionResult.defenseAction}</span>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
};
