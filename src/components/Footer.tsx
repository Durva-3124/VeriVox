import React from 'react';
import { useNavigate } from 'react-router-dom';
import { NavigationTab } from '../types';

interface FooterProps {
  onTabChange?: (tab: NavigationTab) => void;
}

export const Footer: React.FC<FooterProps> = ({ onTabChange }) => {
  const navigate = useNavigate();

  const handleNav = (tab: NavigationTab, routePath: string) => {
    if (onTabChange) {
      onTabChange(tab);
    }
    navigate(routePath);
  };

  return (
    <footer
      id="app-footer"
      className="w-full border-t border-[rgba(148,163,184,0.12)] bg-[#05070B]/95 backdrop-blur-sm py-4 px-4 sm:px-6 lg:px-8 z-30"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4 text-xs sm:text-[13px] text-slate-400 font-sans">
        {/* Left: App Brand & Hackathon Track */}
        <div className="flex items-center gap-2 flex-wrap justify-center md:justify-start">
          <span className="font-bold text-slate-100 tracking-tight">VeriVox</span>
          <span className="text-slate-600 font-bold">•</span>
          <span className="text-slate-400">Smart India Hackathon SIH26104</span>
        </div>

        {/* Center: System Domain Description */}
        <div className="text-center text-slate-400 text-xs sm:text-[13px] hidden sm:block">
          Acoustic Deepfake Forensics &amp; Regional Voice Impersonation Prevention
        </div>

        {/* Right: Quick Links */}
        <div className="flex items-center gap-5 sm:gap-6 justify-center md:justify-end">
          <button
            id="footer-nav-architecture"
            onClick={() => handleNav('how-it-works', '/app/how-it-works')}
            className="text-slate-300 hover:text-[#22D3EE] transition-colors cursor-pointer font-medium"
          >
            Architecture
          </button>
          <button
            id="footer-nav-benchmarks"
            onClick={() => handleNav('analytics', '/app/analytics')}
            className="text-slate-300 hover:text-[#22D3EE] transition-colors cursor-pointer font-medium"
          >
            Benchmarks
          </button>
          <button
            id="footer-nav-privacy"
            onClick={() => handleNav('privacy', '/app/settings')}
            className="text-slate-300 hover:text-[#22D3EE] transition-colors cursor-pointer font-medium"
          >
            Privacy
          </button>
        </div>
      </div>
    </footer>
  );
};
