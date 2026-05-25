'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Lightbulb, LightbulbOff } from 'lucide-react';
import { useTokens } from '@/lib/theme';
import { fetchDevices, fetchDeviceLogs } from '@/lib/api';

// ─── types ────────────────────────────────────────────────

interface DayUsage {
  label: string;
  minutes: number;
}

interface Activity {
  key: string;
  ts: number;
  iconBg: string;
  iconColor: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  IconComp: React.ComponentType<any>;
  description: string;
  timeLabel: string;
}

const DOW_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function dow(ts: number) {
  return DOW_PT[new Date(ts).getDay()];
}

function formatEventTime(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86_400_000;
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (ts >= todayStart) return `Hoje, ${time}`;
  if (ts >= yesterdayStart) return `Ontem, ${time}`;
  const day = date.getDate();
  const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return `${day} ${month}, ${time}`;
}

function switchCodeLabel(code: string): string {
  const n = code.match(/^switch_(\d+)$/)?.[1];
  return n ? `L${n}` : code;
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
            <rect x={x} y={y} width={barW} height={barH} rx={6} fill={isToday ? '#34D399' : '#2A2D3A'} />
            <text x={x + barW / 2} y={H + 16} textAnchor="middle" fontSize={9} fill={isToday ? '#34D399' : textMuted} fontFamily="inherit">
              {d.label}
            </text>
          </g>
        );
      })}
      <line x1={0} y1={H} x2={W} y2={H} stroke={cardBorder} strokeWidth={1} />
    </svg>
  );
}

// ─── ActivitySkeleton ──────────────────────────────────────

function ActivitySkeleton({ cardBorder }: { cardBorder: string }) {
  return (
    <div className="divide-y" style={{ borderColor: cardBorder }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3">
          <div className="w-8 h-8 rounded-full flex-shrink-0 animate-pulse" style={{ background: '#2A2D3A' }} />
          <div className="flex-1 space-y-2">
            <div className="h-3 rounded animate-pulse" style={{ background: '#2A2D3A', width: '60%' }} />
            <div className="h-2.5 rounded animate-pulse" style={{ background: '#2A2D3A', width: '40%' }} />
          </div>
          <div className="h-2.5 rounded animate-pulse flex-shrink-0" style={{ background: '#2A2D3A', width: 48 }} />
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────

export default function HistoryPage() {
  const { cardBg, cardBorder, textMain, textMuted, pageBg } = useTokens();
  const [barData, setBarData] = useState<DayUsage[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const devices = await fetchDevices();
        const switchDevices = devices.filter((d) => d.type === 'switch');

        const switchResults = await Promise.allSettled(
          switchDevices.map((d) =>
            fetchDeviceLogs(d.id).then((logs) => ({ device: d, logs }))
          )
        );

        const unified: Activity[] = [];

        switchResults.forEach((result) => {
          if (result.status !== 'fulfilled') return;
          const { device, logs } = result.value;
          const deviceShort = device.name.replace(/^Interruptor\s*/i, '');
          logs.forEach((log, j) => {
            const ts = log.eventTime * 1000;
            const isOn = log.value === 'true';
            unified.push({
              key: `sw-${device.id}-${j}`,
              ts,
              iconBg: isOn ? '#0D2A20' : '#1A1D27',
              iconColor: isOn ? '#34D399' : '#71717a',
              IconComp: isOn ? Lightbulb : LightbulbOff,
              description: `${deviceShort} — ${switchCodeLabel(log.code)} ${isOn ? 'ligada' : 'desligada'}`,
              timeLabel: formatEventTime(ts),
            });
          });
        });

        unified.sort((a, b) => b.ts - a.ts);
        setActivity(unified.slice(0, 100));

        const allSwitchLogs = switchResults.flatMap((r) =>
          r.status === 'fulfilled'
            ? r.value.logs.map((l) => ({ ts: l.eventTime * 1000, value: l.value }))
            : []
        );
        const now = Date.now();
        setBarData(
          Array.from({ length: 7 }, (_, i) => {
            const dayStart = now - (6 - i) * 86_400_000;
            const dayEnd = dayStart + 86_400_000;
            const onEvents = allSwitchLogs.filter(
              (l) => l.ts >= dayStart && l.ts < dayEnd && l.value === 'true'
            ).length;
            return { label: dow(dayStart), minutes: onEvents * 30 };
          })
        );
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
      <div className="mb-6 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold" style={{ color: textMain }}>Histórico</h1>
        <p className="text-sm mt-0.5" style={{ color: textMuted }}>Últimos 7 dias de atividade</p>
      </div>

      {error ? (
        <div
          className="flex items-center gap-2 p-4 rounded-xl text-sm max-w-2xl mx-auto"
          style={{ background: cardBg, color: '#F87171', border: `1px solid ${cardBorder}` }}
        >
          <AlertCircle size={16} />
          Erro ao carregar histórico. Verifique a conexão com a API.
        </div>
      ) : (
        <div className="space-y-4 max-w-2xl mx-auto">
          {/* Bar chart */}
          <div className="rounded-2xl border p-5" style={{ background: cardBg, borderColor: cardBorder }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: textMuted }}>
              Uso de Luzes — minutos/dia
            </p>
            {loading ? (
              <div className="rounded-xl animate-pulse" style={{ background: '#2A2D3A', height: 140 }} />
            ) : barData.length > 0 ? (
              <BarChart data={barData} textMuted={textMuted} cardBorder={cardBorder} />
            ) : (
              <p className="text-sm text-center py-8" style={{ color: textMuted }}>Sem dados de uso</p>
            )}
          </div>

          {/* Activity feed */}
          <div className="rounded-2xl border overflow-hidden" style={{ background: cardBg, borderColor: cardBorder }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: cardBorder }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
                Atividade recente
              </p>
            </div>

            {loading ? (
              <ActivitySkeleton cardBorder={cardBorder} />
            ) : activity.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: textMuted }}>
                Nenhuma atividade registrada
              </p>
            ) : (
              <div className="divide-y overflow-y-auto" style={{ borderColor: cardBorder, maxHeight: 400 }}>
                {activity.map((entry) => (
                  <div key={entry.key} className="flex items-center gap-3 px-5 py-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: entry.iconBg }}
                    >
                      <entry.IconComp size={14} style={{ color: entry.iconColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: textMain }}>
                        {entry.description}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: textMuted }}>
                        {entry.timeLabel}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}