import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Phone, 
  PhoneOff, 
  PhoneCall, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  AlertOctagon, 
  Clock, 
  User, 
  Building, 
  CreditCard, 
  CheckCircle2, 
  XCircle, 
  Zap, 
  Radio, 
  Download, 
  Sparkles, 
  Activity, 
  ArrowUpRight, 
  FileText, 
  Lock, 
  Sliders, 
  SlidersHorizontal,
  ChevronRight,
  Info,
  Check
} from 'lucide-react';
import { RiskGauge } from '../components/RiskGauge';
import { WaveformVisualizer } from '../components/WaveformVisualizer';
import { DemoScenario, DetectionScores, SecurityEventLog } from '../types';
import { CLONED_CXO_SCENARIO, GENUINE_CXO_SCENARIO } from '../data/mockData';

export const LiveDashboardView: React.FC = () => {
  const [selectedScenarioId, setSelectedScenarioId] = useState<'cloned-cxo' | 'genuine-cxo' | 'custom'>('cloned-cxo');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [callDurationSeconds, setCallDurationSeconds] = useState<number>(0);
  const [eventLogs, setEventLogs] = useState<SecurityEventLog[]>([]);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [showForensicModal, setShowForensicModal] = useState<boolean>(false);
  
  // Custom slider values for manual judge testing
  const [customRiskSlider, setCustomRiskSlider] = useState<number>(85);
  const [customSpectralSlider, setCustomSpectralSlider] = useState<number>(88);
  const [customProsodySlider, setCustomProsodySlider] = useState<number>(24);
  const [customPitchSlider, setCustomPitchSlider] = useState<number>(82);

  const scenario: DemoScenario = selectedScenarioId === 'genuine-cxo' 
    ? GENUINE_CXO_SCENARIO 
    : CLONED_CXO_SCENARIO;

  const currentStep = scenario.steps[Math.min(currentStepIndex, scenario.steps.length - 1)];

  // Derived current scores based on mode
  const currentScores: DetectionScores = selectedScenarioId === 'custom' 
    ? {
        overallRisk: customRiskSlider,
        spectralArtifacts: customSpectralSlider,
        prosodyNaturalness: customProsodySlider,
        pitchMicroVariation: customPitchSlider,
        crossSessionMatch: Math.max(0, 100 - customRiskSlider),
        glottalPulseDiscontinuity: customSpectralSlider,
        temporalJitter: customPitchSlider,
        phaseIncoherence: customSpectralSlider,
        speakerMismatchScore: customRiskSlider,
        inferenceLatencyMs: 36,
        detectionStatus: customRiskSlider >= 70 
          ? 'High Risk — Cloned Voice Detected' 
          : customRiskSlider >= 40 
          ? 'Elevated Risk — Anomaly Detected' 
          : 'Low Risk — Natural Speech',
      }
    : currentStep.scores;

  // Auto-play simulation interval
  useEffect(() => {
    let timer: any;
    if (isPlaying && selectedScenarioId !== 'custom') {
      timer = setInterval(() => {
        setCallDurationSeconds((prev) => prev + 1);

        setCurrentStepIndex((prevIdx) => {
          const nextIdx = prevIdx + 1;
          if (nextIdx < scenario.steps.length) {
            const nextStep = scenario.steps[nextIdx];
            if (nextStep.event) {
              setEventLogs((logs) => {
                if (!logs.some(l => l.id === nextStep.event?.id)) {
                  return [nextStep.event!, ...logs];
                }
                return logs;
              });
            }
            return nextIdx;
          } else {
            // Reached end of scenario, pause simulation
            setIsPlaying(false);
            return prevIdx;
          }
        });
      }, 2200);
    }

    return () => clearInterval(timer);
  }, [isPlaying, selectedScenarioId, scenario]);

  // Reset or Switch Scenario
  const handleSelectScenario = (id: 'cloned-cxo' | 'genuine-cxo' | 'custom') => {
    setSelectedScenarioId(id);
    setCurrentStepIndex(0);
    setCallDurationSeconds(0);
    setIsPlaying(true);
    setActionNotice(null);

    const initialScenario = id === 'genuine-cxo' ? GENUINE_CXO_SCENARIO : CLONED_CXO_SCENARIO;
    if (initialScenario.steps[0].event) {
      setEventLogs([initialScenario.steps[0].event]);
    } else {
      setEventLogs([]);
    }
  };

  const handleRestart = () => {
    setCurrentStepIndex(0);
    setCallDurationSeconds(0);
    setIsPlaying(true);
    setActionNotice(null);
    setEventLogs(scenario.steps[0].event ? [scenario.steps[0].event] : []);
  };

  // Trigger SOC automated action
  const handleTriggerAction = (actionName: string) => {
    const newLog: SecurityEventLog = {
      id: `EVT-ACTION-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      relativeTimeSec: callDurationSeconds,
      level: 'critical',
      category: 'Action',
      message: `Enforcement Executed: ${actionName}`,
      metricDetail: `Operator triggered immediate protocol under SIH26104 policy rule #1`,
    };
    setEventLogs((prev) => [newLog, ...prev]);
    setActionNotice(`✓ Action confirmed: "${actionName}" applied to active session.`);
    setTimeout(() => setActionNotice(null), 5000);
  };

  // Format call duration MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainderSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainderSecs.toString().padStart(2, '0')}`;
  };

  const isAlertThresholdPassed = currentScores.overallRisk >= 70;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      
      {/* Top Header & Scenario Controller Bar */}
      <div className="card-elevated flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5">
        
        {/* Title & Live Status */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[#2E7DFF]/15 text-[#2E7DFF] border border-[#2E7DFF]/30">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="heading-subsection">
                Live SOC Call Inspection Console
              </h1>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30 flex items-center gap-1.5 font-mono uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-ping"></span>
                ACTIVE MONITOR
              </span>
            </div>
            <p className="text-body-small mt-1 text-slate-300">
              Smart India Hackathon 2026 · Real-Time Edge Synthesized Voice Analysis
            </p>
          </div>
        </div>

        {/* Scenario Selector Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleSelectScenario('cloned-cxo')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              selectedScenarioId === 'cloned-cxo'
                ? 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/50 shadow-md shadow-[#EF4444]/20 font-bold'
                : 'bg-transparent text-slate-400 border border-[rgba(148,163,184,0.3)] hover:text-[#E2E8F0] hover:border-[rgba(148,163,184,0.5)]'
            }`}
          >
            <ShieldAlert className="icon-sm icon-danger" />
            <span>Scenario A: Cloned CFO (Attack)</span>
          </button>

          <button
            onClick={() => handleSelectScenario('genuine-cxo')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              selectedScenarioId === 'genuine-cxo'
                ? 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/50 shadow-md shadow-[#22C55E]/20 font-bold'
                : 'bg-transparent text-slate-400 border border-[rgba(148,163,184,0.3)] hover:text-[#E2E8F0] hover:border-[rgba(148,163,184,0.5)]'
            }`}
          >
            <ShieldCheck className="icon-sm icon-success" />
            <span>Scenario B: Genuine VP (Natural)</span>
          </button>

          <button
            onClick={() => handleSelectScenario('custom')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              selectedScenarioId === 'custom'
                ? 'bg-[#2E7DFF]/15 text-[#2E7DFF] border-[#2E7DFF]/50 shadow-md shadow-[#2E7DFF]/20 font-bold'
                : 'bg-transparent text-slate-400 border border-[rgba(148,163,184,0.3)] hover:text-[#E2E8F0] hover:border-[rgba(148,163,184,0.5)]'
            }`}
          >
            <Sliders className="icon-sm icon-primary" />
            <span>Interactive Simulator</span>
          </button>

          {/* Play / Pause / Replay Controls */}
          {selectedScenarioId !== 'custom' && (
            <div className="flex items-center gap-1 bg-[#0A0E17] p-1 rounded-lg border border-[#1F2937]">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-1.5 rounded bg-[#131A2A] hover:bg-slate-800 text-[#E2E8F0] transition-colors"
                title={isPlaying ? 'Pause Simulation' : 'Resume Simulation'}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleRestart}
                className="p-1.5 rounded bg-[#131A2A] hover:bg-slate-800 text-[#E2E8F0] transition-colors"
                title="Restart Scenario"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main SOC Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Caller Profile Card + Sub-Scores (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Caller Identity Card */}
          <div className="card-raised p-5 space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-[#1F2937]">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded bg-[#0A0E17] flex items-center justify-center text-white font-bold font-display border border-[#1F2937]">
                    {scenario.callerProfile.claimedName.split(' ').map(n => n[0]).join('')}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#131A2A] ${
                    isAlertThresholdPassed ? 'bg-[#EF4444] animate-ping' : 'bg-[#22C55E]'
                  }`} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5 font-display">
                    <span>{scenario.callerProfile.claimedName}</span>
                    <span className="text-[10px] font-normal text-slate-400">({scenario.callerProfile.claimedRole})</span>
                  </h3>
                  <div className="text-xs font-mono text-slate-400 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-500" />
                    <span>{scenario.callerProfile.phoneNumber}</span>
                  </div>
                </div>
              </div>

              {/* Running Call Timer */}
              <div className="text-right">
                <div className="inline-flex items-center gap-1 font-mono text-xs font-bold text-[#22C55E] bg-[#0A0E17] px-2.5 py-1 rounded border border-[#1F2937]">
                  <Clock className="w-3 h-3" />
                  <span>{formatTime(callDurationSeconds)}</span>
                </div>
                <div className="text-[9px] uppercase font-mono tracking-wider text-slate-500 mt-0.5">Session Active</div>
              </div>
            </div>

            {/* Contextual Chips */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-[#0A0E17] border border-[#1F2937]">
                <div className="text-slate-500 text-[10px] uppercase tracking-wider">Carrier Origin:</div>
                <div className="text-[#E2E8F0] font-medium truncate mt-0.5" title={scenario.callerProfile.carrier}>
                  {scenario.callerProfile.carrier}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0A0E17] border border-[#1F2937]">
                <div className="text-slate-500 text-[10px] uppercase tracking-wider">CLI Verification:</div>
                <div className={`font-semibold text-[11px] mt-0.5 ${
                  scenario.callerProfile.carrierIdStatus.includes('Unverified') 
                    ? 'text-amber-400' 
                    : 'text-[#22C55E]'
                }`}>
                  {scenario.callerProfile.carrierIdStatus}
                </div>
              </div>
            </div>

            {/* High-Risk Transaction Context Callout */}
            {scenario.callerProfile.transactionContext && (
              <div className={`p-3 rounded-lg border transition-all ${
                isAlertThresholdPassed 
                  ? 'bg-[#EF4444]/10 border-[#EF4444]/40 text-[#EF4444]' 
                  : 'bg-[#0A0E17] border-[#1F2937] text-slate-300'
              }`}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold flex items-center gap-1.5 text-slate-200">
                    <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                    <span>Transaction Intent:</span>
                  </span>
                  <span className="font-bold font-mono text-amber-400 text-sm">
                    ₹{scenario.callerProfile.transactionContext.amountInr.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {scenario.callerProfile.transactionContext.type} · Beneficiary: <strong className="text-slate-200">{scenario.callerProfile.transactionContext.beneficiaryName}</strong>
                </div>
              </div>
            )}

            {/* Voiceprint Enrollment Tag */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 font-mono">
              <span>Voiceprint ID: <strong className="text-slate-300">{scenario.callerProfile.registeredVoiceprintId}</strong></span>
              <span className="text-[#22C55E] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Enrolled 128-D MFCC
              </span>
            </div>

          </div>

          {/* Sub-Scores Breakdown Panel */}
          <div className="p-5 rounded-xl bg-[#131A2A] border border-[#1F2937] shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2 font-mono">
                <Activity className="w-3.5 h-3.5 text-[#2E7DFF]" />
                <span>Acoustic &amp; Prosodic Sub-Scores</span>
              </h3>
              <span className="text-[9px] text-[#2E7DFF] font-mono uppercase tracking-wider bg-[#2E7DFF]/10 px-1.5 py-0.5 rounded border border-[#2E7DFF]/20">
                WEIGHTED FUSION
              </span>
            </div>

            <div className="space-y-3.5 text-xs">
              
              {/* 1. Spectral Artifacts */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span>Spectral Vocoder Artifacts</span>
                    <Info className="w-3 h-3 text-slate-500" title="High-frequency phase distortion and phase discontinuities in 2-4kHz band" />
                  </span>
                  <span className="font-mono font-bold text-white">{Math.round(currentScores.spectralArtifacts)}%</span>
                </div>
                <div className="h-1.5 w-full bg-[#0A0E17] rounded-full overflow-hidden border border-[#1F2937]">
                  <div 
                    className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-[#2E7DFF] via-amber-500 to-[#EF4444]"
                    style={{ width: `${currentScores.spectralArtifacts}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Natural Resonance</span>
                  <span>Neural Vocoder Artifacts</span>
                </div>
              </div>

              {/* 2. Prosody Naturalness */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Prosody &amp; Glottal Naturalness</span>
                  <span className="font-mono font-bold text-white">{Math.round(currentScores.prosodyNaturalness)}%</span>
                </div>
                <div className="h-1.5 w-full bg-[#0A0E17] rounded-full overflow-hidden border border-[#1F2937]">
                  <div 
                    className="h-full rounded-full transition-all duration-700 bg-[#22C55E]"
                    style={{ width: `${currentScores.prosodyNaturalness}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Monotone Synthetic</span>
                  <span>Authentic Dynamic Inflection</span>
                </div>
              </div>

              {/* 3. Pitch Micro-variation */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Pitch Micro-Flatline Anomaly</span>
                  <span className="font-mono font-bold text-white">{Math.round(currentScores.pitchMicroVariation)}%</span>
                </div>
                <div className="h-1.5 w-full bg-[#0A0E17] rounded-full overflow-hidden border border-[#1F2937]">
                  <div 
                    className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-[#3AC1FF] to-amber-500"
                    style={{ width: `${currentScores.pitchMicroVariation}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Biological Tremor</span>
                  <span>Flatline Synthetic TTS</span>
                </div>
              </div>

              {/* 4. Cross-Session Match */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Cross-Session Voiceprint Match</span>
                  <span className="font-mono font-bold text-white">{Math.round(currentScores.crossSessionMatch)}%</span>
                </div>
                <div className="h-1.5 w-full bg-[#0A0E17] rounded-full overflow-hidden border border-[#1F2937]">
                  <div 
                    className="h-full rounded-full transition-all duration-700 bg-[#2E7DFF]"
                    style={{ width: `${currentScores.crossSessionMatch}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Divergent Biometrics</span>
                  <span>Exact Vector Alignment</span>
                </div>
              </div>

            </div>

            {/* Forensic deep dive button */}
            <button
              onClick={() => setShowForensicModal(true)}
              className="w-full mt-2 py-2 rounded-lg bg-[#0A0E17] hover:bg-[#1A2338] border border-[#1F2937] text-xs font-semibold text-[#2E7DFF] hover:text-[#3AC1FF] flex items-center justify-center gap-1.5 transition-colors font-mono uppercase tracking-wider"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Inspect Full Acoustic Forensic Spectrum</span>
            </button>
          </div>

        </div>

        {/* RIGHT COLUMN: Centerpiece Risk Gauge + Live Waveform + Alerts + Live Timeline (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Centerpiece Gauge & Waveform Panel */}
          <div className="p-6 rounded-xl bg-[#131A2A] border border-[#1F2937] shadow-xl space-y-6">
            
            {/* Top Risk Header */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-2 border-b border-[#1F2937]">
              <div className="text-center sm:text-left">
                <div className="text-[11px] uppercase font-mono tracking-wider text-slate-400">
                  Real-Time Threat Calculation
                </div>
                <h2 className="text-lg font-bold font-display text-white tracking-tight">
                  Synthetic Speech Risk Index
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-slate-400 bg-[#0A0E17] px-2.5 py-1 rounded border border-[#1F2937]">
                  Inference: <strong className="text-[#22C55E]">{currentScores.inferenceLatencyMs}ms</strong>
                </span>
                <span className="font-mono text-xs text-slate-400 bg-[#0A0E17] px-2.5 py-1 rounded border border-[#1F2937]">
                  Engine: <strong className="text-[#2E7DFF]">ResNet-Acoustics</strong>
                </span>
              </div>
            </div>

            {/* Center Gauge View */}
            <div className="py-2 flex flex-col items-center justify-center">
              <RiskGauge
                score={currentScores.overallRisk}
                status={currentScores.detectionStatus}
                size={200}
                strokeWidth={16}
              />
            </div>

            {/* Interactive sliders for custom testing */}
            {selectedScenarioId === 'custom' && (
              <div className="p-4 rounded-lg bg-[#0A0E17] border border-[#2E7DFF]/30 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-[#2E7DFF] font-mono">
                  <span className="flex items-center gap-1.5">
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>Jury Interactive Controls (Live Parameter Sliders)</span>
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase">Live Reactivity</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 flex justify-between font-mono">
                      <span>Simulated Risk Score:</span>
                      <strong className="text-white font-mono">{customRiskSlider}%</strong>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={customRiskSlider}
                      onChange={(e) => setCustomRiskSlider(Number(e.target.value))}
                      className="w-full mt-1 accent-[#2E7DFF] cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 flex justify-between font-mono">
                      <span>Vocoder Spectral Distortion:</span>
                      <strong className="text-white font-mono">{customSpectralSlider}%</strong>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={customSpectralSlider}
                      onChange={(e) => setCustomSpectralSlider(Number(e.target.value))}
                      className="w-full mt-1 accent-[#EF4444] cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Continuous Live Waveform & Spectrogram Strip */}
            <div>
              <div className="text-[11px] text-slate-400 mb-1.5 flex items-center justify-between font-mono uppercase tracking-wider">
                <span>ACOUSTIC SPECTRUM STREAM</span>
                <span className="text-[#22C55E] text-[10px]">16kHz LINEAR PCM</span>
              </div>
              <WaveformVisualizer
                intensity={currentStep.waveformIntensity}
                riskScore={currentScores.overallRisk}
                anomalyBand={currentStep.audioFrequencyAnomalyZone}
                isCallActive={true}
                latencyMs={currentScores.inferenceLatencyMs}
              />
            </div>

            {/* High Risk Alert Banner (Appears past ~70 score) */}
            {isAlertThresholdPassed && (
              <div className="p-4 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/40 space-y-3 shadow-lg shadow-[#EF4444]/10 animate-pulse-subtle">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40 flex-shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white uppercase tracking-wider font-display">
                        High Risk: Synthetic Voice Clone Detected
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#EF4444] text-white font-bold uppercase font-mono">
                        CRITICAL
                      </span>
                    </div>
                    <p className="text-xs text-rose-200/90 leading-relaxed font-mono">
                      Deep neural vocoder spectral artifacts detected with pitch micro-flatline anomaly. Recommend immediate out-of-band biometric callback before approving wire transactions.
                    </p>
                  </div>
                </div>

                {/* Enforcement Action Buttons */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-[#EF4444]/20">
                  <button
                    onClick={() => handleTriggerAction('Mandatory 2FA Callback Triggered')}
                    className="px-3 py-1.5 rounded bg-[#EF4444] hover:bg-[#D43A3A] text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Trigger 2FA Callback</span>
                  </button>

                  <button
                    onClick={() => handleTriggerAction('Transaction Quarantined & Wire Freeze')}
                    className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Freeze ₹15L Transfer</span>
                  </button>

                  <button
                    onClick={() => handleTriggerAction('Escalated to CISO & Cyber Security Desk')}
                    className="px-3 py-1.5 rounded bg-[#0A0E17] hover:bg-slate-800 text-[#E2E8F0] border border-[#1F2937] text-xs font-semibold uppercase tracking-wider transition-colors flex items-center gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Escalate to CISO</span>
                  </button>

                  <button
                    onClick={() => handleTriggerAction('Call Terminated via SIP Disconnect')}
                    className="px-3 py-1.5 rounded bg-[#0A0E17] hover:bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30 text-xs font-semibold uppercase tracking-wider transition-colors flex items-center gap-1.5"
                  >
                    <PhoneOff className="w-3.5 h-3.5" />
                    <span>Drop Call</span>
                  </button>
                </div>

                {/* Feedback confirmation banner */}
                {actionNotice && (
                  <div className="p-2.5 rounded bg-[#22C55E]/10 border border-[#22C55E]/40 text-[#22C55E] text-xs flex items-center gap-2 animate-fadeIn font-mono">
                    <Check className="w-4 h-4 flex-shrink-0" />
                    <span>{actionNotice}</span>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Real-Time Security Event Timeline */}
          <div className="p-5 rounded-xl bg-[#131A2A] border border-[#1F2937] shadow-lg space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#1F2937]">
              <h3 className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#2E7DFF] animate-pulse" />
                <span>Live Event Timeline</span>
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">
                {eventLogs.length} Events Logged
              </span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {eventLogs.length === 0 ? (
                <div className="text-xs text-slate-500 py-3 text-center font-mono">
                  Waiting for incoming call packets...
                </div>
              ) : (
                eventLogs.map((log) => {
                  let badgeColor = 'bg-[#2E7DFF]/15 text-[#2E7DFF] border-[#2E7DFF]/30';
                  if (log.level === 'critical') badgeColor = 'bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/30 font-bold';
                  if (log.level === 'warn') badgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';

                  return (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-lg bg-[#0A0E17] border border-[#1F2937] flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase font-mono font-bold ${badgeColor}`}>
                            {log.category}
                          </span>
                          <span className="font-semibold text-[#E2E8F0]">{log.message}</span>
                        </div>
                        {log.metricDetail && (
                          <div className="text-[11px] text-slate-400 font-mono">
                            {log.metricDetail}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 opacity-60 flex-shrink-0">
                        {log.timestamp}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Forensic Deep-Dive Modal */}
      {showForensicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-3xl rounded-xl bg-[#131A2A] border border-[#1F2937] shadow-2xl p-6 space-y-5 overflow-hidden text-[#E2E8F0]">
            
            <div className="flex items-center justify-between border-b border-[#1F2937] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#2E7DFF]/15 text-[#2E7DFF] border border-[#2E7DFF]/30">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-display">
                    Acoustic Forensic Analysis &amp; Incident Dossier
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Session ID: {scenario.callerProfile.id} · Smart India Hackathon 2026 Audit
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowForensicModal(false)}
                className="p-1.5 rounded bg-[#0A0E17] text-slate-400 hover:text-white border border-[#1F2937]"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-3 rounded-lg bg-[#0A0E17] border border-[#1F2937] space-y-1">
                <div className="text-slate-500 uppercase tracking-wider text-[10px]">Neural Vocoder Footprint</div>
                <div className="text-white font-bold font-mono">VITS-Diffusion v2</div>
                <div className="text-slate-400 text-[11px]">Identified with 98.6% confidence</div>
              </div>

              <div className="p-3 rounded-lg bg-[#0A0E17] border border-[#1F2937] space-y-1">
                <div className="text-slate-500 uppercase tracking-wider text-[10px]">Glottal Pulse Continuity</div>
                <div className="text-[#EF4444] font-bold font-mono">Discontinuous (Δ=8.4)</div>
                <div className="text-slate-400 text-[11px]">Unnatural abrupt transitions</div>
              </div>

              <div className="p-3 rounded-lg bg-[#0A0E17] border border-[#1F2937] space-y-1">
                <div className="text-slate-500 uppercase tracking-wider text-[10px]">Formant Dispersion (F1/F2)</div>
                <div className="text-amber-400 font-bold font-mono">Distorted (Ratio 3.12)</div>
                <div className="text-slate-400 text-[11px]">Vocal tract physics mismatch</div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-[#0A0E17] border border-[#1F2937] space-y-2 text-xs">
              <div className="font-semibold text-slate-300 font-mono uppercase tracking-wider text-[10px]">Forensic Executive Summary</div>
              <p className="text-slate-400 leading-relaxed font-mono">
                The caller identity claimed to be <strong>{scenario.callerProfile.claimedName}</strong> ({scenario.callerProfile.claimedRole}). Acoustic decomposition of 40ms PCM frames revealed severe phase incoherence in the 2.2 kHz - 4.1 kHz spectrum, characteristic of neural vocoder interpolation. The pitch micro-inflection variance scored 0.04 Hz (synthetic flatline threshold &lt; 0.12 Hz). In conjunction with an unverified VoIP SIP carrier origin and urgent ₹15,00,000 transfer demand, the incident was categorized as a <strong>High-Risk Impersonation Attack</strong>.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  const dataStr = JSON.stringify({
                    session: scenario.callerProfile,
                    scores: currentScores,
                    events: eventLogs,
                    sih_reference: 'SIH26104',
                  }, null, 2);
                  const blob = new Blob([dataStr], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `verivox_incident_${scenario.callerProfile.id}.json`;
                  a.click();
                }}
                className="px-4 py-2 rounded-lg bg-[#2E7DFF] hover:bg-[#2566D8] text-white font-semibold text-xs flex items-center gap-1.5 transition-colors font-mono uppercase tracking-wider"
              >
                <Download className="w-4 h-4" />
                <span>Export SIH Incident Dossier (JSON)</span>
              </button>

              <button
                onClick={() => setShowForensicModal(false)}
                className="px-4 py-2 rounded-lg bg-[#0A0E17] text-slate-300 hover:bg-slate-800 text-xs font-semibold border border-[#1F2937]"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
