import React, { useState } from 'react';
import { 
  Sliders, 
  Bell, 
  ShieldAlert, 
  PhoneCall, 
  MessageSquare, 
  Send, 
  Terminal, 
  Check, 
  Plus, 
  Trash2, 
  ArrowRight, 
  Layers, 
  Lock, 
  PhoneOff,
  Zap
} from 'lucide-react';
import { DEFAULT_ALERT_RULES } from '../data/mockData';
import { AlertRule } from '../types';

export const AlertConfigView: React.FC = () => {
  const [rules, setRules] = useState<AlertRule[]>(DEFAULT_ALERT_RULES);
  const [globalThreshold, setGlobalThreshold] = useState<number>(70);
  const [highValueCutoffInr, setHighValueCutoffInr] = useState<number>(1000000);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Channels state
  const [channels, setChannels] = useState({
    slack: true,
    sms: true,
    ivrCallback: true,
    siemWebhook: true,
    telecomKillswitch: true,
  });

  const handleToggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleSaveConfig = () => {
    setSaveToast('Policy rules deployed to active edge DSP nodes.');
    setTimeout(() => setSaveToast(null), 4000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase font-mono tracking-wider text-[#2E7DFF] font-semibold">
            Security Policy &amp; Orchestration
          </div>
          <h1 className="text-page-title">
            Enforcement Thresholds &amp; Alert Workflows
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Configure real-time automated response rules when synthetic voice clone confidence thresholds are crossed.
          </p>
        </div>

        <button
          onClick={handleSaveConfig}
          className="px-5 py-2.5 rounded-lg bg-[#2E7DFF] hover:bg-[#2566D8] text-white text-xs font-bold font-mono uppercase tracking-wider shadow flex items-center gap-2 transition-all"
        >
          <Check className="w-4 h-4" />
          <span>Save &amp; Deploy Policies</span>
        </button>
      </div>

      {saveToast && (
        <div className="p-3 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E] text-xs flex items-center gap-2 font-mono">
          <Check className="w-4 h-4 text-[#22C55E]" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Global Threshold Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Risk Threshold Slider */}
        <div className="p-6 rounded-xl bg-[#131A2A] border border-[#1F2937] space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-display">Global Synthetic Voice Risk Threshold</h3>
                <p className="text-xs text-slate-400 font-mono">Score triggering mandatory intervention</p>
              </div>
            </div>
            <span className="text-lg font-bold font-mono text-[#EF4444] bg-[#0A0E17] px-3 py-1 rounded-lg border border-[#1F2937]">
              {globalThreshold}%
            </span>
          </div>

          <input
            type="range"
            min="40"
            max="95"
            value={globalThreshold}
            onChange={(e) => setGlobalThreshold(Number(e.target.value))}
            className="w-full accent-[#EF4444] cursor-pointer"
          />

          <div className="flex justify-between text-[11px] text-slate-500 font-mono uppercase">
            <span>Aggressive (40%)</span>
            <span>Recommended (70%)</span>
            <span>Strict (90%)</span>
          </div>
        </div>

        {/* Financial Wire Cutoff */}
        <div className="p-6 rounded-xl bg-[#131A2A] border border-[#1F2937] space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-display">Mandatory Callback Transaction Limit</h3>
                <p className="text-xs text-slate-400 font-mono">Transfers exceeding this require verified 2FA</p>
              </div>
            </div>
            <span className="text-lg font-bold font-mono text-[#F59E0B] bg-[#0A0E17] px-3 py-1 rounded-lg border border-[#1F2937]">
              ₹{(highValueCutoffInr / 100000).toFixed(1)} Lakhs
            </span>
          </div>

          <input
            type="range"
            min="200000"
            max="5000000"
            step="100000"
            value={highValueCutoffInr}
            onChange={(e) => setHighValueCutoffInr(Number(e.target.value))}
            className="w-full accent-[#F59E0B] cursor-pointer"
          />

          <div className="flex justify-between text-[11px] text-slate-500 font-mono uppercase">
            <span>₹2 Lakhs</span>
            <span>₹10 Lakhs (Standard)</span>
            <span>₹50 Lakhs</span>
          </div>
        </div>

      </div>

      {/* Visual Role-Based Workflow Builder */}
      <div className="p-6 rounded-xl bg-[#131A2A] border border-[#1F2937] shadow-sm space-y-6">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-mono text-[#2E7DFF] font-semibold mb-1 uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5" />
            <span>Visual Policy Pipeline</span>
          </div>
          <h2 className="text-lg font-bold font-display text-white">
            Automated Enforcement Rule Engine
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            Define programmatic responses when synthetic voice markers align with high-risk financial intents.
          </p>
        </div>

        {/* Visual flow node preview */}
        <div className="p-4 rounded-xl bg-[#0A0E17] border border-[#1F2937] overflow-x-auto">
          <div className="flex items-center gap-3 min-w-[700px] text-xs">
            
            {/* Step 1: Input condition */}
            <div className="p-3 rounded-lg bg-[#2E7DFF]/10 border border-[#2E7DFF]/30 text-blue-200 flex-1">
              <div className="text-[10px] text-[#2E7DFF] font-mono uppercase tracking-wider">Trigger Condition</div>
              <div className="font-bold text-white mt-1 font-mono">Risk Score &gt; {globalThreshold}%</div>
              <div className="text-[11px] text-slate-400 font-mono">AND Tx &gt; ₹{(highValueCutoffInr / 100000).toFixed(0)} Lakhs</div>
            </div>

            <ArrowRight className="w-5 h-5 text-slate-600 flex-shrink-0" />

            {/* Step 2: Evaluation */}
            <div className="p-3 rounded-lg bg-[#131A2A] border border-[#1F2937] text-slate-300 flex-1">
              <div className="text-[10px] text-cyan-400 font-mono uppercase tracking-wider">Inference Evaluation</div>
              <div className="font-bold text-white mt-1 font-mono">Cross-check Voiceprint</div>
              <div className="text-[11px] text-slate-400 font-mono">&lt;36ms Edge Verification</div>
            </div>

            <ArrowRight className="w-5 h-5 text-slate-600 flex-shrink-0" />

            {/* Step 3: Multi-Action Enforce */}
            <div className="p-3 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 text-rose-200 flex-1">
              <div className="text-[10px] text-[#EF4444] font-mono uppercase tracking-wider">Enforcement Action</div>
              <div className="font-bold text-white mt-1 font-mono">Quarantine Transfer</div>
              <div className="text-[11px] text-slate-400 font-mono">Enqueue Out-of-Band Callback</div>
            </div>

          </div>
        </div>

        {/* Rule list */}
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`p-4 rounded-lg border transition-all ${
                rule.enabled
                  ? 'bg-[#0A0E17] border-[#1F2937]'
                  : 'bg-[#0A0E17]/40 border-[#1F2937]/50 opacity-60'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#2E7DFF] bg-[#131A2A] px-2 py-0.5 rounded border border-[#1F2937]">
                      {rule.id}
                    </span>
                    <h4 className="text-sm font-bold text-white">{rule.name}</h4>
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    IF <span className="text-[#F59E0B]">{rule.condition}</span> THEN <span className="text-[#EF4444] font-semibold">{rule.action}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                    <span>Applies to:</span>
                    {rule.appliesTo.map((target, idx) => (
                      <span key={idx} className="px-1.5 py-0.2 rounded bg-[#131A2A] text-slate-300 border border-[#1F2937]">
                        {target}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => handleToggleRule(rule.id)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2E7DFF]"></div>
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Alert Channel Toggles */}
      <div className="p-6 rounded-xl bg-[#131A2A] border border-[#1F2937] shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-bold font-display text-white">
            Dispatch Channels &amp; Integrations
          </h3>
          <p className="text-xs text-slate-400 font-mono">
            Real-time notification targets when high-risk voice impersonation events occur.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          
          <div className="p-3.5 rounded-lg bg-[#0A0E17] border border-[#1F2937] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-4 h-4 text-[#2E7DFF]" />
              <div>
                <div className="font-semibold text-white">Slack / Teams SOC Alerts</div>
                <div className="text-[11px] text-slate-400 font-mono">Direct webhook to security channel</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={channels.slack}
              onChange={() => setChannels({ ...channels, slack: !channels.slack })}
              className="accent-[#2E7DFF] cursor-pointer h-4 w-4"
            />
          </div>

          <div className="p-3.5 rounded-lg bg-[#0A0E17] border border-[#1F2937] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <PhoneCall className="w-4 h-4 text-[#22C55E]" />
              <div>
                <div className="font-semibold text-white">Automated IVR Callback</div>
                <div className="text-[11px] text-slate-400 font-mono">Out-of-band biometric prompt</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={channels.ivrCallback}
              onChange={() => setChannels({ ...channels, ivrCallback: !channels.ivrCallback })}
              className="accent-[#2E7DFF] cursor-pointer h-4 w-4"
            />
          </div>

          <div className="p-3.5 rounded-lg bg-[#0A0E17] border border-[#1F2937] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <div>
                <div className="font-semibold text-white">SIEM / Splunk Ingest</div>
                <div className="text-[11px] text-slate-400 font-mono">CEF / Syslog format feed</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={channels.siemWebhook}
              onChange={() => setChannels({ ...channels, siemWebhook: !channels.siemWebhook })}
              className="accent-[#2E7DFF] cursor-pointer h-4 w-4"
            />
          </div>

          <div className="p-3.5 rounded-lg bg-[#0A0E17] border border-[#1F2937] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Send className="w-4 h-4 text-[#F59E0B]" />
              <div>
                <div className="font-semibold text-white">SMS to Executive</div>
                <div className="text-[11px] text-slate-400 font-mono">Alert to registered mobile</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={channels.sms}
              onChange={() => setChannels({ ...channels, sms: !channels.sms })}
              className="accent-[#2E7DFF] cursor-pointer h-4 w-4"
            />
          </div>

          <div className="p-3.5 rounded-lg bg-[#0A0E17] border border-[#1F2937] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <PhoneOff className="w-4 h-4 text-[#EF4444]" />
              <div>
                <div className="font-semibold text-white">Telecom SS7 Disconnect</div>
                <div className="text-[11px] text-slate-400 font-mono">Hardware SIP drop signal</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={channels.telecomKillswitch}
              onChange={() => setChannels({ ...channels, telecomKillswitch: !channels.telecomKillswitch })}
              className="accent-[#2E7DFF] cursor-pointer h-4 w-4"
            />
          </div>

        </div>
      </div>

    </div>
  );
};
