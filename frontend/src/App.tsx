import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { LandingPage } from './views/LandingPage';
import { WorkspaceLayout } from './layouts/WorkspaceLayout';

// Lazy-loaded workspace route views for optimized bundle loading
const LiveDashboardView = lazy(() => import('./views/LiveDashboardView').then(m => ({ default: m.LiveDashboardView })));
const VoiceAnalysisCoreView = lazy(() => import('./views/VoiceAnalysisCoreView').then(m => ({ default: m.VoiceAnalysisCoreView })));
const AttackSimulationView = lazy(() => import('./views/AttackSimulationView').then(m => ({ default: m.AttackSimulationView })));
const DetectionHistoryView = lazy(() => import('./views/DetectionHistoryView').then(m => ({ default: m.DetectionHistoryView })));
const ModelInsightsView = lazy(() => import('./views/ModelInsightsView').then(m => ({ default: m.ModelInsightsView })));
const AlertConfigView = lazy(() => import('./views/AlertConfigView').then(m => ({ default: m.AlertConfigView })));
const AnalyticsView = lazy(() => import('./views/AnalyticsView').then(m => ({ default: m.AnalyticsView })));
const PrivacyArchitectureView = lazy(() => import('./views/PrivacyArchitectureView').then(m => ({ default: m.PrivacyArchitectureView })));
const DeveloperApiView = lazy(() => import('./views/DeveloperApiView').then(m => ({ default: m.DeveloperApiView })));

const RouteLoadingFallback = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col items-center justify-center space-y-4">
    <div className="w-10 h-10 rounded-xl bg-[#0B1120] border border-[#22D3EE]/40 flex items-center justify-center shadow-lg shadow-[#22D3EE]/10 animate-pulse">
      <Radio className="w-5 h-5 text-[#22D3EE]" />
    </div>
    <div className="text-xs font-mono text-slate-400 tracking-wider uppercase flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full bg-[#22D3EE] animate-ping" />
      Initializing forensic telemetry view...
    </div>
  </div>
);

export default function App() {
  // Enforce dark mode forensic console theme
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('dark');
    root.classList.remove('light');
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Landing View (No Sidebar, Full-Width) */}
        <Route path="/" element={<LandingPage />} />

        {/* Cyber Defense Console Workspace (Sidebar + Responsive Outlet) */}
        <Route path="/app" element={<WorkspaceLayout />}>
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          
          <Route
            path="dashboard"
            element={
              <Suspense fallback={<RouteLoadingFallback />}>
                <LiveDashboardView />
              </Suspense>
            }
          />
          
          <Route
            path="voice-analysis"
            element={
              <Suspense fallback={<RouteLoadingFallback />}>
                <VoiceAnalysisCoreView />
              </Suspense>
            }
          />
          
          <Route
            path="attack-simulator"
            element={
              <Suspense fallback={<RouteLoadingFallback />}>
                <AttackSimulationView />
              </Suspense>
            }
          />
          
          <Route
            path="history"
            element={
              <Suspense fallback={<RouteLoadingFallback />}>
                <DetectionHistoryView />
              </Suspense>
            }
          />
          
          <Route
            path="model-insights"
            element={
              <Suspense fallback={<RouteLoadingFallback />}>
                <ModelInsightsView />
              </Suspense>
            }
          />
          
          <Route
            path="alerts"
            element={
              <Suspense fallback={<RouteLoadingFallback />}>
                <AlertConfigView />
              </Suspense>
            }
          />
          
          <Route
            path="analytics"
            element={
              <Suspense fallback={<RouteLoadingFallback />}>
                <AnalyticsView />
              </Suspense>
            }
          />
          
          <Route
            path="how-it-works"
            element={
              <Suspense fallback={<RouteLoadingFallback />}>
                <PrivacyArchitectureView />
              </Suspense>
            }
          />
          
          <Route
            path="settings"
            element={
              <Suspense fallback={<RouteLoadingFallback />}>
                <PrivacyArchitectureView />
              </Suspense>
            }
          />
          
          <Route
            path="api"
            element={
              <Suspense fallback={<RouteLoadingFallback />}>
                <DeveloperApiView />
              </Suspense>
            }
          />
        </Route>

        {/* Fallback to Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
