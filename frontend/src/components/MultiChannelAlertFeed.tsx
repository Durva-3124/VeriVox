import React from 'react';
import { 
  MessageSquare, 
  Mail, 
  ShieldAlert, 
  Lock, 
  PhoneOff, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  Radio, 
  AlertOctagon,
  Send,
  Fingerprint
} from 'lucide-react';

export interface AlertFeedItem {
  id: string;
  triggerTimeSec: number;
  channel: 'SMS' | 'EMAIL' | 'SOC_WEBHOOK' | 'ENFORCEMENT' | 'BIOMETRIC_EVENT';
  recipient: string;
  subject: string;
  body: string;
  status: 'DELIVERED' | 'DISPATCHED' | 'APPLIED' | 'ACTIVE';
  severity: 'critical' | 'warn' | 'info';
  timestamp: string;
}

interface MultiChannelAlertFeedProps {
  currentPlaybackTime: number; // in seconds (0.0 to 7.5)
  isClonedScenario: boolean;
  manualActions?: AlertFeedItem[];
}

export const MultiChannelAlertFeed: React.FC<MultiChannelAlertFeedProps> = ({
  currentPlaybackTime,
  isClonedScenario,
  manualActions = [],
}) => {
  // Deterministic staggered alerts sequence for Cloned CXO scenario
  const clonedAlertSequence: AlertFeedItem[] = [
    {
      id: 'alert-bio-01',
      triggerTimeSec: 3.4,
      channel: 'BIOMETRIC_EVENT',
      recipient: 'Biometric Voiceprint Engine (VP-IND-MUM-88412)',
      subject: 'Biometric Voiceprint Mismatch Flagged',
      body: 'Cosine similarity 0.22 (< 0.85 threshold). Enrolled vocal tract length 17.4cm vs live caller 14.2cm.',
      status: 'ACTIVE',
      severity: 'warn',
      timestamp: '11:42:04.420',
    },
    {
      id: 'alert-vocoder-02',
      triggerTimeSec: 5.2,
      channel: 'SOC_WEBHOOK',
      recipient: 'SIEM Incident Bus (CERT-In Telemetry)',
      subject: 'Neural Vocoder Artifacts Confirmed',
      body: 'Phase incoherence in 2.2 kHz – 4.2 kHz band. Robotic pitch micro-flatline 0.04 Hz variance.',
      status: 'DISPATCHED',
      severity: 'critical',
      timestamp: '11:42:06.180',
    },
    {
      id: 'alert-sms-03',
      triggerTimeSec: 6.2,
      channel: 'SMS',
      recipient: '+91 98201 44210 (Genuine Rajesh Mehta, CFO)',
      subject: 'URGENT SECURITY ALERT: Voice Impersonation',
      body: 'VeriVox Intercept: Active call attempting ₹15,00,000 wire using your cloned voice. Transfer quarantined under SIH26104 policy.',
      status: 'DELIVERED',
      severity: 'critical',
      timestamp: '11:42:07.120',
    },
    {
      id: 'alert-email-04',
      triggerTimeSec: 6.8, // 600ms staggered delay after SMS!
      channel: 'EMAIL',
      recipient: 'soc-alerts@bharatfintech.com, ciso@bharatfintech.com',
      subject: '[P1-INCIDENT] Critical Voice Cloning Attack Quarantined',
      body: 'Automated policy rule #1 executed. Caller CLI spoofed via SIP gateway. Target ₹15,00,000 RTGS outward wire frozen.',
      status: 'DELIVERED',
      severity: 'critical',
      timestamp: '11:42:07.720',
    },
    {
      id: 'alert-wire-05',
      triggerTimeSec: 7.3, // 500ms after email!
      channel: 'ENFORCEMENT',
      recipient: 'Core Banking API / RTGS Settlement Desk',
      subject: 'Automated Remittance Freeze Applied',
      body: '₹15,00,000 transfer TX-88219 placed on Security Lock. Out-of-band 2FA OTP verification required to release.',
      status: 'APPLIED',
      severity: 'critical',
      timestamp: '11:42:08.240',
    },
  ];

  // Deterministic logs for Genuine VIP scenario
  const genuineAlertSequence: AlertFeedItem[] = [
    {
      id: 'alert-gen-01',
      triggerTimeSec: 1.5,
      channel: 'SOC_WEBHOOK',
      recipient: 'SIP Telephony Gateway',
      subject: 'Call Session Established',
      body: 'Jio VoLTE Enterprise HD Audio channel authenticated. SNR 42.1 dB.',
      status: 'DISPATCHED',
      severity: 'info',
      timestamp: '11:45:01.500',
    },
    {
      id: 'alert-gen-02',
      triggerTimeSec: 3.4,
      channel: 'BIOMETRIC_EVENT',
      recipient: 'Biometric Voiceprint Engine (VP-IND-BLR-44102)',
      subject: 'Speaker Verification Passed (Cosine: 0.98)',
      body: 'Continuous biological glottal pressure variations confirmed. Match score 98.4%.',
      status: 'ACTIVE',
      severity: 'info',
      timestamp: '11:45:03.400',
    },
    {
      id: 'alert-gen-03',
      triggerTimeSec: 5.6,
      channel: 'ENFORCEMENT',
      recipient: 'Operator Console',
      subject: 'Verification Clear: Safe to Proceed',
      body: 'Zero synthetic speech anomalies detected. Vendor renewal inquiry verified for Priya Sharma.',
      status: 'APPLIED',
      severity: 'info',
      timestamp: '11:45:05.600',
    },
  ];

  // Select base sequence
  const targetSequence = isClonedScenario ? clonedAlertSequence : genuineAlertSequence;

  // Filter alerts whose trigger time has passed
  const triggeredAlerts = [
    ...manualActions,
    ...targetSequence.filter((item) => item.triggerTimeSec <= currentPlaybackTime + 0.05),
  ].sort((a, b) => b.triggerTimeSec - a.triggerTimeSec);

  return (
    <div 
      className="card-raised p-md space-y-md"
      title="Multi-Channel Alert & SOC Dispatch Feed: Staggered automated incident notifications dispatched across SMS, email, SIEM webhook, and PBX."
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[rgba(148,163,184,0.12)] pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30">
            <Send className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-white tracking-wider uppercase">
                Multi-Channel Alert &amp; SOC Dispatch Feed
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-[#05070B] text-slate-400 border border-slate-700">
                {triggeredAlerts.length} Dispatched
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              Realistic staggered delivery: SMS broadcast (T+6.2s) sequentially precedes CISO Email (T+6.8s) &amp; Wire Freeze (T+7.3s)
            </p>
          </div>
        </div>

        {/* Live Stagger indicator */}
        {isClonedScenario && currentPlaybackTime >= 6.0 && (
          <span className="text-[10px] font-mono text-[#EF4444] bg-[#EF4444]/15 border border-[#EF4444]/40 px-2 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-ping" />
            STAGGERED AUTOMATED DISPATCH ACTIVE
          </span>
        )}
      </div>

      {/* Alert Feed Stack */}
      <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
        {triggeredAlerts.length === 0 ? (
          <div className="text-xs text-slate-400 py-6 text-center font-mono bg-[#05070B] rounded-lg border border-[rgba(148,163,184,0.1)]">
            Awaiting automated enforcement triggers as call telemetry evaluates...
          </div>
        ) : (
          triggeredAlerts.map((alert) => {
            const isSms = alert.channel === 'SMS';
            const isEmail = alert.channel === 'EMAIL';
            const isBiometric = alert.channel === 'BIOMETRIC_EVENT';
            const isEnforcement = alert.channel === 'ENFORCEMENT';
            const isWebhook = alert.channel === 'SOC_WEBHOOK';

            let channelIcon = <ShieldAlert className="w-3.5 h-3.5" />;
            let channelBadge = 'bg-[#22D3EE]/20 text-[#22D3EE] border-[#22D3EE]/40';
            let cardBorder = 'border-[rgba(148,163,184,0.12)]';

            if (isSms) {
              channelIcon = <MessageSquare className="w-3.5 h-3.5 text-amber-400" />;
              channelBadge = 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold';
              cardBorder = 'border-amber-500/30 bg-[#120D04]';
            } else if (isEmail) {
              channelIcon = <Mail className="w-3.5 h-3.5 text-[#22D3EE]" />;
              channelBadge = 'bg-[#22D3EE]/20 text-[#22D3EE] border-[#22D3EE]/40 font-bold';
              cardBorder = 'border-[#22D3EE]/30 bg-[#040E14]';
            } else if (isBiometric) {
              channelIcon = <Fingerprint className="w-3.5 h-3.5 text-[#A855F7]" />;
              channelBadge = 'bg-[#8B5CF6]/20 text-[#C4B5FD] border-[#8B5CF6]/40 font-bold';
              cardBorder = 'border-[#8B5CF6]/30 bg-[#10071C]';
            } else if (isEnforcement) {
              channelIcon = <Lock className="w-3.5 h-3.5 text-[#EF4444]" />;
              channelBadge = 'bg-[#EF4444]/20 text-[#FCA5A5] border-[#EF4444]/40 font-bold';
              cardBorder = 'border-[#EF4444]/40 bg-[#1C0709]';
            }

            return (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border flex flex-col gap-1.5 transition-all duration-300 animate-fadeIn ${cardBorder}`}
              >
                {/* Top Row: Channel Badge, Timestamp, Delivery Status */}
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded border uppercase flex items-center gap-1 ${channelBadge}`}>
                      {channelIcon}
                      <span>{alert.channel}</span>
                    </span>
                    <span className="text-slate-300 font-semibold truncate max-w-[200px] sm:max-w-[280px]">
                      {alert.recipient}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">{alert.timestamp}</span>
                    <span className={`px-1.5 py-0.2 rounded font-bold uppercase text-[9px] ${
                      alert.status === 'DELIVERED' || alert.status === 'APPLIED'
                        ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40'
                        : 'bg-[#22D3EE]/20 text-[#22D3EE] border border-[#22D3EE]/40'
                    }`}>
                      {alert.status}
                    </span>
                  </div>
                </div>

                {/* Subject / Title */}
                <div className="text-xs font-bold font-mono text-white tracking-tight">
                  {alert.subject}
                </div>

                {/* Body message */}
                <p className="text-[11px] font-mono text-slate-300 leading-relaxed">
                  {alert.body}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
