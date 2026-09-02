import React, { useState } from 'react';
import { 
  BarChart, 
  Bar, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  CartesianGrid 
} from 'recharts';
import { 
  ShieldAlert, 
  ShieldCheck, 
  TrendingUp, 
  Search, 
  Filter, 
  Download, 
  IndianRupee, 
  Users, 
  CheckCircle2, 
  AlertTriangle,
  Globe,
  Lock,
  Eye
} from 'lucide-react';
import { 
  MOCK_INCIDENTS, 
  ANALYTICS_TREND_DATA, 
  TARGETED_ROLES_DATA, 
  RISK_DISTRIBUTION_DATA, 
  ATTACK_BY_LANGUAGE_DATA 
} from '../data/mockData';
import { FraudIncident } from '../types';

export const AnalyticsView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguageFilter, setSelectedLanguageFilter] = useState('all');
  const [selectedIncident, setSelectedIncident] = useState<FraudIncident | null>(null);

  const filteredIncidents = MOCK_INCIDENTS.filter((inc) => {
    const matchesSearch = 
      inc.targetExecutive.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.targetCompany.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.callerNumber.includes(searchQuery);

    const matchesLang = selectedLanguageFilter === 'all' || inc.language.toLowerCase().includes(selectedLanguageFilter.toLowerCase());

    return matchesSearch && matchesLang;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="text-xs uppercase font-mono tracking-wider text-[#2E7DFF] font-semibold">
            Threat Intelligence &amp; Operational Metrics
          </div>
          <h1 className="heading-page mt-2">
            Enterprise Voice Fraud Analytics
          </h1>
          <p className="text-body-small mt-2 text-slate-300">
            Aggregated telemetry across 3,800+ inspected corporate and banking audio sessions.
          </p>
        </div>

        {/* Top KPIs */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="card-raised px-4 py-3 text-right flex-1">
            <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Financial Loss Prevented</div>
            <div className="text-lg font-bold font-mono text-[#22C55E] mt-1">₹42.8 Crore</div>
          </div>
          <div className="card-raised px-4 py-3 text-right flex-1">
            <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Synthetic Attacks Blocked</div>
            <div className="text-lg font-bold font-mono text-[#EF4444] mt-1">384 Intercepts</div>
          </div>
        </div>
      </div>

      {/* Top 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-raised p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-300 text-xs font-mono uppercase tracking-wider font-semibold">
            <span>Overall Detection Accuracy</span>
            <ShieldCheck className="icon-md icon-success" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">99.4%</div>
          <div className="text-[11px] text-[#22C55E] flex items-center gap-1 font-mono font-medium">
            <TrendingUp className="w-3 h-3" /> +1.2% over standard GMM baseline
          </div>
        </div>

        <div className="card-raised p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-300 text-xs font-mono uppercase tracking-wider font-semibold">
            <span>Average Edge Latency</span>
            <TrendingUp className="icon-md icon-primary" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#2E7DFF]">36.4 ms</div>
          <div className="text-[11px] text-slate-300 font-mono">
            Sub-50ms target under SIH26104
          </div>
        </div>

        <div className="card-raised p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-300 text-xs font-mono uppercase tracking-wider font-semibold">
            <span>High-Risk Intercept Rate</span>
            <ShieldAlert className="icon-md icon-danger" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#EF4444]">98.8%</div>
          <div className="text-[11px] text-slate-300 font-mono">
            Zero verified financial leakage
          </div>
        </div>

        <div className="card-raised p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-300 text-xs font-mono uppercase tracking-wider font-semibold">
            <span>Indic Languages Monitored</span>
            <Globe className="icon-md icon-primary" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">12 Languages</div>
          <div className="text-[11px] text-slate-300 font-mono">
            Pan-India accent resilience
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 30-Day Attack vs Saved Trend (8 cols) */}
        <div className="card-elevated lg:col-span-8 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold font-display text-white">
                30-Day Intercept Trend &amp; Capital Protected (₹ Lakhs)
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Number of synthetic voice attacks blocked vs capital secured
              </p>
            </div>
            <span className="text-[10px] font-mono uppercase font-bold text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded border border-[#22C55E]/20">
              Live Threat Stream
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ANALYTICS_TREND_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLoss" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22C55E" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#22C55E" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="colorAttacks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                <XAxis dataKey="day" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0A0E17', borderColor: '#1F2937', borderRadius: '8px', fontSize: '12px', color: '#fff' }} 
                />
                <Area type="monotone" dataKey="totalLossSavedLakhs" name="Loss Prevented (₹ Lakhs)" stroke="#22C55E" strokeWidth={2} fillOpacity={1} fill="url(#colorLoss)" />
                <Area type="monotone" dataKey="attacksBlocked" name="Attacks Blocked" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colorAttacks)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Most Targeted Executive Roles (4 cols) */}
        <div className="card-elevated lg:col-span-4 p-6 space-y-4">
          <div>
            <h3 className="text-sm font-bold font-display text-white">
              Most Targeted Executive Roles
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Impersonation frequency across enterprise hierarchy
            </p>
          </div>

          <div className="space-y-3 pt-1">
            {TARGETED_ROLES_DATA.map((role) => (
              <div key={role.role} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 truncate max-w-[200px]" title={role.role}>
                    {role.role}
                  </span>
                  <span className="font-mono font-bold text-white">{role.percentage}%</span>
                </div>
                <div className="h-2 w-full bg-[#0A0E17] rounded-full overflow-hidden border border-[#1F2937]">
                  <div 
                    className="h-full rounded-full transition-all duration-500" 
                    style={{ width: `${role.percentage}%`, backgroundColor: role.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-[#0A0E17] rounded-lg border border-[#1F2937] text-[11px] text-slate-400 font-mono">
            <strong className="text-[#EF4444]">Insight:</strong> CFOs &amp; Finance Heads represent <strong>59%</strong> of all targeted voice-cloning fraud vectors.
          </div>
        </div>

      </div>

      {/* Secondary Charts: Risk Distribution & Language Attack Vectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Risk Distribution Breakdown */}
        <div className="card-elevated p-6 space-y-4">
          <div>
            <h3 className="text-sm font-bold font-display text-white">
              Risk Score Distribution Across All Monitored Calls
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Classification breakdown across 4,000+ incoming voice sessions
            </p>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={RISK_DISTRIBUTION_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                <XAxis dataKey="band" stroke="#64748B" fontSize={10} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0A0E17', borderColor: '#1F2937', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                />
                <Bar dataKey="count" name="Calls Count" radius={[4, 4, 0, 0]}>
                  {RISK_DISTRIBUTION_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Attack Vectors by Indic Language */}
        <div className="card-elevated p-6 space-y-4">
          <div>
            <h3 className="text-sm font-bold font-display text-white">
              Attack Synthesis Vectors by Language &amp; Dialect
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Primary language models exploited by adversarial actors
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {ATTACK_BY_LANGUAGE_DATA.map((item) => (
              <div key={item.language} className="flex items-center justify-between p-3 rounded-lg bg-[#0A0E17] border border-[#1F2937] text-xs">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#2E7DFF]" />
                  <span className="font-semibold text-slate-200">{item.language}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-slate-400">{item.count} attacks</span>
                  <span className="font-mono font-bold text-[#2E7DFF] bg-[#2E7DFF]/10 px-2 py-0.5 rounded border border-[#2E7DFF]/20">
                    {item.share}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Filterable Recent Incidents Table */}
      <div className="card-elevated p-6 space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1F2937]">
          <div>
            <h3 className="text-base font-bold font-display text-white">
              Recent Intercepted Incidents &amp; Enforcement Log
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Complete audit trail of synthetic voice attacks across connected enterprise PBX nodes.
            </p>
          </div>

          {/* Search and filter controls */}
          <div className="flex flex-wrap items-center gap-2 w-full">
            <div className="relative flex-1 min-w-[250px] sm:flex-none">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search executive, ID, number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-48 md:w-64 pl-8 pr-3 py-1.5 rounded-lg bg-[#0A0E17] border border-[#1F2937] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#2E7DFF] font-mono"
              />
            </div>

            <select
              value={selectedLanguageFilter}
              onChange={(e) => setSelectedLanguageFilter(e.target.value)}
              className="py-1.5 px-3 rounded-lg bg-[#0A0E17] border border-[#1F2937] text-xs text-slate-300 focus:outline-none focus:border-[#2E7DFF] font-mono"
            >
              <option value="all">All Languages</option>
              <option value="English">English / Hinglish</option>
              <option value="Hindi">Hindi</option>
              <option value="Tamil">Tamil</option>
              <option value="Telugu">Telugu</option>
              <option value="Marathi">Marathi</option>
              <option value="Malayalam">Malayalam</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#0A0E17] text-slate-400 uppercase font-mono text-[10px] border-b border-[#1F2937]">
              <tr>
                <th className="py-3 px-3">Incident ID</th>
                <th className="py-3 px-3">Target Executive &amp; Role</th>
                <th className="py-3 px-3">Amount (INR)</th>
                <th className="py-3 px-3">Risk Score</th>
                <th className="py-3 px-3">Synthesis Model</th>
                <th className="py-3 px-3">Language</th>
                <th className="py-3 px-3">Action Enforced</th>
                <th className="py-3 px-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2937] font-sans">
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500 font-mono">
                    No matching incidents found.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">{inc.id}</td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-white">{inc.targetExecutive}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{inc.targetRole} · {inc.targetCompany}</div>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-[#F59E0B]">
                      ₹{inc.transactionAmountInr.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                        inc.riskScore >= 70 
                          ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30' 
                          : 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30'
                      }`}>
                        {inc.riskScore}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-300 font-mono text-[11px]">
                      {inc.synthesisEngineDetected}
                    </td>
                    <td className="py-3 px-3 text-slate-400">{inc.language}</td>
                    <td className="py-3 px-3">
                      <span className={`text-[11px] font-semibold font-mono ${
                        inc.actionTaken.includes('Blocked') || inc.actionTaken.includes('Quarantined')
                          ? 'text-[#EF4444]'
                          : 'text-[#22C55E]'
                      }`}>
                        {inc.actionTaken}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setSelectedIncident(inc)}
                        className="p-1 rounded bg-[#0A0E17] hover:bg-slate-800 text-slate-300 hover:text-white border border-[#1F2937]"
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

      {/* Incident Detail Drawer/Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="card-critical w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1F2937] pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#EF4444]" />
                <h3 className="text-base font-bold text-white font-display">Incident Dossier: {selectedIncident.id}</h3>
              </div>
              <button onClick={() => setSelectedIncident(null)} className="text-slate-400 hover:text-white font-mono">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-[#0A0E17] rounded-lg border border-[#1F2937]">
                  <div className="text-slate-500 text-[10px] font-mono uppercase">Target Executive:</div>
                  <div className="text-white font-semibold mt-0.5">{selectedIncident.targetExecutive}</div>
                  <div className="text-slate-400 text-[11px] font-mono">{selectedIncident.targetRole}</div>
                </div>
                <div className="p-2.5 bg-[#0A0E17] rounded-lg border border-[#1F2937]">
                  <div className="text-slate-500 text-[10px] font-mono uppercase">Target Entity:</div>
                  <div className="text-white font-semibold mt-0.5">{selectedIncident.targetCompany}</div>
                  <div className="text-slate-400 text-[11px] font-mono">{selectedIncident.callerLocation}</div>
                </div>
              </div>

              <div className="p-3 bg-[#0A0E17] rounded-lg border border-[#1F2937] space-y-1.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Transaction Value:</span>
                  <span className="text-[#F59E0B] font-bold">₹{selectedIncident.transactionAmountInr.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Synthesis Engine Identified:</span>
                  <span className="text-[#EF4444]">{selectedIncident.synthesisEngineDetected}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Carrier Route:</span>
                  <span className="text-slate-300">{selectedIncident.carrierType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Decision Latency:</span>
                  <span className="text-[#22C55E]">{selectedIncident.latencyMs} ms</span>
                </div>
              </div>

              <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg text-slate-200 text-xs">
                <strong className="block text-[#EF4444] mb-1 font-mono uppercase text-[10px]">Enforcement Outcome:</strong>
                {selectedIncident.actionTaken}. Audio feature vector logged for SIH forensic audit.
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedIncident(null)}
                className="px-4 py-2 rounded-lg bg-[#0A0E17] text-slate-200 hover:bg-slate-800 text-xs font-semibold border border-[#1F2937] font-mono uppercase tracking-wider"
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
