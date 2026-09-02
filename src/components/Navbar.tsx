import React from 'react';
import { 
  ShieldCheck, 
  Search, 
  Sparkles,
  Menu,
  X,
  ArrowLeft,
  Radio
} from 'lucide-react';
import { NavigationTab } from '../types';

interface NavbarProps {
  currentTab: NavigationTab;
  isWorkspace?: boolean;
  onTabChange: (tab: NavigationTab) => void;
  onStartDemo?: () => void;
  onOpenCommandPalette?: () => void;
  onToggleMobileSidebar?: () => void;
  isMobileSidebarOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  isWorkspace = false,
  onTabChange,
  onStartDemo,
  onOpenCommandPalette,
  onToggleMobileSidebar,
  isMobileSidebarOpen = false,
}) => {
  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-[#05070B]/95 border-b border-[rgba(148,163,184,0.12)] transition-colors">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Brand & Logo with Mobile Menu Trigger */}
          <div className="flex items-center gap-3">
            {/* Mobile Sidebar Toggle in Workspace */}
            {isWorkspace && onToggleMobileSidebar && (
              <button
                onClick={onToggleMobileSidebar}
                className="lg:hidden p-2 rounded-lg bg-[#0B1120] text-slate-300 hover:text-white border border-[rgba(148,163,184,0.15)] cursor-pointer"
                aria-label="Toggle Navigation Menu"
              >
                {isMobileSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            )}

            <div 
              className="flex items-center gap-3 cursor-pointer group select-none"
              onClick={() => onTabChange('landing')}
            >
              <div className="relative w-10 h-10 rounded-xl bg-[#091527] border border-[#22D3EE]/40 flex items-center justify-center shadow-lg shadow-[#22D3EE]/20 group-hover:border-[#22D3EE] transition-all">
                <div className="relative flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-[#22D3EE]" />
                  <span className="absolute -bottom-1 -right-1 w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-slab text-lg font-bold tracking-tight text-white group-hover:text-[#22D3EE] transition-colors">
                    VeriVox <span className="text-[#22D3EE]">AI</span>
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#22D3EE]/15 text-[#22D3EE] border border-[#22D3EE]/30 font-mono">
                    SIH26104
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans tracking-tight hidden sm:block">
                  Detect. Verify. Defend Against AI Voice Impersonation.
                </p>
              </div>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            {/* Quick Command Palette Button (Cmd+K) */}
            {onOpenCommandPalette && (
              <button
                id="header-btn-cmd-palette"
                onClick={onOpenCommandPalette}
                className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#0B1120] hover:bg-[#131B2E] border border-[rgba(148,163,184,0.15)] text-slate-300 hover:text-white transition-all text-xs font-mono group cursor-pointer"
                title="Quick Access Command Palette (Press ⌘K or Ctrl+K)"
              >
                <Search className="w-3.5 h-3.5 text-[#22D3EE] group-hover:scale-110 transition-transform" />
                <span className="text-[11px] text-slate-400">Search</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[#05070B] border border-[rgba(148,163,184,0.2)] text-[10px] font-bold text-slate-300">
                  ⌘K
                </kbd>
              </button>
            )}

            {/* Acoustic Defense Active Status Pill */}
            <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#041D1A] border border-[#10B981]/50 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#10B981] inline-block"></span>
              <span className="text-xs font-medium text-[#10B981]">
                Acoustic Defense Active
              </span>
            </div>

            {/* Context Switcher Button: Exit Workspace vs Open Workspace */}
            {isWorkspace ? (
              <button
                id="header-btn-exit-workspace"
                onClick={() => onTabChange('landing')}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#071322] hover:bg-[#0c1f36] border border-[#22D3EE]/50 hover:border-[#22D3EE] text-white shadow-sm transition-all cursor-pointer"
                title="Return to Public Landing Page"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-[#22D3EE]" />
                <span>Home View</span>
              </button>
            ) : (
              <button
                id="header-btn-open-workspace"
                onClick={() => onTabChange('dashboard')}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#071322] hover:bg-[#0c1f36] border border-[#22D3EE]/50 hover:border-[#22D3EE] text-white shadow-sm transition-all cursor-pointer"
                title="Enter Cyber Defense Console"
              >
                <Radio className="w-3.5 h-3.5 text-[#22D3EE]" />
                <span>Open Workspace</span>
              </button>
            )}

            {/* START SIH DEMO Button with vibrant gradient */}
            <button
              id="header-btn-start-demo"
              onClick={onStartDemo ? onStartDemo : () => onTabChange('dashboard')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#FF6B00] via-[#FA7E0A] to-[#FF2D55] hover:from-[#EA580C] hover:to-[#E11D48] shadow-lg shadow-orange-500/35 active:scale-95 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-white" />
              <span className="tracking-wider uppercase font-bold text-xs">START SIH DEMO</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
