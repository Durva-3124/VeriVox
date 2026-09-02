import React, { useState } from 'react';
import { 
  Lock, 
  ShieldCheck, 
  FileCode2, 
  Cpu, 
  CheckCircle2, 
  Server, 
  Database, 
  Trash2, 
  Layers, 
  Sparkles,
  ArrowRight,
  EyeOff,
  Scale
} from 'lucide-react';

export const PrivacyArchitectureView: React.FC = () => {
  const [featureVectorMode, setFeatureVectorMode] = useState<'raw' | 'vector'>('vector');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      
      {/* Header */}
      <div>
        <div className="text-xs uppercase font-mono tracking-wider text-[#22C55E] font-semibold">
          Privacy-First Zero-Retention Architecture
        </div>
        <h1 className="text-page-title">
          Privacy &amp; India DPDP Act 2023 Alignment
        </h1>
        <p className="text-xs text-slate-400 mt-1 max-w-2xl font-mono">
          Engineered to ensure enterprise cybersecurity without storing, transmitting, or retaining sensitive corporate conversations or biometric voice audio.
        </p>
      </div>

      {/* Hero Callout Banner: 0 Seconds Raw Audio Stored */}
      <div className="p-6 sm:p-8 rounded-xl bg-[#131A2A] border border-[#22C55E]/30 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-xl bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20">
              <EyeOff className="w-8 h-8" />
            </div>
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#22C55E]">
                Core Architectural Guarantee
              </span>
              <h2 className="text-2xl font-bold font-display text-white mt-0.5">
                0 Seconds of Raw Audio Stored by Default
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xl font-mono">
                VoxShield AI operates strictly on ephemeral sliding-window buffers in RAM. Audio is converted to non-reversible mathematical frequency vectors and purged immediately after feature extraction (&lt;40ms).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-[#0A0E17] p-4 rounded-xl border border-[#1F2937] text-xs">
            <div>
              <div className="text-slate-400 font-mono text-[11px] uppercase">RAM Lifetime:</div>
              <div className="text-[#22C55E] font-mono font-bold text-lg">&lt; 40 ms</div>
            </div>
            <div className="h-10 w-px bg-[#1F2937]" />
            <div>
              <div className="text-slate-400 font-mono text-[11px] uppercase">Disk Persistence:</div>
              <div className="text-white font-mono font-bold text-lg">0 Bytes</div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Toggle: Raw Audio vs Mathematical Feature Vector */}
      <div className="p-6 rounded-xl bg-[#131A2A] border border-[#1F2937] shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold font-display text-white">
              Interactive Inspector: What the AI Actually Processes
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Toggle between human-intelligible audio vs non-invertible mathematical feature vectors.
            </p>
          </div>

          {/* Mode Switch Pills */}
          <div className="flex bg-[#0A0E17] p-1 rounded-lg border border-[#1F2937] text-xs font-mono">
            <button
              onClick={() => setFeatureVectorMode('raw')}
              className={`px-3 py-1.5 rounded font-bold uppercase tracking-wider transition-all ${
                featureVectorMode === 'raw'
                  ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Raw Audio (Discarded in 40ms)
            </button>
            <button
              onClick={() => setFeatureVectorMode('vector')}
              className={`px-3 py-1.5 rounded font-bold uppercase tracking-wider transition-all ${
                featureVectorMode === 'vector'
                  ? 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              128-D Feature Vector (Processed)
            </button>
          </div>
        </div>

        {/* Display Container */}
        {featureVectorMode === 'raw' ? (
          <div className="p-5 rounded-lg bg-[#0A0E17] border border-[#EF4444]/30 space-y-3">
            <div className="flex items-center justify-between text-xs text-[#EF4444]">
              <span className="font-semibold flex items-center gap-1.5 font-mono uppercase tracking-wider">
                <Trash2 className="w-4 h-4" />
                Raw Human Speech Content (PURGED FROM MEMORY)
              </span>
              <span className="font-mono text-[11px] bg-[#EF4444]/10 px-2 py-0.5 rounded border border-[#EF4444]/20 uppercase">
                Never Persisted
              </span>
            </div>
            <div className="p-3 bg-[#131A2A] rounded-lg font-mono text-xs text-slate-300 border border-[#1F2937]">
              "Please execute the ₹15 Lakh RTGS transfer to Zenith Logistics before 12 PM..."
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2 font-mono">
              <span className="w-2 h-2 rounded-full bg-[#EF4444] shadow-[0_0_6px_#EF4444]"></span>
              <span>Raw waveform and spoken words are NEVER written to disk, databases, or cloud servers.</span>
            </div>
          </div>
        ) : (
          <div className="p-5 rounded-lg bg-[#0A0E17] border border-[#22C55E]/30 space-y-3">
            <div className="flex items-center justify-between text-xs text-[#22C55E]">
              <span className="font-semibold flex items-center gap-1.5 font-mono uppercase tracking-wider">
                <Lock className="w-4 h-4" />
                Non-Invertible 128-D MFCC &amp; Formant Vector (PROCESSED)
              </span>
              <span className="font-mono text-[11px] bg-[#22C55E]/10 px-2 py-0.5 rounded border border-[#22C55E]/20 uppercase">
                Privacy-Preserving
              </span>
            </div>
            <div className="p-3 bg-[#131A2A] rounded-lg font-mono text-xs text-[#22C55E] border border-[#1F2937] overflow-x-auto">
              [ 0.8412, -0.2198, 0.5019, 0.1204, -0.9841, 0.4410, 0.0812, -0.3129, 0.7712, 0.1984, -0.0412, 0.6120, ... +116 dimensions ]
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2 font-mono">
              <span className="w-2 h-2 rounded-full bg-[#22C55E] shadow-[0_0_6px_#22C55E]"></span>
              <span>Mathematical representations cannot be reconstructed back into speech or intelligible words.</span>
            </div>
          </div>
        )}
      </div>

      {/* 4 Architectural Pillars: DPDP Act 2023 Alignment */}
      <div className="space-y-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-mono text-[#22C55E] font-semibold mb-1 uppercase tracking-wider">
            <Scale className="w-3.5 h-3.5" />
            <span>Compliance Architecture</span>
          </div>
          <h2 className="text-xl font-bold font-display text-white">
            Designed to Align with India's DPDP Act 2023
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            Engineered around the core tenets of the Digital Personal Data Protection Act 2023.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          <div className="p-5 rounded-xl bg-[#131A2A] border border-[#1F2937] space-y-3 shadow-sm">
            <div className="p-2.5 rounded-lg bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20 w-fit">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white font-display">Purpose Limitation</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              Extracted acoustic features are processed strictly for real-time authentication and fraud prevention. No secondary analytics or profiling.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-[#131A2A] border border-[#1F2937] space-y-3 shadow-sm">
            <div className="p-2.5 rounded-lg bg-[#2E7DFF]/10 text-[#2E7DFF] border border-[#2E7DFF]/20 w-fit">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white font-display">Data Minimization</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              Only acoustic physics embeddings are evaluated. No speech-to-text transcripts or conversation transcripts are retained.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-[#131A2A] border border-[#1F2937] space-y-3 shadow-sm">
            <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 w-fit">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white font-display">On-Premises Edge Option</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              Deployable directly within sovereign banking data centers (air-gapped) or local enterprise PBX hardware with zero cloud egress.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-[#131A2A] border border-[#1F2937] space-y-3 shadow-sm">
            <div className="p-2.5 rounded-lg bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20 w-fit">
              <Server className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white font-display">Cryptographic Hashing</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              Enrollment voiceprints are salted and cryptographically hashed with SHA-256 HMAC, preventing cross-organization biometric correlation.
            </p>
          </div>

        </div>
      </div>

    </div>
  );
};
