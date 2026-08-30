import React from 'react';
import { 
  LayoutDashboard, 
  Radio, 
  FlaskConical, 
  History, 
  BarChart3, 
  BookOpen, 
  ShieldCheck, 
  Settings, 
  Shield, 
  Globe, 
  Zap,
  Sparkles,
  Sliders,
  Terminal,
  Activity
} from 'lucide-react';
import { NavigationTab } from '../types';

interface SidebarProps {
  currentTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  onStartDemo?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  onStartDemo,
}) => {
  const menuItems = [
    {
      id: 'dashboard' as NavigationTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: undefined,
    },
    {
      id: 'analysis' as NavigationTab,
      label: 'Voice Analysis',
      icon: Radio,
      badge: 'CORE',
      badgeColor: 'bg-[#22D3EE]/20 text-[#22D3EE] border-[#22D3EE]/40',
    },
    {
      id: 'simulation' as NavigationTab,
      label: 'Attack Simulator',
      icon: FlaskConical,
      badge: 'MODULE A',
      badgeColor: 'bg-[#8B5CF6]/20 text-[#C084FC] border-[#8B5CF6]/40',
    },
    {
      id: 'history' as NavigationTab,
      label: 'Detection History',
      icon: History,
      badge: undefined,
    },
    {
      id: 'insights' as NavigationTab,
      label: 'Model Insights',
      icon: BarChart3,
      badge: 'METRICS',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    },
    {
      id: 'alerts' as NavigationTab,
      label: 'Alert Policies',
      icon: Sliders,
      badge: 'RULES',
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    },
    {
      id: 'api' as NavigationTab,
      label: 'Developer API',
      icon: Terminal,
      badge: 'SDK',
      badgeColor: 'bg-sky-500/20 text-sky-400 border-sky-500/40',
    },
    {
      id: 'how-it-works' as NavigationTab,
      label: 'How It Works',
      icon: BookOpen,
      badge: undefined,
    },
    {
      id: 'privacy' as NavigationTab,
      label: 'Settings & Privacy',
      icon: ShieldCheck,
      badge: undefined,
    },
  ];

  return (
    <aside className="w-64 shrink-0 bg-[#070B14] border-r border-[rgba(148,163,184,0.12)] flex flex-col justify-between p-4 min-h-[calc(100vh-4.5rem)] select-none">
      <div className="space-y-6">
        {/* Section Title */}
        <div className="px-2">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
            CYBER DEFENSE CONSOLE
          </p>
        </div>

        {/* Navigation Menu Links */}
        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                id={`sidebar-nav-${item.id}`}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all group cursor-pointer ${
                  isActive
                    ? 'bg-[#0E1E38] text-white border border-[#22D3EE]/40 shadow-sm shadow-[#22D3EE]/5'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-[#0B1322] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-[#22D3EE]' : 'text-slate-400 group-hover:text-slate-200'
                  }`} />
                  <span className={isActive ? 'font-bold text-white' : ''}>{item.label}</span>
                </div>

                {item.badge && (
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom SIH26104 Focus Card & Meta Info */}
      <div className="space-y-4 pt-6 border-t border-[rgba(148,163,184,0.1)]">
        
        {/* SIH26104 Focus Card */}
        <div className="p-3.5 rounded-xl bg-[#091222] border border-[#22D3EE]/25 space-y-2 relative overflow-hidden">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-[#22D3EE]/20 flex items-center justify-center text-[#22D3EE]">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-[#22D3EE] font-mono tracking-wide">
              SIH26104 Focus
            </span>
          </div>

          <p className="text-[11px] text-slate-300 leading-relaxed">
            Real-time acoustic fraud mitigation for Indian regional voice calls.
          </p>

          <div className="pt-1 flex items-center justify-between text-[10px] font-mono">
            <span className="text-slate-400">Accuracy: <strong className="text-slate-200">94.8%</strong></span>
            <span className="text-[#10B981] font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
              Ensemble Active
            </span>
          </div>
        </div>

        {/* Version & Languages Footer */}
        <div className="flex items-center justify-between px-1 text-[11px] font-mono text-slate-400">
          <span>VeriVox v1.0</span>
          <button 
            onClick={() => onTabChange('insights')}
            className="text-[#22D3EE] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Globe className="w-3 h-3" />
            <span>8 Languages</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
