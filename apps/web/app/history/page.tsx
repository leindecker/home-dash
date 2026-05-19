'use client';

import { useEffect, useState } from 'react';
import { Lightbulb, DoorOpen, Wifi, Clock, AlertCircle } from 'lucide-react';
import { useTokens } from '@/lib/theme';
import { fetchDevices, fetchDeviceLogs, Device, DeviceLog } from '@/lib/api';

// ─── types ────────────────────────────────────────────────

interface DayUsage {
  label: string;    // "Seg", "Ter", …
  minutes: number;
}

interface ActivityEntry {
  eventTime: number;
  deviceName: string;
  deviceType: string;
  code: string;
  value: string;
}

const DOW_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function dow(ts: number) {
  return DOW_PT[new Date(ts).getDay()];
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min atrás`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  return `${Math.round(hrs / 24)}d atrás`;
}

function eventLabel(code: string, value: string): string {
  if (code.startsWith('switch')) return value === 'true' ? 'Ligada' : 'Desligada';
  if (code === 'doorcontact_state') return value === 'true' ? 'Aberta' : 'Fechada';
  return value;
}

function deviceIcon(type: string) {
  if (type === 'switch') return Lightbulb;
  if (type === 'lock') return DoorOpen;
  if (type === 'hub') return Wifi;
  return Clock;
}

// ─── SVG Bar Chart ─────────────────────────────────────────

function BarChart({
  data,
  textMuted,
  cardBorder,
}: {
  data: DayUsage[];
  textMuted: string;
  cardBorder: string;
}) {
  const max = Math.max(...data.map((d) => d.minutes), 1);
  const W = 300;
  const H = 100;
  const barW = 28;
  const gap = (W - data.length * barW) / (data.length + 1);

  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full" style={{ maxHeight: 140 }}>
      {data.map((d, i) => {
        const x = gap + i * (barW + gap);
        const barH = Math.max(4, (d.minutes / max) * H);
        const y = H - barH;
        const isToday = i === data.length - 1;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={6}
              fill={isToday ? '#34D399' : '#2A2D3A'}
            />
            <text
              x={x + barW / 2}
              y={H + 16}
              textAnchor="middle"
              fontSize={9}
              fill={isToday ? '#34D399' : textMuted}
              fontFamily="inherit"
            >
              {d.label}
            </text>
          </g>
        );
      })}
      {/* horizontal guide */}
      <line x1={0} y1={H} x2={W} y2={H} stroke={cardBorder} strokeWidth={1} />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────

export default function HistoryPage() {
  const { cardBg, cardBorder, textMain, textMuted, pageBg, rowBg } = useTokens();
  const [barData, setBarData] = useState<DayUsage[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const devices = await fetchDevices();

        // Build activity list from all device logs
        const logResults = await Promise.allSettled(
          devices.map((d) =>
            fetchDeviceLogs(d.id).then((logs) =>
              logs.map((l) => ({
                eventTime: l.eventTime * 1000,
                deviceName: d.name,
                deviceType: d.type,
                code: l.code,
                value: String(l.value),
              }))
            )
          )
        );

        const allActivity: ActivityEntry[] = logResults
          .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
          .sort((a, b) => b.eventTime - a.eventTime)
          .slice(0, 50);

        setActivity(allActivity);

        // Build last-7-days bar chart from switch logs
        const switchDevices = devices.filter((d) => d.type === 'switch');
        const switchLogs = logResults
          .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
          .filter((e) => e.deviceType === 'switch');

        const now = Date.now();
        const days: DayUsage[] = Array.from({ length: 7 }, (_, i) => {
          const dayStart = now - (6 - i) * 86_400_000;
          const dayEnd = dayStart + 86_400_000;
          const dayLogs = switchLogs.filter(
            (l) => l.eventTime >= dayStart && l.eventTime < dayEnd
          );
          // Rough: each "on" event counts as 30 min usage
          const onEvents = dayLogs.filter((l) => l.value === 'true').length;
          return {
            label: dow(dayStart),
            minutes: onEvents * 30,
          };
        });

        setBarData(days);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <div className="p-4 sm:p-6 min-h-screen" style={{ background: pageBg }}>
      {/* Topbar */}
      <div className="mb-6 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold" style={{ color: textMain }}>
          Histórico
        </h1>
        <p className="text-sm mt-0.5" style={{ color: textMuted }}>
          Últimos 7 dias de atividade
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <span
            className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: '#34D399', borderTopColor: 'transparent' }}
          />
        </div>
      ) : error ? (
        <div
          className="flex items-center gap-2 p-4 rounded-xl text-sm"
          style={{ background: cardBg, color: '#F87171', border: `1px solid ${cardBorder}` }}
        >
          <AlertCircle size={16} />
          Erro ao carregar histórico. Verifique a conexão com a API.
        </div>
      ) : (
        <div className="space-y-4 max-w-2xl mx-auto">
          {/* Bar chart card */}
          <div
            className="rounded-2xl border p-5"
            style={{ background: cardBg, borderColor: cardBorder }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: textMuted }}>
              Uso de Luzes — minutos/dia
            </p>
            {barData.length > 0 ? (
              <BarChart data={barData} textMuted={textMuted} cardBorder={cardBorder} />
            ) : (
              <p className="text-sm text-center py-8" style={{ color: textMuted }}>
                Sem dados de uso
              </p>
            )}
          </div>

          {/* Activity feed */}
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ background: cardBg, borderColor: cardBorder }}
          >
            <div className="px-5 py-4 border-b" style={{ borderColor: cardBorder }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
                Atividade recente
              </p>
            </div>

            {activity.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: textMuted }}>
                Nenhuma atividade registrada
              </p>
            ) : (
              <div className="divide-y" style={{ borderColor: cardBorder }}>
                {activity.map((entry, i) => {
                  const Icon = deviceIcon(entry.deviceType);
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-5 py-3"
                      style={{ background: i % 2 === 0 ? 'transparent' : rowBg }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: '#0D2A20' }}
                      >
                        <Icon size={14} style={{ color: '#34D399' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: textMain }}>
                          {entry.deviceName}
                        </p>
                        <p className="text-[11px]" style={{ color: textMuted }}>
                          {eventLabel(entry.code, entry.value)}
                        </p>
                      </div>
                      <p className="text-[11px] flex-shrink-0" style={{ color: textMuted }}>
                        {relativeTime(entry.eventTime)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
