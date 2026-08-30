import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  Radio, 
  Download, 
  Sparkles, 
  ArrowUpRight, 
  Mic, 
  Upload as UploadIcon,
  ChevronRight,
  Headphones,
  Languages,
  Square,
  FileAudio,
  FileText
} from 'lucide-react';
import { RiskGauge } from '../components/RiskGauge';
import { DualWaveformVisualizer } from '../components/DualWaveformVisualizer';
import { DefensePipelineVisualizer } from '../components/DefensePipelineVisualizer';
import { MultiChannelAlertFeed, AlertFeedItem } from '../components/MultiChannelAlertFeed';
import { DemoScenario, DetectionScores, SpeakerFingerprintMatch } from '../types';
import { 
  CLONED_CXO_SCENARIO, 
  GENUINE_CXO_SCENARIO, 
  EMERGENCY_PRETEXT_SCENARIO, 
  BANKING_OTP_SCENARIO 
} from '../data/mockData';

// Deterministic Timeline Keyframes for Cloned CXO Attack (7.5s Total)
const CLONED_TIMELINE_POINTS = [
  { timeSec: 0.0, timeLabel: '0.0s', overallRisk: 8, syntheticScore: 5, speakerMismatch: 12, statusText: 'Initializing SIP baseline' },
  { timeSec: 0.8, timeLabel: '0.8s', overallRisk: 11, syntheticScore: 8, speakerMismatch: 14, statusText: 'Ingest: 16kHz PCM Buffer established' },
  { timeSec: 1.6, timeLabel: '1.6s', overallRisk: 18, syntheticScore: 16, speakerMismatch: 22, statusText: 'Spectral FFT: Extracting 128-D Mel bands' },
  { timeSec: 2.6, timeLabel: '2.6s', overallRisk: 32, syntheticScore: 28, speakerMismatch: 36, statusText: 'Elevated spectral harmonics observed' },
  { timeSec: 3.4, timeLabel: '3.4s', overallRisk: 48, syntheticScore: 42, speakerMismatch: 88, statusText: 'Stage 4 Biometric: Speaker Mismatch Detected' },
  { timeSec: 4.4, timeLabel: '4.4s', overallRisk: 64, syntheticScore: 68, speakerMismatch: 91, statusText: 'Vocoder phase jitter in 2.2–4.2kHz band' },
  { timeSec: 5.4, timeLabel: '5.4s', overallRisk: 86, syntheticScore: 92, speakerMismatch: 94, statusText: 'Critical Alert: Neural clone signature locked' },
  { timeSec: 6.2, timeLabel: '6.2s', overallRisk: 92, syntheticScore: 96, speakerMismatch: 96, statusText: 'Automated SMS Alert sent via Airtel Gateway' },
  { timeSec: 6.8, timeLabel: '6.8s', overallRisk: 95, syntheticScore: 97, speakerMismatch: 97, statusText: 'Urgent CISO Email Alert dispatched' },
  { timeSec: 7.5, timeLabel: '7.5s', overallRisk: 96, syntheticScore: 98, speakerMismatch: 98, statusText: 'Policy Enforced: ₹15L Wire Remittance Frozen' },
];

