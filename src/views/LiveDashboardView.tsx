import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Radio, 
  RotateCw, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Activity, 
  FlaskConical, 
  Sparkles, 
  ArrowUpRight, 
  History, 
  FileText,
  CheckCircle2,
  Lock,
  ArrowRight
} from 'lucide-react';

export const LiveDashboardView: React.FC = () => {
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshTimestamp, setRefreshTimestamp] = useState<string>('Just now');

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setRefreshTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 600);
  };

  const statCards = [
    {
      label: 'TOTAL ANALYSES',
      value: '24',
      unit: 'voice streams',
      detail: 'Multi-dialect telemetry active',
      hasArrow: true,
      icon: Activity,
      iconColor: 'text-[#00D8F6]',
      iconBg: 'bg-[#00D8F6]/10 border-[#00D8F6]/25',
      valueColor: 'text-white',
      detailColor: 'text-[#00D8F6]',
      cardBg: 'bg-[#070E1A]/90 border border-[rgba(148,163,184,0.12)]',
    },
    {
      label: 'AI VOICES DETECTED',
      value: '14',
      unit: 'synthetic clones',
      detail: 'High vocoder artifact correlation',
      hasArrow: false,
      icon: ShieldAlert,
      iconColor: 'text-[#EF4444]',
      iconBg: 'bg-[#EF4444]/10 border-[#EF4444]/25',
      valueColor: 'text-[#EF4444]',
      detailColor: 'text-[#EF4444]/90',
      cardBg: 'bg-[#150A10]/90 border border-[#EF4444]/20',
    },
    {
      label: 'HUMAN VOICES',
      value: '8',
      unit: 'authentic speakers',
      detail: 'Natural biological tremors verified',
      hasArrow: false,
      icon: ShieldCheck,
      iconColor: 'text-[#10B981]',
      iconBg: 'bg-[#10B981]/10 border-[#10B981]/25',
      valueColor: 'text-[#10B981]',
      detailColor: 'text-[#10B981]/90',
      cardBg: 'bg-[#061412]/90 border border-[#10B981]/20',
    },
    {
      label: 'HIGH-RISK ALERTS',
      value: '12',
      unit: 'prevention triggers',
      detail: 'Verification guidance issued',
      hasArrow: false,
      icon: AlertTriangle,
      iconColor: 'text-[#F59E0B]',
      iconBg: 'bg-[#F59E0B]/10 border-[#F59E0B]/25',
      valueColor: 'text-[#F59E0B]',
      detailColor: 'text-[#F59E0B]/90',
      cardBg: 'bg-[#181106]/90 border border-[#F59E0B]/20',
    },
  ];

  const actionCards = [
    {
      title: 'Run Voice Inspection',
      description: 'Record via microphone or upload WAV/MP3 to extract acoustic biomarkers.',
      icon: Radio,
      iconColor: 'text-[#00D8F6]',
      cardBorder: 'border-[#00D8F6]/40 hover:border-[#00D8F6] hover:shadow-lg hover:shadow-[#00D8F6]/10',
      cardBg: 'bg-[#061528]/80',
      route: '/app/voice-analysis',
    },
    {
      title: 'Controlled Attack Simulator',
      description: 'Generate synthetic Marathi/Hindi voice clone demonstrations for defensive evaluation.',
      icon: FlaskConical,
      iconColor: 'text-[#C084FC]',
      cardBorder: 'border-[#C084FC]/30 hover:border-[#C084FC] hover:shadow-lg hover:shadow-[#C084FC]/10',
      cardBg: 'bg-[#100B22]/80',
      route: '/app/attack-simulator',
    },
    {
      title: 'SIH Interactive Demo Tour',
      description: '11-step guided judge walkthrough showcasing full attack and detection loop in 2 minutes.',
      icon: Sparkles,
      iconColor: 'text-[#F59E0B]',
      cardBorder: 'border-[#F59E0B]/30 hover:border-[#F59E0B] hover:shadow-lg hover:shadow-[#F59E0B]/10',
      cardBg: 'bg-[#1A1208]/80',
      route: '/app/how-it-works',
    },
  ];

  const recentDetections = [
    {
      stream: 'marathi_ai_clone.wav',
      language: 'Marathi',
      result: 'AI-GENERATED',
      aiProb: '94.2%',
      riskLevel: 'HIGH',
      timestamp: '10:09 AM',
      isAi: true,
    },
    {
      stream: 'marathi_authentic_human.wav',
      language: 'Marathi',
      result: 'HUMAN',
      aiProb: '4.5%',
      riskLevel: 'LOW',
      timestamp: '09:09 AM',
      isAi: false,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-8">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-sans">
              Security Telemetry &amp; Operations
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#00D8F6]/15 text-[#00D8F6] border border-[#00D8F6]/30">
              SIH26104
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 font-sans">
            Real-time acoustic voice authenticity monitoring and regional impersonation threat intelligence.
          </p>
        </div>

        {/* Action Controls Top Right */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            type="button"
            id="dashboard-btn-refresh"
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#09111E] hover:bg-[#111D30] border border-[rgba(148,163,184,0.2)] text-slate-300 hover:text-white text-xs font-semibold font-mono transition-all cursor-pointer"
            title="Refresh active session telemetry"
          >
            <RotateCw className={`w-3.5 h-3.5 text-slate-400 ${isRefreshing ? 'animate-spin text-[#00D8F6]' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            id="dashboard-btn-new-analysis"
            onClick={() => {
              window.scrollTo({ top: 0 });
              navigate('/app/voice-analysis');
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00D8F6] hover:bg-[#06B6D4] text-[#05070B] font-bold text-xs shadow-lg shadow-[#00D8F6]/25 transition-all cursor-pointer transform active:scale-95"
          >
            <Radio className="w-4 h-4 animate-pulse text-[#05070B]" />
            <span>New Voice Analysis</span>
          </button>
        </div>
      </div>

      {/* 4 Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`p-5 rounded-2xl ${card.cardBg} transition-all relative overflow-hidden`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                  {card.label}
                </span>
                <div className={`p-1.5 rounded-lg border ${card.iconBg}`}>
                  <Icon className={`w-3.5 h-3.5 ${card.iconColor}`} />
                </div>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <span className={`text-3xl font-bold font-mono tracking-tight ${card.valueColor}`}>
                  {card.value}
                </span>
                <span className="text-xs text-slate-400 font-sans">
                  {card.unit}
                </span>
              </div>

              <div className={`mt-3 text-xs font-mono flex items-center gap-1 ${card.detailColor}`}>
                {card.hasArrow && <span className="font-bold">↗</span>}
                <span>{card.detail}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3 Module Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {actionCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              onClick={() => {
                window.scrollTo({ top: 0 });
                navigate(card.route);
              }}
              className={`p-5 rounded-2xl border ${card.cardBorder} ${card.cardBg} transition-all cursor-pointer group relative`}
            >
              <div className="flex items-center justify-between">
                <Icon className={`w-5 h-5 ${card.iconColor}`} />
                <ArrowUpRight className={`w-4 h-4 text-slate-400 group-hover:${card.iconColor} group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform`} />
              </div>

              <h3 className="mt-4 text-sm font-bold text-white group-hover:text-white transition-colors">
                {card.title}
              </h3>

              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed font-sans">
                {card.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Recent Detection Activity Table */}
      <div className="p-5 rounded-2xl bg-[#070B14] border border-[rgba(148,163,184,0.12)] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[rgba(148,163,184,0.08)]">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#00D8F6]" />
            <h2 className="text-sm font-bold text-white font-sans">
              Recent Detection Activity
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              window.scrollTo({ top: 0 });
              navigate('/app/history');
            }}
            className="text-xs font-semibold text-[#00D8F6] hover:text-[#38BDF8] flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>View Full Audit Logs</span>
            <span>→</span>
          </button>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[620px]">
            <thead>
              <tr className="text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-[rgba(148,163,184,0.08)]">
                <th className="py-2.5 px-3 font-semibold">AUDIO STREAM</th>
                <th className="py-2.5 px-3 font-semibold">LANGUAGE</th>
                <th className="py-2.5 px-3 font-semibold">RESULT</th>
                <th className="py-2.5 px-3 font-semibold">AI PROBABILITY</th>
                <th className="py-2.5 px-3 font-semibold">RISK LEVEL</th>
                <th className="py-2.5 px-3 font-semibold text-right">TIMESTAMP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(148,163,184,0.06)] text-xs font-mono">
              {recentDetections.map((row, idx) => (
                <tr 
                  key={idx}
                  onClick={() => {
                    window.scrollTo({ top: 0 });
                    navigate('/app/voice-analysis');
                  }}
                  className="hover:bg-[#0E1726]/60 transition-colors cursor-pointer group"
                >
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2 text-slate-200 group-hover:text-[#00D8F6] transition-colors">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-medium">{row.stream}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-300 font-sans">
                    {row.language}
                  </td>
                  <td className="py-3 px-3">
                    {row.isAi ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30">
                        {row.result}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                        {row.result}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 font-bold">
                    <span className={row.isAi ? 'text-[#EF4444]' : 'text-[#10B981]'}>
                      {row.aiProb}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    {row.riskLevel === 'HIGH' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40">
                        HIGH
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40">
                        LOW
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-400 text-[11px]">
                    {row.timestamp}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
