import React, { useState } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  ShieldAlert, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  Lock, 
  Globe, 
  TrendingUp, 
  Clock, 
  Phone,
  Building,
  Key,
  Calendar
} from 'lucide-react';
import { MOCK_INCIDENTS } from '../data/mockData';
import { FraudIncident } from '../types';

export const DetectionHistoryView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguageFilter, setSelectedLanguageFilter] = useState('all');
  const [selectedThreatTier, setSelectedThreatTier] = useState('all');
  const [selectedIncident, setSelectedIncident] = useState<FraudIncident | null>(null);

  const filteredIncidents = MOCK_INCIDENTS.filter((inc) => {
    const matchesSearch = 
      inc.targetExecutive.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.targetCompany.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.callerNumber.includes(searchQuery);

    const matchesLang = selectedLanguageFilter === 'all' || inc.language.toLowerCase().includes(selectedLanguageFilter.toLowerCase());
    const matchesTier = selectedThreatTier === 'all' || inc.threatTier === selectedThreatTier;

    return matchesSearch && matchesLang && matchesTier;
  });

  const handleExportAllJson = () => {
    const dataStr = JSON.stringify(filteredIncidents, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verivox_audit_export_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-16">
      
      {/* Top Header */}
      <div className="card-raised p-lg flex flex-col md:flex-row md:items-center justify-between gap-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[#22D3EE]/15 text-[#22D3EE] border border-[#22D3EE]/30 shadow-inner">
            <History className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-page-title">
                Detection History &amp; Forensic Audit Log
              </h1>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 font-mono uppercase tracking-wider">
                CERT-IN COMPLIANT
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Immutable chain-of-custody log of all voice sessions, synthesized anomalies, and automated enforcement actions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportAllJson}
            className="btn-cta-gradient flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-bold tracking-wider uppercase shadow-lg shadow-orange-500/20"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Audit Log (JSON)</span>
          </button>
        </div>
      </div>

      {/* Top Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-flat p-md space-y-sm">
          <div className="text-label">Total Intercepts Logged</div>
          <div className="text-xl font-bold font-mono text-white">3,842 Sessions</div>
          <div className="text-[11px] text-[#10B981] font-mono">100% Cryptographic verification</div>
        </div>

        <div className="card-flat p-md space-y-sm">
          <div className="text-label">Attacks Quarantined</div>
          <div className="text-xl font-bold font-mono text-[#EF4444]">384 Intercepts</div>
          <div className="text-[11px] text-rose-300 font-mono">Zero financial leakage</div>
        </div>

        <div className="card-flat p-md space-y-sm">
          <div className="text-label">Capital Secured (INR)</div>
          <div className="text-xl font-bold font-mono text-[#10B981]">₹42.8 Crore</div>
          <div className="text-[11px] text-slate-400 font-mono">Across 18 enterprise nodes</div>
        </div>

        <div className="card-flat p-md space-y-sm">
          <div className="text-label">Average Decision Latency</div>
          <div className="text-xl font-bold font-mono text-[#22D3EE]">36.4 ms</div>
          <div className="text-[11px] text-cyan-300 font-mono">Sub-50ms SIH standard</div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="card-raised p-lg space-y-md">
        
        {/* Filter Controls Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-md pb-md border-b border-[rgba(148,163,184,0.12)]">
          <div className="flex items-center gap-2">
            <h3 className="text-subsection-heading">
              Incident Audit Trail ({filteredIncidents.length} Records)
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search executive, ID, number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg bg-[#05070B] border border-[rgba(148,163,184,0.12)] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#22D3EE] w-48 sm:w-60 font-mono"
              />
            </div>

            {/* Language Filter */}
            <select
              value={selectedLanguageFilter}
              onChange={(e) => setSelectedLanguageFilter(e.target.value)}
              className="py-1.5 px-3 rounded-lg bg-[#05070B] border border-[rgba(148,163,184,0.12)] text-xs text-slate-300 focus:outline-none focus:border-[#22D3EE] font-mono"
            >
              <option value="all">All Languages</option>
              <option value="English">English / Hinglish</option>
              <option value="Hindi">Hindi</option>
              <option value="Tamil">Tamil</option>
              <option value="Telugu">Telugu</option>
              <option value="Marathi">Marathi</option>
              <option value="Malayalam">Malayalam</option>
              <option value="Punjabi">Punjabi</option>
            </select>

            {/* Threat Tier Filter */}
            <select
              value={selectedThreatTier}
              onChange={(e) => setSelectedThreatTier(e.target.value)}
              className="py-1.5 px-3 rounded-lg bg-[#05070B] border border-[rgba(148,163,184,0.12)] text-xs text-slate-300 focus:outline-none focus:border-[#22D3EE] font-mono"
            >
              <option value="all">All Threat Tiers</option>
              <option value="CRITICAL">Critical Threats</option>
              <option value="ELEVATED">Elevated Caution</option>
              <option value="LOW RISK">Low Risk / Natural</option>
            </select>
          </div>
        </div>

        {/* Incidents Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 font-mono">
            <thead className="bg-[#05070B] text-slate-400 uppercase text-[10px] border-b border-[rgba(148,163,184,0.12)]">
              <tr>
                <th className="py-3 px-3">Incident ID &amp; Time</th>
                <th className="py-3 px-3">Target Executive &amp; Entity</th>
                <th className="py-3 px-3">Claimed Caller</th>
                <th className="py-3 px-3">Amount (INR)</th>
                <th className="py-3 px-3">Risk Score</th>
                <th className="py-3 px-3">Synthesis Model</th>
                <th className="py-3 px-3">Action Enforced</th>
                <th className="py-3 px-3 text-right">Dossier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(148,163,184,0.08)]">
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Recorded voice analysis events, intercepted synthetic calls, and policy enforcement logs will appear here once processed by the detection pipeline.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-[#131B2E] transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-[#22D3EE] text-[11px]">{inc.id}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{inc.timestamp}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-white font-sans">{inc.targetExecutive}</div>
                      <div className="text-[11px] text-slate-400">{inc.targetRole} · {inc.targetCompany}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-slate-300">{inc.callerNumber}</div>
                      <div className="text-[10px] text-slate-400">{inc.callerLocation}</div>
                    </td>
                    <td className="py-3 px-3 font-bold text-amber-400">
                      ₹{inc.transactionAmountInr.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[11px] ${
                        inc.riskScore >= 70 
                          ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30' 
                          : 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30'
                      }`}>
                        {inc.riskScore}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-300 text-[11px]">
                      {inc.synthesisEngineDetected}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-[11px] font-semibold ${
                        inc.actionTaken.includes('Blocked') || inc.actionTaken.includes('Quarantined')
                          ? 'text-[#EF4444]'
                          : 'text-[#10B981]'
                      }`}>
                        {inc.actionTaken}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setSelectedIncident(inc)}
                        className="p-1.5 rounded bg-[#05070B] hover:bg-[#1E293B] text-slate-300 hover:text-white border border-[rgba(148,163,184,0.12)] transition-colors"
                        title="View Full Forensic Dossier"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Incident Detail Dossier Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-xl rounded-xl bg-[#0B1120] border border-[rgba(148,163,184,0.2)] shadow-2xl p-6 space-y-4 text-slate-200">
            
            <div className="flex items-center justify-between border-b border-[rgba(148,163,184,0.12)] pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#EF4444]" />
                <h3 className="text-base font-bold text-white font-slab">
                  Forensic Dossier: {selectedIncident.id}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedIncident(null)}
                className="p-1 rounded bg-[#05070B] text-slate-400 hover:text-white border border-[rgba(148,163,184,0.12)]"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-[#05070B] rounded-lg border border-[rgba(148,163,184,0.12)]">
                  <div className="text-slate-400 text-[10px] uppercase">Target Executive:</div>
                  <div className="text-white font-bold mt-0.5 font-sans">{selectedIncident.targetExecutive}</div>
                  <div className="text-slate-300 text-[11px]">{selectedIncident.targetRole}</div>
                </div>
                <div className="p-3 bg-[#05070B] rounded-lg border border-[rgba(148,163,184,0.12)]">
                  <div className="text-slate-400 text-[10px] uppercase">Enterprise Organization:</div>
                  <div className="text-white font-bold mt-0.5 font-sans">{selectedIncident.targetCompany}</div>
                  <div className="text-slate-300 text-[11px]">{selectedIncident.callerLocation}</div>
                </div>
              </div>

              <div className="p-3 bg-[#05070B] rounded-lg border border-[rgba(148,163,184,0.12)] space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Transaction Value:</span>
                  <span className="text-amber-400 font-bold">₹{selectedIncident.transactionAmountInr.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Synthesis Engine Detected:</span>
                  <span className="text-[#EF4444]">{selectedIncident.synthesisEngineDetected}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Carrier Route:</span>
                  <span className="text-slate-300">{selectedIncident.carrierType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Decision Latency:</span>
                  <span className="text-[#10B981]">{selectedIncident.latencyMs} ms</span>
                </div>
              </div>

              {/* Biomarkers Detected */}
              <div className="p-3 bg-[#05070B] rounded-lg border border-[rgba(148,163,184,0.12)] space-y-1.5">
                <div className="text-[10px] text-slate-400 uppercase">Biomarkers Isolated:</div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedIncident.biomarkersDetected.map((bio, idx) => (
                    <span key={idx} className="text-[10px] px-2 py-0.5 rounded bg-[#EF4444]/15 text-rose-300 border border-[#EF4444]/30">
                      {bio}
                    </span>
                  ))}
                </div>
              </div>

              {/* Cryptographic SHA-256 Hash */}
              <div className="p-3 bg-[#05070B] rounded-lg border border-[rgba(148,163,184,0.12)] space-y-1 text-[11px]">
                <div className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                  <Key className="w-3 h-3 text-[#22D3EE]" />
                  <span>SIH Cryptographic Audit Hash:</span>
                </div>
                <div className="text-[#22D3EE] break-all select-all">
                  {selectedIncident.complianceLogHash}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedIncident(null)}
                className="px-4 py-2 rounded-lg bg-[#05070B] text-slate-300 hover:bg-slate-800 text-xs font-semibold border border-[rgba(148,163,184,0.12)] font-mono uppercase tracking-wider"
              >
                Close Dossier
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
