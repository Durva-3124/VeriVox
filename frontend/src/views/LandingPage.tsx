import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { LandingView } from './LandingView';
import { CommandPalette } from '../components/CommandPalette';
import { NavigationTab } from '../types';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);

  // Global Keyboard Shortcuts (Cmd+K / Ctrl+K for Palette)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavigate = (tab: NavigationTab) => {
    switch (tab) {
      case 'landing':
        navigate('/');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'dashboard':
        navigate('/app/dashboard');
        break;
      case 'analysis':
        navigate('/app/voice-analysis');
        break;
      case 'simulation':
        navigate('/app/attack-simulator');
        break;
      case 'history':
        navigate('/app/history');
        break;
      case 'insights':
        navigate('/app/model-insights');
        break;
      case 'alerts':
        navigate('/app/alerts');
        break;
      case 'analytics':
        navigate('/app/analytics');
        break;
      case 'how-it-works':
        navigate('/app/how-it-works');
        break;
      case 'privacy':
        navigate('/app/settings');
        break;
      case 'api':
        navigate('/app/api');
        break;
      default:
        navigate('/app/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#05070B] text-slate-100 selection:bg-[#22D3EE]/30 selection:text-white font-sans antialiased">
      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={handleNavigate}
        onSelectScenario={() => {
          navigate('/app/voice-analysis');
        }}
      />

      {/* Top Navbar in Landing mode (no sidebar) */}
      <Navbar
        currentTab="landing"
        isWorkspace={false}
        onTabChange={handleNavigate}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onStartDemo={() => navigate('/app/dashboard')}
      />

      {/* Full-width Main Landing Content */}
      <main className="flex-1 w-full">
        <LandingView onNavigate={handleNavigate} />
      </main>

      {/* Global Footer */}
      <Footer onTabChange={handleNavigate} />
    </div>
  );
};
