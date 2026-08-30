import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { Footer } from '../components/Footer';
import { CommandPalette } from '../components/CommandPalette';
import { NavigationTab } from '../types';

export const WorkspaceLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Map pathname to NavigationTab for component compatibility
  const getCurrentTab = (): NavigationTab => {
    const path = location.pathname;
    if (path.includes('/app/voice-analysis')) return 'analysis';
    if (path.includes('/app/attack-simulator')) return 'simulation';
    if (path.includes('/app/history')) return 'history';
    if (path.includes('/app/model-insights')) return 'insights';
    if (path.includes('/app/alerts')) return 'alerts';
    if (path.includes('/app/analytics')) return 'analytics';
    if (path.includes('/app/how-it-works')) return 'how-it-works';
    if (path.includes('/app/settings')) return 'privacy';
    if (path.includes('/app/api')) return 'api';
    return 'dashboard';
  };

  const currentTab = getCurrentTab();

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [location.pathname]);

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

  const handleTabChange = (tab: NavigationTab) => {
    switch (tab) {
      case 'landing':
        navigate('/');
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
      {/* Quick Command Palette Modal */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={handleTabChange}
        onSelectScenario={() => {
          navigate('/app/voice-analysis');
        }}
      />

      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        isWorkspace={true}
        onTabChange={handleTabChange}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
        isMobileSidebarOpen={isMobileSidebarOpen}
        onStartDemo={() => navigate('/app/dashboard')}
      />

      {/* Main Row Layout with Sidebar and Outlet */}
      <div className="flex-1 flex flex-row min-h-[calc(100vh-4rem)] relative">
        {/* Left Cyber Defense Console Sidebar - Desktop */}
        <div className="hidden lg:block">
          <Sidebar
            currentTab={currentTab}
            onTabChange={handleTabChange}
            onStartDemo={() => navigate('/app/dashboard')}
          />
        </div>

        {/* Mobile Sidebar Overlay Drawer */}
        <AnimatePresence>
          {isMobileSidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileSidebarOpen(false)}
                className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
              />
              <motion.div
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-16 left-0 bottom-0 z-50 w-64 bg-[#070B14] shadow-2xl lg:hidden overflow-y-auto"
              >
                <Sidebar
                  currentTab={currentTab}
                  onTabChange={(tab) => {
                    handleTabChange(tab);
                    setIsMobileSidebarOpen(false);
                  }}
                  onStartDemo={() => {
                    navigate('/app/dashboard');
                    setIsMobileSidebarOpen(false);
                  }}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main Content Area with Outlet & Transitions */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full max-w-7xl mx-auto"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Global Footer */}
      <Footer onTabChange={handleTabChange} />
    </div>
  );
};
