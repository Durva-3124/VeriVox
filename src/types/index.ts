export type NavigationTab = 
  | 'landing'
  | 'dashboard'
  | 'analysis'
  | 'simulation'
  | 'history'
  | 'insights'
  | 'alerts'
  | 'analytics'
  | 'how-it-works'
  | 'privacy'
  | 'api';

export type RiskLevel = 'safe' | 'caution' | 'danger';

export interface CallerProfile {
  id: string;
  claimedName: string;
  claimedRole: string;
  claimedOrganization: string;
  phoneNumber: string;
  carrier: string;
  callOrigin: string;
  voiceprintRegistered: boolean;
  registeredVoiceprintId: string;
  transactionContext?: {
    type: string;
    amountInr: number;
    beneficiaryName: string;
    urgency: 'Standard' | 'Urgent' | 'Critical Override';
  };
  knownContact: boolean;
  priorIncidentCount: number;
  carrierIdStatus: 'Verified Carrier Route' | 'Unverified / Possible CLI Spoof' | 'VoIP Gateway Bridge';
}

export interface DetectionScores {
  overallRisk: number; // 0-100
  spectralArtifacts: number; // High = unnatural TTS artifact
  prosodyNaturalness: number; // High = natural human speech
  pitchMicroVariation: number; // High = synthetic robotic micro-pitch flatline
  crossSessionMatch: number; // Match with enrollment voiceprint
  glottalPulseDiscontinuity: number;
  temporalJitter: number;
  phaseIncoherence: number;
  speakerMismatchScore: number; // 0-100: mismatch between enrolled speaker & live caller
  inferenceLatencyMs: number;
  detectionStatus: 'Analyzing call...' | 'Low Risk — Natural Speech' | 'Elevated Risk — Anomaly Detected' | 'High Risk — Cloned Voice Detected';
}

export interface SecurityEventLog {
  id: string;
  timestamp: string;
  relativeTimeSec: number;
  level: 'info' | 'warn' | 'alert' | 'critical';
  category: 'Acoustics' | 'Carrier' | 'Biometrics' | 'Threshold' | 'Action';
  message: string;
  metricDetail?: string;
}

export interface SpeakerFingerprintMatch {
  enrolledId: string;
  enrolledName: string;
  enrolledRole: string;
  cosineSimilarity: number; // 0.0 - 1.0 (e.g. 0.94 genuine, 0.22 cloned)
  formantMatchF1F2: number; // %
  vocalTractLengthCm: number; // e.g. 17.2cm human vs 14.1cm synthetic
  glottalFlowVelocityMatch: number; // %
  enrolledChannels: string[];
  enrollmentDate: string;
  authenticityVerdict: 'MATCH_GENUINE' | 'MISMATCH_IMPERSONATOR' | 'PARTIAL_LOW_CONFIDENCE';
}

export interface LiveAlertDispatch {
  id: string;
  timestamp: string;
  channel: 'SMS' | 'EMAIL' | 'SIP_DROP' | 'SOC_WEBHOOK' | 'IVR_CALLBACK';
  recipient: string;
  title: string;
  message: string;
  status: 'DELIVERED' | 'DISPATCHED' | 'TRIGGERED' | 'QUEUED';
  severity: 'CRITICAL' | 'HIGH' | 'INFO';
}

export interface DemoScenario {
  id: 'cloned-cxo' | 'genuine-cxo' | 'emergency-pretext' | 'banking-otp';
  title: string;
  subtitle: string;
  targetRole: string;
  callerProfile: CallerProfile;
  audioSampleDescription: string;
  speakerFingerprint: SpeakerFingerprintMatch;
  transcript: {
    time: string;
    speaker: string;
    text: string;
    anomalyHighlight?: boolean;
  }[];
  steps: {
    timeSec: number;
    scores: DetectionScores;
    event?: SecurityEventLog;
    waveformIntensity: number; // 0.1 to 1.0
    showAlertBanner?: boolean;
    audioFrequencyAnomalyZone?: [number, number]; // e.g. [2000, 4200] Hz
    alertDispatch?: LiveAlertDispatch;
  }[];
}

export interface FraudIncident {
  id: string;
  timestamp: string;
  targetExecutive: string;
  targetCompany: string;
  targetRole: string;
  callerNumber: string;
  callerLocation: string;
  riskScore: number;
  synthesisEngineDetected: string;
  transactionAmountInr: number;
  language: string;
  actionTaken: 'Call Blocked & Escalate' | 'Quarantined & Callback Required' | 'Allowed (Verified Human)' | 'Manual Review Flagged';
  carrierType: string;
  latencyMs: number;
  status: 'Mitigated' | 'Under Investigation' | 'Confirmed Attack Blocked';
  threatTier: 'CRITICAL' | 'ELEVATED' | 'LOW RISK';
  biomarkersDetected: string[];
  complianceLogHash: string;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  thresholdRisk: number;
  minAmountInr?: number;
  channels: {
    slackSOC: boolean;
    smsExecutive: boolean;
    ivrCallback: boolean;
    siemWebhook: boolean;
    telecomAutoDrop: boolean;
  };
  action: 'Alert SOC Only' | 'Require 2FA Callback' | 'Immediate Call Termination' | 'Biometric Re-verification';
  enabled: boolean;
  appliesTo: string[];
}

export interface LanguageCoverage {
  code: string;
  name: string;
  nativeName: string;
  region: string;
  speakersMillions: number;
  accuracyRate: number;
  trainingHours: number;
  dialectsSupported: string[];
  status: 'Production Edge' | 'Beta Accelerated' | 'Pilot Live';
  sampleAudioTranscript?: string;
  commonAttackVectors?: string[];
}

export interface SourceVoiceSample {
  id: string;
  name: string;
  role: string;
  organization: string;
  accent: string;
  pitchBaseHz: number;
  previewUrl?: string;
  sampleText: string;
  enrolledId: string;
}

export interface AttackSimulationState {
  sourceSampleId: string;
  targetLanguage: string;
  synthesisEngine: 'VITS_DIFFUSION' | 'HIFI_GAN_NEURAL' | 'RVC_V2_VOICECHANGER' | 'STYLETTS_2' | 'ELEVENLABS_V2';
  pitchFlattenRate: number; // 0 - 100%
  spectralArtifactIntensity: number; // 0 - 100%
  phaseJitterRate: number; // 0 - 100%
  isSynthesizing: boolean;
  isGenerated: boolean;
  isAnalyzing: boolean;
  hasRunDetection: boolean;
  detectionResult?: {
    overallRisk: number;
    classification: 'SYNTHETIC_VOICE_CLONE' | 'NATURAL_HUMAN_VOICE';
    biomarkers: {
      spectralRolloffAnomaly: number;
      pitchMicroTremorDeficit: number;
      stftPhaseDiscontinuity: number;
      speakerBiometricMismatch: number;
    };
    detectedVocoder: string;
    defenseAction: string;
    latencyMs: number;
  };
}

export interface ApiEndpointSpec {
  method: 'POST' | 'GET';
  path: string;
  title: string;
  description: string;
  requestBody: Record<string, any>;
  responseBody: Record<string, any>;
}