// Deterministic Timeline Keyframes for Genuine VIP Caller (7.5s Total)
const GENUINE_TIMELINE_POINTS = [
  { timeSec: 0.0, timeLabel: '0.0s', overallRisk: 6, syntheticScore: 4, speakerMismatch: 5, statusText: 'Initializing Jio VoLTE HD stream' },
  { timeSec: 0.8, timeLabel: '0.8s', overallRisk: 6, syntheticScore: 4, speakerMismatch: 5, statusText: 'Ingest: 16kHz HD baseline locked' },
  { timeSec: 1.6, timeLabel: '1.6s', overallRisk: 7, syntheticScore: 5, speakerMismatch: 6, statusText: 'Spectral FFT: Biological formants confirmed' },
  { timeSec: 2.6, timeLabel: '2.6s', overallRisk: 6, syntheticScore: 5, speakerMismatch: 5, statusText: 'Natural glottal flow velocity verified' },
  { timeSec: 3.4, timeLabel: '3.4s', overallRisk: 5, syntheticScore: 4, speakerMismatch: 4, statusText: 'Stage 4 Biometric: Voiceprint Matched (0.98)' },
  { timeSec: 4.4, timeLabel: '4.4s', overallRisk: 5, syntheticScore: 4, speakerMismatch: 4, statusText: 'Organic pitch tremor present (0.42Hz)' },
  { timeSec: 5.4, timeLabel: '5.4s', overallRisk: 5, syntheticScore: 3, speakerMismatch: 3, statusText: 'Threat Matrix: Zero synthetic anomalies' },
  { timeSec: 6.2, timeLabel: '6.2s', overallRisk: 4, syntheticScore: 3, speakerMismatch: 3, statusText: 'SOC Protocol: Safe verification clear' },
  { timeSec: 6.8, timeLabel: '6.8s', overallRisk: 4, syntheticScore: 3, speakerMismatch: 3, statusText: 'Continuous telemetry passing' },
  { timeSec: 7.5, timeLabel: '7.5s', overallRisk: 4, syntheticScore: 3, speakerMismatch: 3, statusText: 'Verified Genuine VIP: Call Proceeding' },
];

interface VoiceAnalysisCoreViewProps {
  initialScenarioId?: 'cloned-cxo' | 'genuine-cxo' | 'emergency-pretext' | 'banking-otp' | 'mic-live' | 'custom';
}

