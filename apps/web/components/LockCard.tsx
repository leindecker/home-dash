'use client';

import { useEffect, useState } from 'react';
import { Fingerprint, KeyRound, Smartphone, Key, ScanFace, CreditCard, Lock, ShieldAlert, RefreshCw } from 'lucide-react';
import { fetchLockLogs, LockLog } from '@/lib/api';

// ─── helpers ──────────────────────────────────────────────

const TZ = 'America/Sao_Paulo';

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();

  const toLocaleDateStr = (d: Date) =>
    d.toLocaleDateString('pt-BR', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

  const todayStr     = toLocaleDateStr(now);
  const yesterdayStr = toLocaleDateStr(new Date(now.getTime() - 86_400_000));
  const dateStr      = toLocaleDateStr(date);

  const time = date.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

  if (dateStr === todayStr)     return `Hoje, ${time}`;
  if (dateStr === yesterdayStr) return `Ontem, ${time}`;

  const day   = date.toLocaleDateString('pt-BR', { timeZone: TZ, day: 'numeric' });
  const month = date.toLocaleDateString('pt-BR', { timeZone: TZ, month: 'short' }).replace('.', '');
  return `${day} ${month}, ${time}`;
}

interface MethodConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: React.ComponentType<any>;
  iconBg: string;
  iconColor: string;
  isAlert: boolean;
}

function methodConfig(method: string): MethodConfig {
  switch (method) {
    case 'fingerprint': return { Icon: Fingerprint, iconBg: '#0D2A20', iconColor: '#34D399', isAlert: false };
    case 'password':    return { Icon: KeyRound,    iconBg: '#0D1829', iconColor: '#60A5FA', isAlert: false };
    case 'app':         return { Icon: Smartphone,  iconBg: '#1a0d29', iconColor: '#A78BFA', isAlert: false };
    case 'key':         return { Icon: Key,         iconBg: '#2A1A06', iconColor: '#F59E0B', isAlert: false };
    case 'face':        return { Icon: ScanFace,    iconBg: '#0D2A20', iconColor: '#34D399', isAlert: false };
    case 'card':        return { Icon: CreditCard,  iconBg: '#0D1829', iconColor: '#60A5FA', isAlert: false };
    case 'auto':        return { Icon: Lock,        iconBg: '#1f2937', iconColor: '#9ca3af', isAlert: false };
    case 'alarm':       return { Icon: ShieldAlert, iconBg: '#2A0D0D', iconColor: '#E24B4A', isAlert: true  };
    default:            return { Icon: Lock,        iconBg: '#1f2937', iconColor: '#9ca3af', isAlert: false };
  }
}

// ─── LockCard ─────────────────────────────────────────────

interface LockCardProps {
  cardBg: string;
  cardBorder: string;
  textMain: string;
  textMuted: string;
}

export default function LockCard({ cardBg, cardBorder, textMain, textMuted }: LockCardProps) {
  const [logs, setLogs] = useState<LockLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    try {
      const data = await fetchLockLogs();
      setLogs(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div
      className="rounded-[14px] border flex flex-col"
      style={{ background: cardBg, borderColor: cardBorder }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: textMain }}>Acessos</h2>
          <p className="text-[11px] mt-0.5" style={{ color: textMuted }}>Últimos 7 dias</p>
        </div>
        <div className="flex items-center gap-2">
          {logs.length > 0 && !loading && (
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: '#0D1829', color: '#60A5FA' }}
            >
              {logs.length} registros
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-1.5 rounded-lg transition-opacity hover:opacity-60 disabled:opacity-40"
            style={{ color: textMuted }}
            aria-label="Atualizar"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: 320 }}>
        {loading ? (
          <div className="space-y-0 divide-y" style={{ borderColor: cardBorder }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-full flex-shrink-0 animate-pulse" style={{ background: '#2A2D3A' }} />
                <div className="flex-1 space-y-2">
                  <div className="h-3 rounded animate-pulse" style={{ background: '#2A2D3A', width: '55%' }} />
                  <div className="h-2.5 rounded animate-pulse" style={{ background: '#2A2D3A', width: '35%' }} />
                </div>
                <div className="h-2.5 rounded animate-pulse flex-shrink-0" style={{ background: '#2A2D3A', width: 52 }} />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-10">
            <p className="text-xs text-center px-4" style={{ color: '#E24B4A' }}>
              Não foi possível carregar os acessos.
            </p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <p className="text-xs" style={{ color: textMuted }}>Nenhum acesso registrado</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: cardBorder }}>
            {logs.map((log, i) => {
              const { Icon, iconBg, iconColor, isAlert } = methodConfig(log.method);
              const name = log.userName || log.unlockName || null;
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 px-5 py-3"
                  style={isAlert ? { background: 'rgba(42,13,13,0.5)' } : undefined}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: iconBg }}
                  >
                    <Icon size={14} style={{ color: iconColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs font-medium truncate"
                      style={{ color: isAlert ? '#E24B4A' : textMain }}
                    >
                      {log.label}
                    </p>
                    {name && (
                      <p className="text-[11px] truncate mt-0.5" style={{ color: textMuted }}>
                        {name}
                      </p>
                    )}
                  </div>
                  <p className="text-[11px] flex-shrink-0" style={{ color: textMuted }}>
                    {formatTime(log.eventTime)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
