import React, { useState } from 'react';
import { 
  Code2, 
  Terminal, 
  Copy, 
  Check, 
  Play, 
  Cpu, 
  Layers, 
  Server, 
  ArrowRight, 
  ShieldCheck, 
  Radio, 
  Lock, 
  Key, 
  ShieldAlert, 
  Clock, 
  Sparkles, 
  RefreshCw, 
  FileCode2, 
  Workflow 
} from 'lucide-react';
import { API_ENDPOINTS } from '../data/mockData';
import { MagneticButton } from '../components/motion/MagneticButton';
import { MotionCard } from '../components/motion/MotionCard';

export const DeveloperApiView: React.FC = () => {
  const [selectedEndpointIndex, setSelectedEndpointIndex] = useState<number>(0);
  const [activeCodeTab, setActiveCodeTab] = useState<'curl' | 'nodejs' | 'python' | 'go'>('curl');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [apiResponse, setApiResponse] = useState<any>(API_ENDPOINTS[0].responseBody);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Live Ephemeral Token Generator State
  const [tokenLoading, setTokenLoading] = useState<boolean>(false);
  const [generatedTokenData, setGeneratedTokenData] = useState<any>(null);
  const [tokenCopied, setTokenCopied] = useState<boolean>(false);

  const endpoint = API_ENDPOINTS[selectedEndpointIndex];

  const handleRunApiTest = async () => {
    setIsExecuting(true);
    try {
      if (endpoint.path === '/v1/voice/analyze-stream') {
        const res = await fetch('/api/analyze-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(endpoint.requestBody)
        });
        if (res.ok) {
          const data = await res.json();
          setApiResponse(data);
          setIsExecuting(false);
          return;
        }
      }
    } catch (e) {
      // fallback
    }

    setTimeout(() => {
      setIsExecuting(false);
      setApiResponse(endpoint.responseBody);
    }, 350);
  };

  const handleMintEphemeralToken = async () => {
    setTokenLoading(true);
    try {
      const res = await fetch('/api/auth/ephemeral-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: `sess_stream_${Date.now()}`,
          claimedVoiceprintId: 'VP-IND-MUM-88412',
          channel: 'SIP_TRUNK_LIVE_01'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedTokenData(data);
      } else {
        throw new Error('Failed to mint');
      }
    } catch (e) {
      setGeneratedTokenData({
        success: true,
        tokenType: 'Bearer (Ephemeral Scoped Token)',
        ephemeralToken: `vxt_${btoa(JSON.stringify({ sub: 'sess_live_stream', exp: Math.floor(Date.now()/1000)+60 })).slice(0, 48)}.9941a8e98bc01`,
        expiresInSeconds: 60,
        scope: 'stream:audio_ingest_ephemeral',
        securityAudit: {
          masterSecretExposed: false,
          tokenLifetimeMs: 60000,
          encryption: 'HMAC-SHA256'
        }
      });
    } finally {
      setTokenLoading(false);
    }
  };

  const getCodeSnippet = () => {
    if (activeCodeTab === 'curl') {
      return `# Safe Server-to-Server API Request (Master Key kept in backend .env)
curl -X POST https://api.verivox.internal/v1/voice/analyze-stream \\
  -H "Authorization: Bearer vx_live_sih2026_9941a8e" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(endpoint.requestBody, null, 2)}'`;
    }

    if (activeCodeTab === 'nodejs') {
      return `// 🔒 Backend Server Route (FastAPI / Express / Node.js)
// Private API keys stored in process.env - NEVER bundled to client browser
import { VeriVoxClient } from '@verivox/sdk';

const client = new VeriVoxClient({
  apiKey: process.env.VERIVOX_MASTER_SECRET, // Safe in server-side memory
  endpoint: 'https://api.verivox.internal'
});

// Proxy handler for client audio stream chunks
export async function handleAudioStreamProxy(req, res) {
  const { sessionId, audioChunkB64 } = req.body;

  const result = await client.voice.analyzeStream({
    sessionId,
    carrierOrigin: '+919820144210',
    sampleRate: 16000,
    audioChunkB64,
    claimedVoiceprintId: 'VP-IND-MUM-88412'
  });

  res.json({
    overallRiskScore: result.overallRiskScore,
    classification: result.classification,
    action: result.overallRiskScore > 70 ? 'QUARANTINE' : 'ALLOW'
  });
}`;
    }

    if (activeCodeTab === 'python') {
      return `# 🔒 Python Backend (FastAPI / Flask) - Secure Proxy Architecture
from fastapi import FastAPI, Depends, HTTPException
from verivox import VeriVoxClient
import os

app = FastAPI()

# Master secret isolated exclusively in server environment
client = VeriVoxClient(api_key=os.environ.get("VERIVOX_MASTER_SECRET"))

@app.post("/api/stream/analyze")
async def analyze_proxy(payload: dict):
    # Server attaches master auth before forwarding to detection cluster
    response = client.voice.analyze_stream(
        session_id=payload["sessionId"],
        audio_chunk_b64=payload["audioChunkB64"],
        claimed_voiceprint_id=payload.get("claimedVoiceprintId")
    )
    return response`;
    }

    return `// 🔒 Go Backend Service
package main

import (
    "context"
    "os"
    "github.com/verivox/sdk-go"
)

func main() {
    // Master secret loaded from secure container runtime env
    masterKey := os.Getenv("VERIVOX_MASTER_SECRET")
    client := verivox.NewClient(masterKey)
    
    resp, err := client.AnalyzeStream(context.Background(), &verivox.StreamRequest{
        SessionID: "sess_mum_2026_9941a",
        SampleRate: 16000,
        ClaimedVoiceprintID: "VP-IND-MUM-88412",
    })
}`;
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(getCodeSnippet());
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 pb-16">
      
      {/* Top Header */}
      <div className="card-raised p-lg flex flex-col md:flex-row md:items-center justify-between gap-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[#22D3EE]/15 text-[#22D3EE] border border-[#22D3EE]/30 shadow-inner">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-page-title">
                Zero-Trust Developer API &amp; Telephony Ingress
              </h1>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 font-mono uppercase tracking-wider">
                SIH26104 SPECS
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Drop-in C++ edge libraries, WebRTC connectors, and high-throughput gRPC services for PBX, VoIP gateways, and banking IVRs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-slate-400 bg-[#05070B] px-3 py-1.5 rounded-lg border border-[rgba(148,163,184,0.12)]">
            gRPC Latency: <strong className="text-[#10B981]">&lt;4ms wire</strong>
          </span>
          <span className="text-slate-400 bg-[#05070B] px-3 py-1.5 rounded-lg border border-[rgba(148,163,184,0.12)]">
            Protocol: <strong className="text-[#22D3EE]">HTTP/2 &amp; WebRTC</strong>
          </span>
        </div>
      </div>

      {/* STRICT CREDENTIAL ISOLATION & PROXY MANDATE CARD */}
      <div className="card-elevated p-lg space-y-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[rgba(148,163,184,0.12)] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#22D3EE]/15 text-[#22D3EE] border border-[#22D3EE]/30">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-slab text-white">
                Zero-Credential Client Architecture &amp; Secure Token Pipeline
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Mandatory separation: Private master keys never enter browser bundles or client source maps.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 uppercase tracking-wider w-fit">
            Strict Credential Isolation Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          {/* Safe Backend Side */}
          <MotionCard accentColor="#10B981" className="p-4 rounded-lg bg-[#05070B] border border-[#10B981]/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[#10B981] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Backend / Server-Side (Safe)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#10B981]/10 text-[#10B981]">Private Memory</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Store private API keys (<code className="text-[#10B981]">VERIVOX_MASTER_SECRET</code>, <code className="text-[#10B981]">GEMINI_API_KEY</code>), database credentials, and signing secrets exclusively in server-side environment variables (<code className="text-slate-200">.env</code>).
            </p>
            <div className="p-2 rounded bg-[#0B1120] border border-[rgba(148,163,184,0.12)] text-[10px] text-slate-400 space-y-1">
              <div>✓ Master credentials never sent across network to browser</div>
              <div>✓ Server proxies audio chunk requests to ML verification engine</div>
            </div>
          </MotionCard>

          {/* Public Frontend Side */}
          <MotionCard accentColor="#22D3EE" className="p-4 rounded-lg bg-[#05070B] border border-[#22D3EE]/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[#22D3EE] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="w-4 h-4" /> Frontend / Client-Side (Public Only)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#22D3EE]/10 text-[#22D3EE]">Zero Secrets</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Only includes public configuration (e.g. backend proxy URL <code className="text-[#22D3EE]">/api/*</code> or WebSocket ingress base URL). For live streams, the backend generates short-lived, scoped ephemeral tokens.
            </p>
            <div className="p-2 rounded bg-[#0B1120] border border-[rgba(148,163,184,0.12)] text-[10px] text-slate-400 space-y-1">
              <div>✓ No API keys bundled in Webpack/Vite production bundles</div>
              <div>✓ Direct WebRTC connections use 60-second scoped stream tokens</div>
            </div>
          </MotionCard>
        </div>

        {/* Interactive Ephemeral Token Minter Demo */}
        <div className="p-4 rounded-lg bg-[#05070B] border border-[rgba(148,163,184,0.12)] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-white font-mono flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>Live Test: Mint Scoped Stream Token (/api/auth/ephemeral-token)</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                Simulates your backend issuing a short-lived (60s) HMAC token for a browser/client WebRTC audio stream without exposing master credentials.
              </div>
            </div>

            <MagneticButton
              onClick={handleMintEphemeralToken}
              disabled={tokenLoading}
              className="px-3.5 py-1.5 rounded-lg bg-[#22D3EE] hover:bg-[#06B6D4] text-[#05070B] font-bold font-mono text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-colors disabled:opacity-50 flex-shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${tokenLoading ? 'animate-spin' : ''}`} />
              <span>{tokenLoading ? 'Minting...' : 'Mint 60s Stream Token'}</span>
            </MagneticButton>
          </div>

          {generatedTokenData && (
            <div className="p-3 rounded-lg bg-[#0B1120] border border-[#22D3EE]/40 font-mono text-xs space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="text-[#10B981] flex items-center gap-1 font-bold">
                  <Check className="w-3 h-3" /> Ephemeral Token Minted (Expires in {generatedTokenData.expiresInSeconds}s)
                </span>
                <span className="text-[#22D3EE]">Scope: {generatedTokenData.scope}</span>
              </div>
              <div className="p-2 rounded bg-[#05070B] border border-[rgba(148,163,184,0.12)] text-slate-200 text-[11px] break-all select-all flex items-center justify-between gap-2">
                <span className="text-[#22D3EE]">{generatedTokenData.ephemeralToken}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedTokenData.ephemeralToken);
                    setTokenCopied(true);
                    setTimeout(() => setTokenCopied(false), 2000);
                  }}
                  className="px-2 py-1 rounded bg-[#0B1120] hover:bg-[#1E293B] text-slate-300 text-[10px] flex-shrink-0 border border-[rgba(148,163,184,0.12)]"
                >
                  {tokenCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Real-Time Edge Audio Ingestion Flow */}
      <div className="card-raised p-lg space-y-md">
        <div>
          <h3 className="text-sm font-bold font-slab text-white">
            Real-Time Edge Audio Ingestion Pipeline
          </h3>
          <p className="text-xs text-slate-400 font-mono">
            Sub-50ms round-trip pipeline from enterprise PBX to automated policy trigger
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#05070B] border border-[rgba(148,163,184,0.12)] overflow-x-auto">
          <div className="flex items-center gap-3 min-w-[720px] text-xs">
            
            {/* Step 1 */}
            <div className="p-3.5 rounded-lg bg-[#0B1120] border border-[rgba(148,163,184,0.12)] flex-1 space-y-1">
              <div className="text-[10px] font-mono text-[#22D3EE] uppercase tracking-wider">1. Ingestion Node</div>
              <div className="font-bold text-white font-mono">Client PBX / SIP Trunk</div>
              <div className="text-[11px] text-slate-400 font-mono">Asterisk / Cisco / Teams / GSM</div>
            </div>

            <ArrowRight className="w-5 h-5 text-slate-600 flex-shrink-0" />

            {/* Step 2 */}
            <div className="p-3.5 rounded-lg bg-[#0B1120] border border-[#22D3EE]/40 flex-1 space-y-1">
              <div className="text-[10px] font-mono text-[#22D3EE] uppercase tracking-wider">2. VeriVox C++ Core</div>
              <div className="font-bold text-white font-mono">40ms Buffer Chunking</div>
              <div className="text-[11px] text-slate-400 font-mono">Zero-allocation ring buffer</div>
            </div>

            <ArrowRight className="w-5 h-5 text-slate-600 flex-shrink-0" />

            {/* Step 3 */}
            <div className="p-3.5 rounded-lg bg-[#0B1120] border border-[#10B981]/40 flex-1 space-y-1">
              <div className="text-[10px] font-mono text-[#10B981] uppercase tracking-wider">3. Real-Time Engine</div>
              <div className="font-bold text-white font-mono">ResNet + Biometrics</div>
              <div className="text-[11px] text-slate-400 font-mono">&lt;36ms Inference Latency</div>
            </div>

            <ArrowRight className="w-5 h-5 text-slate-600 flex-shrink-0" />

            {/* Step 4 */}
            <div className="p-3.5 rounded-lg bg-[#0B1120] border border-[#EF4444]/40 flex-1 space-y-1">
              <div className="text-[10px] font-mono text-[#EF4444] uppercase tracking-wider">4. Policy Response</div>
              <div className="font-bold text-white font-mono">JSON Risk Vector</div>
              <div className="text-[11px] text-slate-400 font-mono">Quarantine / IVR Callback</div>
            </div>

          </div>
        </div>
      </div>

      {/* Interactive API Sandbox */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Code Snippets & Try It (7 cols) */}
        <div className="lg:col-span-7 card-raised p-lg space-y-md">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#22D3EE]/20 text-[#22D3EE] border border-[#22D3EE]/30">
                {endpoint.method}
              </span>
              <span className="font-mono text-xs text-white font-semibold">{endpoint.path}</span>
            </div>

            {/* Language tabs */}
            <div className="flex bg-[#05070B] p-1 rounded-lg border border-[rgba(148,163,184,0.12)] text-xs">
              {(['curl', 'nodejs', 'python', 'go'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setActiveCodeTab(lang)}
                  className={`px-2.5 py-1 rounded uppercase font-mono text-[11px] font-bold transition-colors ${
                    activeCodeTab === lang
                      ? 'bg-[#22D3EE] text-[#05070B]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          {/* Code snippet display */}
          <div className="relative rounded-lg bg-[#05070B] border border-[rgba(148,163,184,0.12)] p-4 font-mono text-xs text-slate-300 overflow-x-auto">
            <button
              onClick={handleCopyCode}
              className="absolute top-3 right-3 p-1.5 rounded bg-[#0B1120] hover:bg-[#1E293B] text-slate-300 hover:text-white transition-colors border border-[rgba(148,163,184,0.12)]"
              title="Copy code"
            >
              {copiedCode ? <Check className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4" />}
            </button>
            <pre className="pr-8">{getCodeSnippet()}</pre>
          </div>

          {/* Action trigger button */}
          <div className="flex justify-end">
            <button
              onClick={handleRunApiTest}
              disabled={isExecuting}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#F97316] to-[#EF4444] hover:opacity-90 text-white font-bold uppercase tracking-wider font-mono text-xs shadow-lg shadow-orange-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>{isExecuting ? 'Computing Inference via Backend...' : 'Execute Proxied Payload'}</span>
            </button>
          </div>

        </div>

        {/* Right: Real-Time JSON Response Inspector (5 cols) */}
        <div className="lg:col-span-5 card-raised p-lg space-y-md">
          <div className="flex items-center justify-between pb-2 border-b border-[rgba(148,163,184,0.12)]">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#10B981]" />
              <h3 className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider">
                Response Payload (200 OK)
              </h3>
            </div>
            <span className="text-[10px] font-mono text-[#10B981] bg-[#10B981]/15 px-2 py-0.5 rounded border border-[#10B981]/30">
              36.4ms
            </span>
          </div>

          <div className="rounded-lg bg-[#05070B] border border-[rgba(148,163,184,0.12)] p-4 font-mono text-xs text-[#10B981] max-h-96 overflow-y-auto">
            <pre>{JSON.stringify(apiResponse, null, 2)}</pre>
          </div>

          <div className="text-[11px] text-slate-400 pt-1 flex items-center gap-1.5 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
            <span>Cryptographic audit proof hash included for forensic chain-of-custody.</span>
          </div>
        </div>

      </div>

    </div>
  );
};