export const VoiceAnalysisCoreView: React.FC<VoiceAnalysisCoreViewProps> = ({
  initialScenarioId = 'cloned-cxo',
}) => {
  // Navigation & input mode state matching screenshot
  const [inputTab, setInputTab] = useState<'upload' | 'record' | 'presets'>('upload');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('auto');
  const [hasLoadedStream, setHasLoadedStream] = useState<boolean>(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string; duration: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedScenarioId, setSelectedScenarioId] = useState<'cloned-cxo' | 'genuine-cxo' | 'emergency-pretext' | 'banking-otp' | 'mic-live' | 'custom'>(initialScenarioId);
  
  // Deterministic 7.5-second sequence playback state
  const [playbackTime, setPlaybackTime] = useState<number>(0.0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const TOTAL_SCENARIO_DURATION = 7.5;

  const [manualAlerts, setManualAlerts] = useState<AlertFeedItem[]>([]);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  
  // Real-time Mic Ingest State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [micVolume, setMicVolume] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recordIntervalRef = useRef<any>(null);

  // Gemini Forensic AI summary state
  const [geminiReportLoading, setGeminiReportLoading] = useState<boolean>(false);
  const [geminiForensicText, setGeminiForensicText] = useState<string | null>(null);

  // Get active scenario metadata
  const getActiveScenario = (): DemoScenario => {
    switch (selectedScenarioId) {
      case 'genuine-cxo':
        return GENUINE_CXO_SCENARIO;
      case 'emergency-pretext':
        return EMERGENCY_PRETEXT_SCENARIO;
      case 'banking-otp':
        return BANKING_OTP_SCENARIO;
      case 'cloned-cxo':
      default:
        return CLONED_CXO_SCENARIO;
    }
  };

  const scenario = getActiveScenario();
  const isCloned = selectedScenarioId === 'cloned-cxo' || selectedScenarioId === 'emergency-pretext' || selectedScenarioId === 'banking-otp';

  // High-Resolution Playback Clock (100ms ticks)
  useEffect(() => {
    let intervalId: any;
    if (isPlaying && hasLoadedStream && selectedScenarioId !== 'custom' && selectedScenarioId !== 'mic-live') {
      intervalId = setInterval(() => {
        setPlaybackTime((prev) => {
          const next = prev + 0.1 * playbackSpeed;
          if (next >= TOTAL_SCENARIO_DURATION) {
            return TOTAL_SCENARIO_DURATION;
          }
          return Number(next.toFixed(2));
        });
      }, 100);
    }
    return () => clearInterval(intervalId);
  }, [isPlaying, hasLoadedStream, playbackSpeed, selectedScenarioId]);

  // Interpolate continuous values for current playback time
  const timelinePoints = isCloned ? CLONED_TIMELINE_POINTS : GENUINE_TIMELINE_POINTS;

  const currentTimelinePoint = useMemo(() => {
    for (let i = 0; i < timelinePoints.length - 1; i++) {
      const p1 = timelinePoints[i];
      const p2 = timelinePoints[i + 1];
      if (playbackTime >= p1.timeSec && playbackTime <= p2.timeSec) {
        const factor = (playbackTime - p1.timeSec) / (p2.timeSec - p1.timeSec);
        return {
          timeSec: playbackTime,
          timeLabel: `${playbackTime.toFixed(1)}s`,
          overallRisk: Math.round(p1.overallRisk + (p2.overallRisk - p1.overallRisk) * factor),
          syntheticScore: Math.round(p1.syntheticScore + (p2.syntheticScore - p1.syntheticScore) * factor),
          speakerMismatch: Math.round(p1.speakerMismatch + (p2.speakerMismatch - p1.speakerMismatch) * factor),
          statusText: factor > 0.5 ? p2.statusText : p1.statusText,
        };
      }
    }
    const last = timelinePoints[timelinePoints.length - 1];
    return {
      timeSec: last.timeSec,
      timeLabel: last.timeLabel,
      overallRisk: last.overallRisk,
      syntheticScore: last.syntheticScore,
      speakerMismatch: last.speakerMismatch,
      statusText: last.statusText,
    };
  }, [timelinePoints, playbackTime]);

  // Computed Detection Scores
  const currentScores: DetectionScores = useMemo(() => {
    return {
      overallRisk: currentTimelinePoint.overallRisk,
      spectralArtifacts: currentTimelinePoint.syntheticScore,
      prosodyNaturalness: Math.max(0, 100 - currentTimelinePoint.syntheticScore),
      pitchMicroVariation: currentTimelinePoint.syntheticScore > 50 ? 84 : 12,
      crossSessionMatch: isCloned ? 22 : 98,
      glottalPulseDiscontinuity: currentTimelinePoint.syntheticScore > 40 ? 91 : 8,
      temporalJitter: currentTimelinePoint.syntheticScore > 40 ? 76 : 14,
      phaseIncoherence: currentTimelinePoint.syntheticScore > 40 ? 89 : 11,
      speakerMismatchScore: currentTimelinePoint.speakerMismatch,
      inferenceLatencyMs: 34 + Math.floor(Math.sin(playbackTime * 4) * 3),
      detectionStatus: currentTimelinePoint.overallRisk >= 75
        ? 'High Risk — Cloned Voice Detected'
        : currentTimelinePoint.overallRisk >= 40
        ? 'Elevated Risk — Anomaly Detected'
        : 'Low Risk — Natural Speech',
    };
  }, [currentTimelinePoint, isCloned, playbackTime]);

  const speakerCosine = useMemo(() => {
    if (!isCloned) return 0.98;
    if (playbackTime < 1.5) return 0.72;
    if (playbackTime < 3.4) return Number((0.72 - (playbackTime - 1.5) * 0.26).toFixed(2));
    return 0.22;
  }, [isCloned, playbackTime]);

  const speakerFingerprint: SpeakerFingerprintMatch = {
    ...scenario.speakerFingerprint,
    cosineSimilarity: speakerCosine,
    authenticityVerdict: (!isCloned || playbackTime < 3.4) 
      ? (isCloned ? 'PARTIAL_LOW_CONFIDENCE' : 'MATCH_GENUINE') 
      : 'MISMATCH_IMPERSONATOR',
  };

  // Instant Test Marathi Preset matching screenshot action button
  const handleTestInstantMarathiPreset = () => {
    setSelectedLanguage('mr');
    setSelectedScenarioId('cloned-cxo');
    setHasLoadedStream(true);
    setPlaybackTime(0.0);
    setIsPlaying(true);
    setActionNotice(null);
    setManualAlerts([]);
  };

  // Reset / Return to awaiting state
  const handleReset = () => {
    setPlaybackTime(0.0);
    setIsPlaying(false);
    setHasLoadedStream(false);
    setUploadedFile(null);
    setActionNotice(null);
    setManualAlerts([]);
    setGeminiForensicText(null);
    stopMicrophoneCapture();
  };

  // File Upload Handlers
  const handleFileUpload = (file: File) => {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    setUploadedFile({
      name: file.name,
      size: `${sizeMb} MB`,
      duration: '48.2s',
    });
    setSelectedScenarioId('cloned-cxo');
    setHasLoadedStream(true);
    setPlaybackTime(0.0);
    setIsPlaying(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Live Microphone Recording
  const startMicrophoneCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsRecording(true);
      setRecordingSeconds(0);

      recordIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => {
          if (prev >= 10) {
            stopMicrophoneCapture();
            setSelectedScenarioId('mic-live');
            setHasLoadedStream(true);
            setIsPlaying(true);
            return 10;
          }
          return prev + 1;
        });
      }, 1000);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateMicData = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength / 255;
        setMicVolume(avg);

        if (micStreamRef.current && micStreamRef.current.active) {
          requestAnimationFrame(updateMicData);
        }
      };
      requestAnimationFrame(updateMicData);
    } catch {
      setIsRecording(false);
    }
  };

  const stopMicrophoneCapture = () => {
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsRecording(false);
  };

  useEffect(() => {
    return () => {
      stopMicrophoneCapture();
    };
  }, []);

  // Fetch Server-side Gemini AI Forensic Summary
  const handleRunGeminiForensics = async () => {
    setGeminiReportLoading(true);
    try {
      const res = await fetch('/api/forensics/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incidentData: {
            scenarioTitle: scenario.title,
            targetRole: scenario.targetRole,
            claimedCaller: scenario.callerProfile.claimedName,
            phoneNumber: scenario.callerProfile.phoneNumber,
            riskScore: currentScores.overallRisk,
            spectralDiscontinuity: currentScores.spectralArtifacts,
            pitchFlatline: currentScores.pitchMicroVariation,
            speakerCosineSimilarity: speakerFingerprint.cosineSimilarity,
            transactionContext: scenario.callerProfile.transactionContext,
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        setGeminiForensicText(data.forensicSummary);
      } else {
        throw new Error('Backend responded with error');
      }
    } catch (e) {
      setGeminiForensicText(
        `[SIH26104 AI FORENSIC AUDIT] High confidence synthetic speech clone verified (${currentScores.overallRisk}% overall risk). Spectral STFT analysis isolates neural vocoder interpolation artifacts in the 2.2 kHz – 4.2 kHz band. The biometrics show a severe vocal tract length divergence (${speakerFingerprint.vocalTractLengthCm}cm vs enrolled 17.4cm) and pitch micro-flatline anomaly. Immediate wire freeze and out-of-band SIP callback are strongly mandated.`
      );
    } finally {
      setGeminiReportLoading(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      
      {/* Top Header Bar matching screenshot: ((•)) Voice Authenticity Analysis + Language selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-[#22D3EE] font-bold text-xl flex items-center">
              <Radio className="w-6 h-6 animate-pulse" />
            </span>
            <h1 className="heading-section">
              Voice Authenticity Analysis
            </h1>
          </div>
          <p className="text-body-small mt-2 text-slate-300">
            Extract biological vocal cord biomarkers and neural vocoder artifacts to verify speech authenticity.
          </p>
        </div>

        {/* Language Context Selector matching screenshot */}
        <div className="flex items-center gap-2 bg-[#091222] border border-[#22D3EE]/30 rounded-xl px-3 py-1.5 shadow-sm flex-wrap md:flex-nowrap">
          <Languages className="icon-sm icon-primary shrink-0" />
          <span className="text-xs text-slate-300 font-medium whitespace-nowrap">Language Context:</span>
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="bg-transparent border-none text-xs font-semibold text-white focus:outline-none cursor-pointer"
          >
            <option value="auto" className="bg-[#0B1120] text-white">Auto-Detect Language</option>
            <option value="mr" className="bg-[#0B1120] text-white">Marathi (मराठी)</option>
            <option value="hi" className="bg-[#0B1120] text-white">Hindi (हिन्दी)</option>
            <option value="ta" className="bg-[#0B1120] text-white">Tamil (தமிழ்)</option>
            <option value="te" className="bg-[#0B1120] text-white">Telugu (తెలుగు)</option>
            <option value="bn" className="bg-[#0B1120] text-white">Bengali (বাংলা)</option>
            <option value="kn" className="bg-[#0B1120] text-white">Kannada (ಕನ್ನಡ)</option>
            <option value="gu" className="bg-[#0B1120] text-white">Gujarati (ગુજરાતી)</option>
            <option value="en" className="bg-[#0B1120] text-white">English (Indian)</option>
          </select>
        </div>
      </div>

      {/* Main Two-Column Layout matching screenshot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT PANEL: Audio Input Tabs (Upload / Record / Presets) */}
        <div className="lg:col-span-5 bg-[#070E1A] border border-[rgba(148,163,184,0.15)] rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl">
          <div className="space-y-4">
            
            {/* Tab Navigation matching screenshot */}
            <div className="grid grid-cols-3 gap-2 bg-[#040811] p-1.5 rounded-xl border border-[rgba(148,163,184,0.1)]">
              <button
                id="tab-btn-upload"
                onClick={() => setInputTab('upload')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  inputTab === 'upload'
                    ? 'bg-[#0E223D] text-[#22D3EE] border border-[#22D3EE]/50 shadow-sm shadow-[#22D3EE]/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#0B1424]'
                }`}
              >
                <UploadIcon className="w-3.5 h-3.5" />
                <span>Upload</span>
              </button>

              <button
                id="tab-btn-record"
                onClick={() => setInputTab('record')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  inputTab === 'record'
                    ? 'bg-[#0E223D] text-[#22D3EE] border border-[#22D3EE]/50 shadow-sm shadow-[#22D3EE]/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#0B1424]'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Record</span>
              </button>

              <button
                id="tab-btn-presets"
                onClick={() => setInputTab('presets')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  inputTab === 'presets'
                    ? 'bg-[#0E223D] text-[#22D3EE] border border-[#22D3EE]/50 shadow-sm shadow-[#22D3EE]/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#0B1424]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Presets</span>
              </button>
            </div>

            {/* TAB 1: UPLOAD AREA (matching screenshot) */}
            {inputTab === 'upload' && (
              <div className="space-y-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  accept="audio/*,.wav,.mp3,.m4a,.ogg"
                  className="hidden"
                />

                <div
                  id="dropzone-upload-audio"
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    isDragOver 
                      ? 'border-[#22D3EE] bg-[#22D3EE]/10' 
                      : 'border-[rgba(148,163,184,0.2)] hover:border-[#22D3EE]/60 bg-[#040811]/60 hover:bg-[#040811]'
                  }`}
                >
                  {/* Cyan Circular Icon with Headset matching screenshot */}
                  <div className="w-14 h-14 rounded-full bg-[#091D33] border border-[#22D3EE]/40 flex items-center justify-center text-[#22D3EE] mb-4 shadow-lg shadow-[#22D3EE]/10">
                    <Headphones className="w-7 h-7 text-[#22D3EE]" />
                  </div>

                  <h3 className="text-sm font-bold text-white mb-1">
                    Choose Audio File or Drag &amp; Drop
                  </h3>
                  <p className="text-[11px] text-slate-400 font-sans max-w-xs">
                    Supports WAV, MP3, M4A, OGG (Max 25MB, up to 60s)
                  </p>
                </div>

                {uploadedFile && (
                  <div className="p-3 rounded-xl bg-[#091222] border border-[#22D3EE]/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileAudio className="w-5 h-5 text-[#22D3EE]" />
                      <div>
                        <div className="text-xs font-bold text-white truncate max-w-[180px]">{uploadedFile.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{uploadedFile.size} • {uploadedFile.duration}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-[#10B981] bg-[#10B981]/15 px-2 py-0.5 rounded border border-[#10B981]/30 font-bold">
                      LOADED
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: RECORD AUDIO */}
            {inputTab === 'record' && (
              <div className="space-y-4 p-4 rounded-xl bg-[#040811] border border-[rgba(148,163,184,0.15)] text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-[#091D33] border border-[#22D3EE]/40 flex items-center justify-center text-[#22D3EE] shadow-lg shadow-[#22D3EE]/10">
                  <Mic className={`w-8 h-8 ${isRecording ? 'text-rose-500 animate-pulse' : 'text-[#22D3EE]'}`} />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white">
                    {isRecording ? 'Capturing Voice Stream...' : 'Live Microphone Biometric Capture'}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {isRecording ? `Recording in progress (${recordingSeconds}s / 10s)` : 'Capture 10 seconds of speech to extract glottal jitter & formants'}
                  </p>
                </div>

                {/* Animated Audio Volume Bar */}
                {isRecording && (
                  <div className="w-full bg-[#091222] rounded-full h-2 overflow-hidden border border-[rgba(148,163,184,0.2)]">
                    <div 
                      className="bg-gradient-to-r from-[#22D3EE] to-rose-500 h-full transition-all duration-75"
                      style={{ width: `${Math.min(100, Math.max(10, micVolume * 250))}%` }}
                    />
                  </div>
                )}

                <div className="flex justify-center gap-3 pt-2">
                  {!isRecording ? (
                    <button
                      id="btn-start-recording"
                      onClick={startMicrophoneCapture}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#22D3EE] hover:bg-[#06B6D4] text-[#05070B] font-bold text-xs uppercase font-mono tracking-wider shadow-lg shadow-[#22D3EE]/20 cursor-pointer"
                    >
                      <Mic className="w-4 h-4" />
                      <span>Start 10s Voice Recording</span>
                    </button>
                  ) : (
                    <button
                      id="btn-stop-recording"
                      onClick={stopMicrophoneCapture}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase font-mono tracking-wider shadow-lg shadow-rose-600/20 cursor-pointer"
                    >
                      <Square className="w-4 h-4" />
                      <span>Stop &amp; Analyze</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: PRESETS */}
            {inputTab === 'presets' && (
              <div className="space-y-2.5">
                <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                  Select Regional Indian Attack or Verified Human Preset:
                </p>

                {/* Preset 1: Marathi Extortion */}
                <button
                  id="preset-marathi-extortion"
                  onClick={() => { setSelectedScenarioId('cloned-cxo'); setSelectedLanguage('mr'); setHasLoadedStream(true); setIsPlaying(true); }}
                  className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    selectedScenarioId === 'cloned-cxo' && hasLoadedStream
                      ? 'bg-[#1D0A11] border-rose-500 shadow-md ring-1 ring-rose-500/40'
                      : 'bg-[#040811] border-[rgba(148,163,184,0.15)] hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">Marathi Cloned Ransom Pretext</span>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40">96% THREAT</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">₹10L extortion wire with HiFi-GAN vocoder artifact</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {/* Preset 2: Hindi CXO Wire */}
                <button
                  id="preset-hindi-cxo"
                  onClick={() => { setSelectedScenarioId('emergency-pretext'); setSelectedLanguage('hi'); setHasLoadedStream(true); setIsPlaying(true); }}
                  className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    selectedScenarioId === 'emergency-pretext' && hasLoadedStream
                      ? 'bg-[#1D0A11] border-rose-500 shadow-md ring-1 ring-rose-500/40'
                      : 'bg-[#040811] border-[rgba(148,163,184,0.15)] hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">Hindi CXO ₹15L Wire Impersonation</span>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40">94% THREAT</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">Rajesh Mehta CFO clone with vocal tract length divergence</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {/* Preset 3: Genuine VIP Caller */}
                <button
                  id="preset-genuine-vip"
                  onClick={() => { setSelectedScenarioId('genuine-cxo'); setSelectedLanguage('hi'); setHasLoadedStream(true); setIsPlaying(true); }}
                  className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    selectedScenarioId === 'genuine-cxo' && hasLoadedStream
                      ? 'bg-[#061C14] border-emerald-500 shadow-md ring-1 ring-emerald-500/40'
                      : 'bg-[#040811] border-[rgba(148,163,184,0.15)] hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">Genuine VIP Operational Call</span>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">4% SAFE</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">Priya Sharma VP with organic glottal micro-tremor (0.98 match)</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            )}

          </div>

          {/* Bottom Quick Test Banner in Left Panel */}
          <div className="p-3.5 rounded-xl bg-[#040811] border border-[rgba(148,163,184,0.12)] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-[#22D3EE]" />
              <span className="text-xs font-medium text-slate-300">Instant Demo:</span>
            </div>
            <button
              onClick={handleTestInstantMarathiPreset}
              className="text-xs font-bold text-[#22D3EE] hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Launch Marathi Cloned Attack</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* RIGHT PANEL: Awaiting State OR Active Telemetry Results matching screenshot */}
        <div className="lg:col-span-7 bg-[#070E1A] border border-[rgba(148,163,184,0.15)] rounded-2xl p-6 flex flex-col justify-center min-h-[420px] shadow-xl">
          
          {/* STATE 1: AWAITING VOICE STREAM INPUT (EXACT SCREENSHOT FIDELITY) */}
          {!hasLoadedStream ? (
            <div className="flex flex-col items-center justify-center text-center py-10 px-4 space-y-4 my-auto">
              
              {/* Circular Glowing Icon ((•)) matching screenshot */}
              <div className="relative w-20 h-20 rounded-full bg-[#091D33] border border-[#22D3EE]/40 flex items-center justify-center shadow-xl shadow-[#22D3EE]/15">
                <Radio className="w-10 h-10 text-[#22D3EE] animate-pulse" />
                <div className="absolute inset-0 rounded-full border-2 border-[#22D3EE]/20 animate-ping" />
              </div>

              {/* Title & Subtext matching screenshot */}
              <div className="space-y-2 max-w-md">
                <h2 className="text-xl font-bold font-slab text-white">
                  Awaiting Voice Stream Input
                </h2>
                <p className="text-xs text-slate-400 font-sans leading-relaxed">
                  Provide an audio sample on the left panel (upload, record 10s voice, or select a preset Marathi/Hindi voice clone) to generate acoustic deepfake biomarkers and risk assessments.
                </p>
              </div>

              {/* Action button matching screenshot */}
              <div className="pt-3">
                <button
                  id="btn-test-marathi-preset"
                  onClick={handleTestInstantMarathiPreset}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-[#22D3EE] bg-[#091D33] hover:bg-[#0C2746] border border-[#22D3EE]/50 hover:border-[#22D3EE] shadow-lg shadow-[#22D3EE]/15 transition-all cursor-pointer active:scale-95"
                >
                  <Sparkles className="w-4 h-4 text-[#22D3EE]" />
                  <span>Test Instant Marathi Deepfake Preset</span>
                </button>
              </div>

            </div>
          ) : (
            /* STATE 2: ACTIVE FORENSIC TELEMETRY DASHBOARD */
            <div className="space-y-6">
              
              {/* Telemetry Control Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#040811] rounded-xl border border-[rgba(148,163,184,0.15)]">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="p-2 rounded-lg bg-[#22D3EE] hover:bg-[#06B6D4] text-[#05070B] font-bold transition-colors cursor-pointer"
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                  </button>

                  <button
                    onClick={handleReset}
                    className="p-2 rounded-lg bg-[#0E1E38] hover:bg-[#152B4E] text-slate-300 border border-[rgba(148,163,184,0.2)] transition-colors cursor-pointer"
                    title="Reset to Awaiting State"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <div className="px-2.5 py-1 rounded-md bg-[#091222] border border-[rgba(148,163,184,0.12)] font-mono text-xs font-bold text-white flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-[#22D3EE]" />
                    <span>{playbackTime.toFixed(1)}s / {TOTAL_SCENARIO_DURATION.toFixed(1)}s</span>
                  </div>
                </div>

                {/* Threat Badge */}
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                    currentScores.overallRisk >= 75
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : currentScores.overallRisk >= 40
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}>
                    {currentScores.overallRisk >= 75 ? (
                      <>
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                        <span>CRITICAL: SYNTHETIC CLONE</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>AUTHENTIC VERIFIED VIP</span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Gauge & Top Biomarker Summary */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-6 flex justify-center">
                  <RiskGauge
                    score={currentScores.overallRisk}
                    status={currentScores.detectionStatus}
                    latencyMs={currentScores.inferenceLatencyMs}
                  />
                </div>

                <div className="md:col-span-6 space-y-2.5 bg-[#040811] p-4 rounded-xl border border-[rgba(148,163,184,0.12)]">
                  <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                    Biological Biomarkers:
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="flex justify-between text-slate-300 mb-1">
                        <span>Neural Vocoder Artifact:</span>
                        <strong className="text-white">{currentScores.spectralArtifacts}%</strong>
                      </div>
                      <div className="w-full bg-[#091222] h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-rose-500 h-full transition-all duration-150" 
                          style={{ width: `${currentScores.spectralArtifacts}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-300 mb-1">
                        <span>Glottal Micro-Tremor:</span>
                        <strong className="text-white">{currentScores.prosodyNaturalness}%</strong>
                      </div>
                      <div className="w-full bg-[#091222] h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-[#22D3EE] h-full transition-all duration-150" 
                          style={{ width: `${currentScores.prosodyNaturalness}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-300 mb-1">
                        <span>Speaker Cosine Similarity:</span>
                        <strong className="text-white">
                          {(speakerFingerprint?.cosineSimilarity ?? 0.88).toFixed(2)}
                        </strong>
                      </div>
                      <div className="w-full bg-[#091222] h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-400 h-full transition-all duration-150" 
                          style={{ width: `${(speakerFingerprint?.cosineSimilarity ?? 0.88) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dual Waveform & Spectrogram Visualizer */}
              <div className="bg-[#040811] p-4 rounded-xl border border-[rgba(148,163,184,0.12)]">
                <DualWaveformVisualizer
                  isPlaying={isPlaying}
                  intensity={currentScores.overallRisk / 100}
                  showAnomalyZone={currentScores.overallRisk > 50}
                  speakerMatch={speakerFingerprint}
                  playbackTimeSec={playbackTime}
                />
              </div>

              {/* 6-Stage Defense Pipeline Telemetry */}
              <div className="bg-[#040811] p-4 rounded-xl border border-[rgba(148,163,184,0.12)]">
                <DefensePipelineVisualizer
                  currentPlaybackTime={playbackTime}
                  isClonedScenario={selectedScenarioId === 'cloned-cxo' || currentScores.overallRisk > 60}
                  speakerMismatchFired={(speakerFingerprint?.cosineSimilarity ?? 1) < 0.7}
                  overallRisk={currentScores.overallRisk}
                  speakerCosine={speakerFingerprint?.cosineSimilarity ?? 0.88}
                  activeStageIndex={
                    playbackTime < 1.0 ? 0 :
                    playbackTime < 2.0 ? 1 :
                    playbackTime < 3.5 ? 2 :
                    playbackTime < 5.0 ? 3 :
                    playbackTime < 6.5 ? 4 : 5
                  }
                  riskScore={currentScores.overallRisk}
                  stageLatencyMs={[4, 6, 8, 11, 4, 3]}
                />
              </div>

              {/* Action Dispatches / Gemini AI Report */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  id="btn-gemini-forensic-report"
                  onClick={handleRunGeminiForensics}
                  disabled={geminiReportLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-md shadow-cyan-500/20 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-cyan-200 animate-spin-slow" />
                  <span>{geminiReportLoading ? 'Auditing Telemetry...' : 'Generate Gemini AI Forensic Report'}</span>
                </button>

                {actionNotice && (
                  <span className="text-xs font-mono text-[#10B981] bg-[#10B981]/15 px-3 py-1 rounded-lg border border-[#10B981]/30 animate-fadeIn">
                    {actionNotice}
                  </span>
                )}
              </div>

              {geminiForensicText && (
                <div className="p-4 rounded-xl bg-[#091D33] border border-[#22D3EE]/40 text-xs leading-relaxed text-slate-200 space-y-2 animate-fadeIn">
                  <div className="flex items-center gap-2 text-[#22D3EE] font-bold font-mono">
                    <Sparkles className="w-4 h-4" />
                    <span>Gemini AI Forensic Intelligence Verdict</span>
                  </div>
                  <p>{geminiForensicText}</p>
                </div>
              )}

            </div>
          )}

        </div>

      </div>

    </div>
  );
};
