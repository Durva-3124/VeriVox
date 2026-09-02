import React, { useState } from 'react';
import { 
  Cpu, 
  Activity, 
  Globe, 
  TrendingUp, 
  ShieldCheck, 
  ShieldAlert, 
  Sliders, 
  Layers, 
  Zap, 
  CheckCircle2, 
  Clock, 
  BarChart2, 
  FileText,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  BarChart, 
  Bar, 
  Cell 
} from 'recharts';
import { BENCHMARK_METRICS, INDIAN_LANGUAGES_COVERAGE } from '../data/mockData';
import { SpringCounter } from '../components/motion/SpringCounter';
import { MotionCard } from '../components/motion/MotionCard';

export const ModelInsightsView: React.FC = () => {
  const [selectedThreshold, setSelectedThreshold] = useState<number>(65);

  // Find nearest ROC point
  const currentRocPoint = BENCHMARK_METRICS.rocCurveData.reduce((prev, curr) => {
    return Math.abs(curr.threshold - selectedThreshold) < Math.abs(prev.threshold - selectedThreshold) ? curr : prev;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 pb-16">
      
      {/* Top Header */}
      <div className="card-raised p-lg flex flex-col md:flex-row md:items-center justify-between gap-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[#22D3EE]/15 text-[#22D3EE] border border-[#22D3EE]/30 shadow-inner">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-page-title">
                Model Insights, Benchmarks &amp; Indic Architecture
              </h1>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 font-mono uppercase tracking-wider">
                SIH26104 VERIFIED
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Empirical evaluation across IIT Madras IndicSpeech corpus, ASVspoof 2024, and 6 neural vocoder architectures
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-slate-400 bg-[#05070B] px-3 py-1.5 rounded-lg border border-[rgba(148,163,184,0.12)]">
            EER: <strong className="text-[#10B981]">1.18%</strong>
          </span>
          <span className="text-slate-400 bg-[#05070B] px-3 py-1.5 rounded-lg border border-[rgba(148,163,184,0.12)]">
            Sub-50ms Latency: <strong className="text-[#22D3EE]">36.8ms</strong>
          </span>
        </div>
      </div>

      {/* Top Benchmark KPI Cards with Spring Counters and MotionCard Hover */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <MotionCard accentColor="#10B981" className="card-raised p-lg space-y-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase">
            <span>Equal Error Rate (EER)</span>
            <Activity className="w-4 h-4 text-[#10B981]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#10B981]">
            <SpringCounter value={1.18} decimals={2} suffix="%" />
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            IIT Madras &amp; ASVspoof 2024 Benchmark
          </div>
        </MotionCard>

        <MotionCard accentColor="#22D3EE" className="card-raised p-lg space-y-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase">
            <span>False Acceptance Rate (FAR)</span>
            <ShieldCheck className="w-4 h-4 text-[#22D3EE]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#22D3EE]">
            {(currentRocPoint?.far ?? 0.82).toFixed(2)}%
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            At operating threshold {selectedThreshold}
          </div>
        </MotionCard>

        <MotionCard accentColor="#F59E0B" className="card-raised p-lg space-y-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase">
            <span>False Rejection Rate (FRR)</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">
            {(currentRocPoint?.frr ?? 1.45).toFixed(2)}%
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Minimal legitimate user friction
          </div>
        </MotionCard>

        <MotionCard accentColor="#2DD4BF" className="card-raised p-lg space-y-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase">
            <span>Peak Inference Latency</span>
            <Clock className="w-4 h-4 text-[#2DD4BF]" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            <SpringCounter value={36.8} decimals={1} suffix=" ms" />
          </div>
          <div className="text-[11px] text-[#10B981] font-mono">
            Meets SIH26104 sub-50ms SLA
          </div>
        </MotionCard>

      </div>

      {/* Interactive ROC Curve & Threshold Calibration (8 cols + 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: ROC Curve Graph (8 cols) */}
        <div className="lg:col-span-8 card-raised p-lg space-y-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[rgba(148,163,184,0.12)]">
            <div>
              <h3 className="text-sm font-bold font-slab text-white">
                Receiver Operating Characteristic (ROC) &amp; Error Tradeoff
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                False Acceptance Rate vs False Rejection Rate across decision thresholds
              </p>
            </div>
            <span className="text-[10px] font-mono uppercase font-bold text-[#22D3EE] bg-[#22D3EE]/10 px-2 py-0.5 rounded border border-[#22D3EE]/30">
              OPTIMAL OPERATING POINT: 65
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={BENCHMARK_METRICS.rocCurveData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="threshold" stroke="#64748B" fontSize={11} unit=" (Th)" />
                <YAxis stroke="#64748B" fontSize={11} unit="%" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#05070B', borderColor: 'rgba(148,163,184,0.2)', borderRadius: '8px', fontSize: '12px', color: '#fff', fontFamily: 'monospace' }} 
                />
                <Line type="monotone" dataKey="far" name="False Acceptance (FAR %)" stroke="#EF4444" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="frr" name="False Rejection (FRR %)" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="accuracy" name="Overall Accuracy %" stroke="#10B981" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Interactive Threshold Slider */}
          <div className="p-4 rounded-lg bg-[#05070B] border border-[rgba(148,163,184,0.12)] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#22D3EE]" />
                <span>Adjust Detection Operating Threshold:</span>
              </span>
              <strong className="text-[#22D3EE] text-sm">{selectedThreshold} / 100</strong>
            </div>
            <input
              type="range"
              min="10"
              max="90"
              step="5"
              value={selectedThreshold}
              onChange={(e) => setSelectedThreshold(Number(e.target.value))}
              className="w-full accent-[#22D3EE] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>High Sensitivity (Higher FRR)</span>
              <span>Balanced (FAR 0.04% / FRR 0.86%)</span>
              <span>Permissive (Higher FAR)</span>
            </div>
          </div>
        </div>

        {/* Right: Sub-50ms Pipeline Latency Waterfall (4 cols) */}
        <div className="lg:col-span-4 card-raised p-lg space-y-md">
          <div>
            <h3 className="text-sm font-bold font-slab text-white">
              Sub-50ms Latency Waterfall
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Per-stage breakdown of real-time 40ms PCM ingestion loop
            </p>
          </div>

          <div className="space-y-3 pt-1">
            {BENCHMARK_METRICS.latencyBreakdown.map((item) => (
              <div key={item.stage} className="space-y-1 text-xs font-mono">
                <div className="flex justify-between text-slate-300">
                  <span className="truncate pr-2">{item.stage}</span>
                  <span className="font-bold text-white flex-shrink-0">{item.latencyMs} ms</span>
                </div>
                <div className="h-1.5 w-full bg-[#05070B] rounded-full overflow-hidden border border-[rgba(148,163,184,0.12)]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(item.latencyMs / 12) * 100}%`, backgroundColor: item.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-lg bg-[#05070B] border border-[rgba(148,163,184,0.12)] font-mono text-xs space-y-1">
            <div className="flex justify-between font-bold">
              <span className="text-slate-300">Cumulative End-to-End:</span>
              <span className="text-[#10B981]">{BENCHMARK_METRICS.avgLatencyMs} ms</span>
            </div>
            <div className="text-[10px] text-slate-400">
              Includes network buffer + STFT + Transformer classification
            </div>
          </div>
        </div>

      </div>

      {/* 8 Indian Languages Coverage & Accuracy Matrix */}
      <div className="card-raised p-lg space-y-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[rgba(148,163,184,0.12)]">
          <div>
            <h3 className="text-base font-bold font-slab text-white">
              Multilingual Indic Language Coverage &amp; Accent Invariance Matrix
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Trained across 50,000+ hours of pan-India native speech corpora under SIH26104 mandate
            </p>
          </div>
          <span className="text-xs font-mono text-[#22D3EE] bg-[#22D3EE]/10 px-2.5 py-1 rounded border border-[#22D3EE]/25 w-fit">
            8 Major Indian Languages
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {INDIAN_LANGUAGES_COVERAGE.map((lang) => (
            <div
              key={lang.code}
              className="p-4 rounded-xl bg-[#05070B] border border-[rgba(148,163,184,0.12)] hover:border-[#22D3EE]/40 transition-all space-y-3 font-mono"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-white font-sans">{lang.name}</div>
                  <div className="text-xs text-[#22D3EE]">{lang.nativeName}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-[#10B981]">{lang.accuracyRate}%</div>
                  <div className="text-[9px] text-slate-400 uppercase">Accuracy</div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 space-y-1">
                <div>Region: <strong className="text-slate-300">{lang.region}</strong></div>
                <div>Training Corpus: <strong className="text-slate-300">{lang.trainingHours.toLocaleString()} hrs</strong></div>
                <div>Speakers: <strong className="text-slate-300">{lang.speakersMillions}M</strong></div>
              </div>

              <div className="pt-2 border-t border-[rgba(148,163,184,0.08)]">
                <div className="text-[10px] text-slate-400 uppercase">Dialects Supported:</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {lang.dialectsSupported.map((dia, idx) => (
                    <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-[#0B1120] text-slate-300 border border-[rgba(148,163,184,0.12)]">
                      {dia}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Neural Vocoder Resilience Benchmark */}
      <div className="card-raised p-lg space-y-md">
        <div>
          <h3 className="text-base font-bold font-slab text-white">
            Neural Vocoder &amp; Synthesis Engine Resilience
          </h3>
          <p className="text-xs text-slate-400 font-mono">
            Zero-day detection robustness across commercial and open-source generative voice architectures
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {BENCHMARK_METRICS.vocoderResilience.map((voc) => (
            <div
              key={voc.vocoder}
              className="p-4 rounded-xl bg-[#05070B] border border-[rgba(148,163,184,0.12)] space-y-2 font-mono text-xs"
            >
              <div className="flex justify-between items-center">
                <div className="font-bold text-white text-sm font-sans">{voc.vocoder}</div>
                <span className="text-[10px] text-[#10B981] bg-[#10B981]/15 px-2 py-0.5 rounded border border-[#10B981]/30">
                  {voc.detectionRate}% DETECT
                </span>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Equal Error Rate:</span>
                <strong className="text-slate-200">{voc.eer}%</strong>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Stress Samples Tested:</span>
                <strong className="text-slate-200">{voc.samplesTested.toLocaleString()}</strong>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
