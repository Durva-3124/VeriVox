import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  Radio, 
  FlaskConical, 
  History, 
  Cpu, 
  Terminal, 
  ShieldCheck, 
  ArrowRight, 
  X, 
  Sliders, 
  Mic, 
  Download, 
  Sparkles,
  Zap,
  CornerDownLeft,
  Key
} from 'lucide-react';
import { NavigationTab } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: NavigationTab) => void;
  onSelectScenario?: (scenarioId: string) => void;
}

interface CommandItem {
  id: string;
  category: 'Navigation' | 'Scenario' | 'Actions';
  title: string;
  subtitle: string;
  icon: React.FC<{ className?: string }>;
  action: () => void;
  shortcut?: string;
  badge?: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onSelectScenario,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const items: CommandItem[] = useMemo(() => [
    {
      id: 'nav-landing',
      category: 'Navigation',
      title: 'Public Overview & Defense Radar',
      subtitle: 'Return to public home page, radar pipeline, and Indic language matrices',
      icon: ShieldCheck,
      action: () => { onNavigate('landing'); onClose(); },
      shortcut: 'G O',
    },
    {
      id: 'nav-dashboard',
      category: 'Navigation',
      title: 'SOC Live Defense Dashboard',
      subtitle: 'Real-time telemetry console with live waveform, carrier CLI check, and SIH metrics',
      icon: ShieldCheck,
      action: () => { onNavigate('dashboard'); onClose(); },
      shortcut: 'G D',
      badge: 'CONSOLE',
    },
    {
      id: 'nav-analysis',
      category: 'Navigation',
      title: 'Voice Analysis Core (Live)',
      subtitle: 'Real-time semicircular threat gauge, dual spectrogram, and 6-stage telemetry',
      icon: Radio,
      action: () => { onNavigate('analysis'); onClose(); },
      shortcut: 'G A',
      badge: 'LIVE',
    },
    {
      id: 'nav-sim',
      category: 'Navigation',
      title: 'Attack Simulation Lab',
      subtitle: 'Interactive red-teaming lab with VITS, HiFi-GAN, and XTTSv2 voice synthesis',
      icon: FlaskConical,
      action: () => { onNavigate('simulation'); onClose(); },
      shortcut: 'G S',
      badge: 'LAB',
    },
    {
      id: 'nav-history',
      category: 'Navigation',
      title: 'Detection History & Audit Logs',
      subtitle: 'Immutable forensic records with SHA-256 proofs and JSON exports',
      icon: History,
      action: () => { onNavigate('history'); onClose(); },
      shortcut: 'G H',
    },
    {
      id: 'nav-insights',
      category: 'Navigation',
      title: 'Model Insights & Benchmarks',
      subtitle: 'ROC curves, FAR/FRR trade-off thresholds, and confusion matrix',
      icon: Cpu,
      action: () => { onNavigate('insights'); onClose(); },
      shortcut: 'G I',
      badge: 'METRICS',
    },
    {
      id: 'nav-alerts',
      category: 'Navigation',
      title: 'Alert Policies & Enforcement Rules',
      subtitle: 'Configure multi-channel alerts (SMS, IVR callback, SIEM webhook, SIP killswitch)',
      icon: Sliders,
      action: () => { onNavigate('alerts'); onClose(); },
      shortcut: 'G A',
      badge: 'RULES',
    },
    {
      id: 'nav-how-it-works',
      category: 'Navigation',
      title: 'How It Works & Architecture',
      subtitle: 'Zero-retention pipeline, glottal acoustic physics, and DPDP compliance',
      icon: ShieldCheck,
      action: () => { onNavigate('how-it-works'); onClose(); },
      shortcut: 'G W',
    },
    {
      id: 'nav-api',
      category: 'Navigation',
      title: 'Zero-Trust Developer API',
      subtitle: 'Node.js, Python, Go, and cURL snippets with ephemeral token generation',
      icon: Terminal,
      action: () => { onNavigate('api'); onClose(); },
      shortcut: 'G P',
    },
    {
      id: 'scen-cloned',
      category: 'Scenario',
      title: 'Trigger Scenario: Cloned CXO Attack',
      subtitle: 'Simulate ₹15L wire impersonation with vocal tract mismatch and automated freeze',
      icon: Radio,
      action: () => {
        onNavigate('analysis');
        onSelectScenario?.('cloned-cxo');
        onClose();
      },
      badge: 'THREAT',
    },
    {
      id: 'scen-genuine',
      category: 'Scenario',
      title: 'Trigger Scenario: Genuine VIP Caller',
      subtitle: 'Priya Sharma (VP Ops) with organic glottal micro-tremor and 0.98 cosine match',
      icon: ShieldCheck,
      action: () => {
        onNavigate('analysis');
        onSelectScenario?.('genuine-cxo');
        onClose();
      },
      badge: 'SAFE',
    },
    {
      id: 'scen-mic',
      category: 'Scenario',
      title: 'Live Hardware Mic Ingest',
      subtitle: 'Capture physical microphone stream via Web Audio API with real-time FFT',
      icon: Mic,
      action: () => {
        onNavigate('analysis');
        onSelectScenario?.('mic-live');
        onClose();
      },
      badge: 'HARDWARE',
    },
    {
      id: 'scen-custom',
      category: 'Scenario',
      title: 'Interactive Parameter Tester',
      subtitle: 'Tune risk, vocoder distortion, and prosody levels manually for jury testing',
      icon: Sliders,
      action: () => {
        onNavigate('analysis');
        onSelectScenario?.('custom');
        onClose();
      },
      badge: 'MANUAL',
    },
  ], [onNavigate, onSelectScenario, onClose]);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(item => 
      item.title.toLowerCase().includes(q) || 
      item.subtitle.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  }, [items, query]);

  // Keyboard navigation within palette
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (filteredItems.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 px-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      {/* Backdrop click to close */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Palette Container */}
      <div className="relative w-full max-w-xl bg-[#0B1120] border border-[#22D3EE]/30 rounded-xl shadow-2xl shadow-[#22D3EE]/10 overflow-hidden z-10 flex flex-col max-h-[80vh]">
        
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[rgba(148,163,184,0.15)] bg-[#05070B]">
          <Search className="w-4 h-4 text-[#22D3EE] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command, scenario name, or view... (e.g. 'Analysis', 'Cloned', 'API')"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="flex-1 bg-transparent border-none text-white text-sm placeholder:text-slate-500 focus:outline-none font-mono"
          />
          <button 
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1E293B] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-slate-400 font-mono text-xs">
              No matching commands or scenarios found for &quot;{query}&quot;
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-2.5 rounded-lg text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#1E293B] border border-[#22D3EE]/40 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-[#131B2E] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      isSelected ? 'bg-[#22D3EE]/15 text-[#22D3EE]' : 'bg-[#05070B] text-slate-400'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-slab text-white truncate">{item.title}</span>
                        {item.badge && (
                          <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold ${
                            item.badge === 'THREAT'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : item.badge === 'LIVE'
                              ? 'bg-[#22D3EE]/20 text-[#22D3EE] border border-[#22D3EE]/40'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono truncate">{item.subtitle}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {item.shortcut && (
                      <span className="text-[10px] font-mono text-slate-400 bg-[#05070B] px-1.5 py-0.5 rounded border border-[rgba(148,163,184,0.12)]">
                        {item.shortcut}
                      </span>
                    )}
                    {isSelected && (
                      <CornerDownLeft className="w-3.5 h-3.5 text-[#22D3EE]" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-[#05070B] border-t border-[rgba(148,163,184,0.1)] flex items-center justify-between text-[10px] font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span>Navigation:</span>
            <kbd className="px-1.5 py-0.5 bg-[#0B1120] border border-[rgba(148,163,184,0.2)] rounded text-slate-300">↑</kbd>
            <kbd className="px-1.5 py-0.5 bg-[#0B1120] border border-[rgba(148,163,184,0.2)] rounded text-slate-300">↓</kbd>
            <span>Select:</span>
            <kbd className="px-1.5 py-0.5 bg-[#0B1120] border border-[rgba(148,163,184,0.2)] rounded text-slate-300">↵</kbd>
          </div>
          <div className="flex items-center gap-1.5">
            <span>VeriVox SIH26104</span>
          </div>
        </div>

      </div>
    </div>
  );
};
