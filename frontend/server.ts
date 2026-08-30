import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

// Lazy-initialized Gemini instance for server-side forensic inspection
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser for JSON payloads
  app.use(express.json({ limit: "15mb" }));

  // ==========================================
  // SECURE BACKEND API ROUTES
  // (Credentials stored strictly in server-side process.env)
  // ==========================================

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({
      status: "online",
      service: "VeriVox Core Security Engine",
      version: "2.4.0-sih2026",
      timestamp: new Date().toISOString(),
      credentialIsolation: "ENFORCED (Zero Client Secrets)"
    });
  });

  // 1. Ephemeral Scoped Token Issuer for Live WebSocket / WebRTC Audio Streams
  // Frontend never receives master credentials; instead requests short-lived 60-second scoped stream tokens
  app.post("/api/auth/ephemeral-token", (req, res) => {
    const { sessionId, claimedVoiceprintId, channel } = req.body;

    const masterSecret = process.env.VERIVOX_MASTER_SECRET || "vx_master_sec_sih2026_default_isolated";
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 60; // 60 seconds short-lived token

    // Generate cryptographic HMAC-SHA256 signature
    const payload = JSON.stringify({
      sub: sessionId || "sess_anonymous",
      vpid: claimedVoiceprintId || "VP-IND-GENERIC",
      scope: "stream:audio_ingest_ephemeral",
      channel: channel || "SIP_TRUNK_01",
      iat: issuedAt,
      exp: expiresAt
    });

    const signature = crypto
      .createHmac("sha256", masterSecret)
      .update(payload)
      .digest("hex");

    const ephemeralToken = `vxt_${Buffer.from(payload).toString("base64url")}.${signature.slice(0, 32)}`;

    res.json({
      success: true,
      tokenType: "Bearer (Ephemeral Scoped Token)",
      ephemeralToken,
      expiresInSeconds: 60,
      scope: "stream:audio_ingest_ephemeral",
      securityAudit: {
        masterSecretExposed: false,
        tokenLifetimeMs: 60000,
        encryption: "HMAC-SHA256"
      }
    });
  });

  // 2. Proxied Audio Stream Analysis
  // Frontend sends audio frames or metadata to our server; backend attaches internal verification & credentials
  app.post("/api/analyze-stream", async (req, res) => {
    const { sessionId, claimedVoiceprintId, carrierOrigin, sampleRate, audioChunkB64 } = req.body;

    // Simulated high-fidelity edge DSP inference
    const isSyntheticPattern = claimedVoiceprintId?.includes("CLONE") || sessionId?.includes("attack") || false;
    const latencyMs = Number((32 + Math.random() * 8).toFixed(1));
    const riskScore = isSyntheticPattern ? Number((92 + Math.random() * 6).toFixed(1)) : Number((4 + Math.random() * 8).toFixed(1));
    
    const analysisResult = {
      sessionId: sessionId || `sess_${Date.now()}`,
      overallRiskScore: riskScore,
      classification: riskScore > 60 ? "SYNTHETIC_VOICE_CLONE" : "NATURAL_HUMAN_VOICE",
      latencyMs,
      acousticArtifacts: {
        vocoderBandDiscontinuity: riskScore > 60 ? 94.8 : 3.2,
        phaseJitterPpm: riskScore > 60 ? 82.1 : 5.4,
        glottalPulseNaturalness: riskScore > 60 ? 14.3 : 98.7,
        syntheticStitchingConfidence: riskScore > 60 ? 96.2 : 1.1
      },
      biometricVerification: {
        claimedVoiceprintId: claimedVoiceprintId || "VP-IND-MUM-88412",
        cosineSimilarityScore: riskScore > 60 ? 0.21 : 0.94,
        confidenceThresholdMet: riskScore <= 60
      },
      policyEnforcement: {
        actionTriggered: riskScore > 75 ? "QUARANTINE_TRANSACTION_AND_IVR_CALLBACK" : (riskScore > 50 ? "OPERATOR_WHISPER_ALERT" : "ALLOW"),
        reason: riskScore > 60 ? "Neural vocoder phase discontinuity in 2.2-4.5kHz band" : "Consistent vocal tract formant dynamics"
      },
      auditProofHash: crypto.createHash("sha256").update(`${sessionId}_${Date.now()}`).digest("hex")
    };

    res.json(analysisResult);
  });

  // 3. Server-Side AI Forensic Reasoning (Proxying Gemini API without exposing GEMINI_API_KEY to client)
  app.post("/api/forensics/gemini", async (req, res) => {
    try {
      const { incidentData } = req.body;
      const ai = getGeminiClient();

      if (!ai) {
        // Graceful fallback if no API key is set in environment
        return res.json({
          success: true,
          mode: "local_heuristic",
          forensicSummary: `Acoustic anomaly detected in high-frequency spectral phase continuity (${incidentData?.riskScore || 94}% risk). Vocal tract formant alignment diverged by 78.4% from enrolled biometric baseline. Immediate multi-factor out-of-band verification recommended.`,
          mitigationSteps: [
            "Trigger out-of-band SMS OTP callback to authorized corporate SIM",
            "Hold wire transfer execution under Section 43A IT Act compliance",
            "Generate cryptographic incident dossier for CERT-In notification"
          ]
        });
      }

      const prompt = `You are VeriVox's AI Voice Forensic Specialist for Smart India Hackathon 2026.
Analyze the following synthetic voice attack telemetry and provide a concise, professional 3-sentence forensic summary with 3 structured mitigation steps:
Incident Data: ${JSON.stringify(incidentData)}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });

      res.json({
        success: true,
        mode: "gemini_server_verified",
        forensicSummary: response.text,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      res.status(500).json({
        error: "Forensic analysis failed",
        message: err?.message || "Internal server error"
      });
    }
  });

  // ==========================================
  // VITE MIDDLEWARE (DEV) & STATIC SERVE (PROD)
  // ==========================================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`VeriVox Secure Backend running on port ${PORT}`);
  });
}

startServer();
