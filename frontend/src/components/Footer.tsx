import React from 'react';
import { ShieldCheck, Lock, ExternalLink, Cpu, Globe2, Award, Heart, Radio, FlaskConical, History, Terminal } from 'lucide-react';
import { NavigationTab } from '../types';
import { MagneticButton } from './motion/MagneticButton';

interface FooterProps {
  onTabChange: (tab: NavigationTab) => void;
}

export const Footer: React.FC<FooterProps> = ({ onTabChange }) => {
  return (
    <footer className="w-full bg-[#05070B] border-t border-[rgba(148,163,184,0.12)] text-slate-400 text-xs py-10 mt-16 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Hackathon attribution banner */}
        <div className="mb-8 card-raised p-lg flex flex-col md:flex-row items-center justify-between gap-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#22D3EE]/15 border border-[#22D3EE]/30 text-[#22D3EE]">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm font-slab">Smart India Hackathon 2026</span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#22D3EE]/15 text-[#22D3EE] border border-[#22D3EE]/30 font-mono uppercase tracking-wider">
                  Problem Statement: SIH26104
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-0.5 font-mono">
                AICTE Cyber Security Cell · Real-Time Multilingual AI Voice-Clone Detection &amp; Impersonation Prevention
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <MagneticButton 
              onClick={() => onTabChange('analysis')}
              className="btn-cta-gradient px-4 py-2 rounded-lg font-bold font-mono uppercase tracking-wider text-xs flex items-center gap-1.5 shadow-lg shadow-orange-500/20 cursor-pointer"
            >
              <Radio className="icon-sm" />
              Launch Voice Core
            </MagneticButton>
            <button 
              onClick={() => onTabChange('api')}
              className="btn-secondary btn-md flex items-center gap-1.5"
            >
              <Terminal className="icon-sm icon-primary" />
              API Specs
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-[rgba(148,163,184,0.12)]">
          {/* Col 1 */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#0B1120] border border-[#22D3EE]/40 flex items-center justify-center text-[#22D3EE] font-bold">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="font-slab font-bold text-white text-base tracking-tight">VERIVOX<span className="text-[#22D3EE]">.AI</span></span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed font-mono">
              Real-time deepfake audio firewall defending Indian enterprises, CXOs, financial institutions, and emergency helplines.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-[#10B981] font-mono">
              <span className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981]"></span>
              DPDP Act 2023 Ephemeral Audio Architecture
            </div>
          </div>

          {/* Col 2: Navigation */}
          <div>
            <h4 className="font-semibold text-white mb-3 text-xs uppercase tracking-wider font-mono">Platform Modules</h4>
            <ul className="space-y-2 font-mono text-xs">
              <li>
                <button onClick={() => onTabChange('landing')} className="hover:text-[#22D3EE] transition-colors">
                  Overview &amp; Defense Radar
                </button>
              </li>
              <li>
                <button onClick={() => onTabChange('analysis')} className="hover:text-[#22D3EE] transition-colors flex items-center gap-1">
                  <span>Voice Analysis Core</span>
                  <span className="text-[9px] px-1 bg-[#EF4444]/20 text-[#EF4444] rounded font-bold">LIVE</span>
                </button>
              </li>
              <li>
                <button onClick={() => onTabChange('simulation')} className="hover:text-[#22D3EE] transition-colors flex items-center gap-1">
                  <span>Attack Simulation Lab</span>
                  <span className="text-[9px] px-1 bg-[#8B5CF6]/20 text-[#8B5CF6] rounded font-bold">LAB</span>
                </button>
              </li>
              <li>
                <button onClick={() => onTabChange('history')} className="hover:text-[#22D3EE] transition-colors">
                  Detection History &amp; Audit
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Insights & Architecture */}
          <div>
            <h4 className="font-semibold text-white mb-3 text-xs uppercase tracking-wider font-mono">Architecture &amp; SDKs</h4>
            <ul className="space-y-2 font-mono text-xs">
              <li>
                <button onClick={() => onTabChange('insights')} className="hover:text-[#22D3EE] transition-colors">
                  Model Insights (EER 1.18%)
                </button>
              </li>
              <li>
                <button onClick={() => onTabChange('insights')} className="hover:text-[#22D3EE] transition-colors">
                  8 Indian Languages Matrix
                </button>
              </li>
              <li>
                <button onClick={() => onTabChange('api')} className="hover:text-[#22D3EE] transition-colors">
                  Zero-Trust Developer API
                </button>
              </li>
              <li>
                <button onClick={() => onTabChange('api')} className="hover:text-[#22D3EE] transition-colors">
                  60s Scoped Stream Token Issuer
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4: Problem Statement Info */}
          <div>
            <h4 className="font-semibold text-white mb-3 text-xs uppercase tracking-wider font-mono">SIH 2026 Standards</h4>
            <div className="bg-[#0B1120] p-3 rounded-lg border border-[rgba(148,163,184,0.12)] space-y-1.5 text-[11px] font-mono">
              <div className="text-slate-200 font-medium">Cyber Security &amp; Blockchain</div>
              <div className="text-slate-400">Organization: AICTE Cyber Security Cell</div>
              <div className="text-slate-400">Target Latency: &lt; 50ms Edge DSP</div>
              <div className="text-[#22D3EE] text-[10px] pt-1 border-t border-[rgba(148,163,184,0.12)]">
                Model: ResNet-Indic + STFT Phase Incoherence
              </div>
            </div>
          </div>
        </div>

        {/* Bottom copyright matching screenshot */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 font-sans">
          <div className="font-medium text-slate-300">
            <strong className="text-white font-semibold">VeriVox AI</strong> • Smart India Hackathon SIH26104
          </div>
          <div className="text-slate-400 text-center text-xs">
            Acoustic Deepfake Forensics &amp; Regional Voice Impersonation Prevention
          </div>
          <div className="flex items-center gap-4 text-xs">
            <button onClick={() => onTabChange('how-it-works')} className="hover:text-[#22D3EE] transition-colors cursor-pointer">Architecture</button>
            <button onClick={() => onTabChange('insights')} className="hover:text-[#22D3EE] transition-colors cursor-pointer">Benchmarks</button>
            <button onClick={() => onTabChange('privacy')} className="hover:text-[#22D3EE] transition-colors cursor-pointer">Privacy</button>
          </div>
        </div>
      </div>
    </footer>
  );
};
