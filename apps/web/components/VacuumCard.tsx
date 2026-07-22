'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot, Battery, Clock, Square, Home, History,
  Sofa, BedDouble, ChefHat, Laptop, WifiOff, RefreshCw,
} from 'lucide-react';
import { useTokens } from '@/lib/theme';

// ─── types ────────────────────────────────────────────────

type VacuumStatus = 'cleaning' | 'paused' | 'charging' | 'idle' | 'returning' | 'error';

interface LastClean {
  date: string;
  duration: string;
  area: string;
}

interface VacuumState {
  status: VacuumStatus;
  battery: number;
  area: number;
  time: number;
  rooms: number;
  totalRooms: number;
  lastClean: LastClean | null;
}

// ─── helpers ──────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function batteryColor(pct: number): string {
  if (pct > 40) return '#34D399';
  if (pct > 20) return '#F59E0B';
  return '#EF4444';
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  cleaning:  { bg: '#0D1829',     color: '#60A5FA', label: 'Limpando'   },
  paused:    { bg: '#2A1A06',     color: '#F59E0B', label: 'Pausado'    },
  charging:  { bg: '#0D2A20',     color: '#34D399', label: 'Carregando' },
  returning: { bg: '#0D2A20',     color: '#34D399', label: 'Voltando'   },
  error:     { bg: '#2A0D0D',     color: '#EF4444', label: 'Erro'       },
  idle:      { bg: 'transparent', color: '#71717a', label: 'Na base'    },
};

const ROOMS = [
  { id: 'sala',       label: 'Sala',       Icon: Sofa      },
  { id: 'quarto',     label: 'Quarto',     Icon: BedDouble },
  { id: 'cozinha',    label: 'Cozinha',    Icon: ChefHat   },
  { id: 'escritorio', label: 'Escritório', Icon: Laptop    },
];

// ─── RobotMap (SVG) ───────────────────────────────────────

function RobotMap({ status, area }: { status: string; area: number }) {
  const mapRooms = [
    { x: 10,  y: 10, w: 120, h: 80, label: 'Sala'    },
    { x: 140, y: 10, w: 110, h: 80, label: 'Quarto'  },
    { x: 260, y: 10, w: 120, h: 80, label: 'Cozinha' },
  ];

  const cleanedCount = Math.min(Math.floor(area / 20), mapRooms.length);
  const isActive = status === 'cleaning';
  const robotX = isActive ? 80 : 20;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#0D1829' }}>
      <svg viewBox="0 0 400 120" className="w-full" style={{ height: 120 }}>
        {mapRooms.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={6}
            fill={i < cleanedCount ? '#1A3A5C' : '#0D1829'}
            stroke="#1A2845" strokeWidth={1.5}
            opacity={i < cleanedCount ? 0.9 : 0.5} />
        ))}
        {mapRooms.map((r, i) => (
          <text key={i} x={r.x + r.w / 2} y={r.y + r.h / 2 + 4} textAnchor="middle"
            fontSize={9} fill="#60A5FA" opacity={0.6} fontFamily="inherit">
            {r.label}
          </text>
        ))}
        <circle cx={robotX} cy={50} r={7} fill="#60A5FA" opacity={0.9} />
        {isActive && (
          <circle cx={robotX} cy={50} r={7} fill="none" stroke="#60A5FA" strokeWidth={1.5} opacity={0.4}>
            <animate attributeName="r" values="7;14;7" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
          </circle>
        )}
        <text x={8} y={14} fontSize={8} fill="#60A5FA" opacity={0.7} fontFamily="inherit" fontWeight="600">
          Mapa ao vivo
        </text>
      </svg>
    </div>
  );
}

// ─── VacuumCard ───────────────────────────────────────────

export default function VacuumCard() {
  const { cardBg, cardBorder, textMain, textMuted } = useTokens();

  const [vacuumState, setVacuumState] = useState<VacuumState>({
    status: 'idle',
    battery: 0,
    area: 0,
    time: 0,
    rooms: 0,
    totalRooms: 4,
    lastClean: null,
  });

  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      // Chama o proxy Next.js — evita CORS e centraliza a URL do backend
      const res = await fetch('/api/vacuum/status');
      if (!res.ok) {
        setOffline(true);
        return;
      }
      const data = await res.json();
      setOffline(data.offline ?? false);
      setVacuumState((prev) => ({
        ...prev,
        status:    data.status    ?? prev.status,
        battery:   data.battery   ?? prev.battery,
        area:      data.cleanArea ?? prev.area,
        time:      data.cleanTime ?? prev.time,
        lastClean: data.lastClean ?? prev.lastClean,
      }));
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    if (vacuumState.status === 'cleaning') {
      timerRef.current = setInterval(() => {
        setVacuumState((s) => ({ ...s, time: s.time + 1 }));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [vacuumState.status]);

  async function sendCommand(command: string) {
    try {
      await fetch('/api/vacuum/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      setTimeout(fetchStatus, 2000);
    } catch {
      setOffline(true);
    }
  }

  function start() { sendCommand('start'); }
  function pause() { sendCommand('pause'); }
  function stop()  { sendCommand('stop');  }
  function dock()  { sendCommand('dock');  }

  const { status, battery, area, time, rooms, totalRooms, lastClean } = vacuumState;
  const badge  = STATUS_BADGE[status] ?? STATUS_BADGE.idle;
  const isBusy = status === 'cleaning' || status === 'paused';

  return (
    <div
      className="rounded-[14px] border flex flex-col gap-5 p-5"
      style={{ background: cardBg, borderColor: cardBorder }}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: 52, height: 52, borderRadius: '50%', background: '#0D1829', position: 'relative' }}
        >
          <Bot size={26} style={{ color: offline ? '#71717a' : '#60A5FA' }} />
          {status === 'cleaning' && !offline && (
            <div
              className="animate-spin"
              style={{
                position: 'absolute', inset: -3,
                borderRadius: '50%',
                border: '2px solid #60A5FA',
                borderTopColor: 'transparent',
              }}
            />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: textMain }}>Xiaomi S20 Pro</p>
          {loading ? (
            <div className="h-4 w-16 rounded-full mt-1 animate-pulse" style={{ background: '#2A2D3A' }} />
          ) : offline ? (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full mt-0.5"
              style={{ background: '#1A1D27', color: '#71717a' }}
            >
              <WifiOff size={10} />
              Sem conexão
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full mt-0.5"
              style={{ background: badge.bg, color: badge.color }}
            >
              {status === 'cleaning' && (
                <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background: badge.color }} />
              )}
              {badge.label}
            </span>
          )}
        </div>
        {offline && !loading && (
          <button
            onClick={fetchStatus}
            className="p-1.5 rounded-lg transition-opacity hover:opacity-60"
            style={{ color: textMuted }}
            title="Tentar novamente"
          >
            <RefreshCw size={13} />
          </button>
        )}
      </div>

      {/* Offline banner */}
      {offline && !loading && (
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs"
          style={{ background: '#1A1D27', color: textMuted, border: `1px solid ${cardBorder}` }}
        >
          <WifiOff size={13} style={{ flexShrink: 0 }} />
          Robô não encontrado na rede local. Verifique se está ligado e conectado ao Wi-Fi.
        </div>
      )}

      {/* Battery — oculta quando offline e sem dados */}
      {(!offline || battery > 0) && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1" style={{ color: textMuted }}>
              <Battery size={13} />
              <span className="text-[11px]">Bateria</span>
            </div>
            {loading ? (
              <div className="h-3 w-8 rounded animate-pulse" style={{ background: '#2A2D3A' }} />
            ) : (
              <span className="text-[11px] font-semibold" style={{ color: batteryColor(battery) }}>
                {battery}%
              </span>
            )}
          </div>
          <div className="w-full rounded-full" style={{ height: 5, background: '#2A2D3A' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: loading ? '0%' : `${battery}%`, background: batteryColor(battery) }}
            />
          </div>
        </div>
      )}

      {/* Stats (cleaning / paused only) */}
      {isBusy && !offline && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { Icon: Clock,  label: 'Tempo',   value: formatTime(time)            },
            { Icon: Square, label: 'Área',    value: `${area} m²`                },
            { Icon: Home,   label: 'Cômodos', value: `${rooms} de ${totalRooms}` },
          ].map(({ Icon, label, value }) => (
            <div key={label} className="flex flex-col items-center gap-1 rounded-xl py-3" style={{ background: '#0D1829' }}>
              <Icon size={14} style={{ color: '#60A5FA' }} />
              <p className="text-[10px]" style={{ color: textMuted }}>{label}</p>
              <p className="text-xs font-semibold tabular-nums" style={{ color: textMain }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Map */}
      <RobotMap status={offline ? 'idle' : status} area={area} />

      {/* Controls */}
      <div className="grid grid-cols-3 gap-2">
        {status === 'cleaning' && !offline && (
          <>
            <button onClick={stop}  className="py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-80" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>Parar</button>
            <button onClick={pause} className="py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-80" style={{ background: '#2A2D3A', color: textMain }}>Pausar</button>
            <button onClick={dock}  className="py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-80" style={{ background: '#2A2D3A', color: textMain }}>Base</button>
          </>
        )}
        {status === 'paused' && !offline && (
          <>
            <button onClick={start} className="py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80" style={{ background: '#0D1829', color: '#60A5FA', border: '1px solid #1A56A0' }}>Continuar</button>
            <button onClick={dock}  className="py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-80" style={{ background: '#2A2D3A', color: textMain }}>Base</button>
            <button onClick={stop}  className="py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-80" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>Parar</button>
          </>
        )}
        {(offline || status === 'charging' || status === 'idle' || status === 'returning' || status === 'error') && (
          <>
            <button
              onClick={start}
              disabled={offline}
              className="py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#0D1829', color: '#60A5FA', border: '1px solid #1A56A0' }}
            >
              Iniciar
            </button>
            <button
              disabled={offline}
              className="py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#2A2D3A', color: textMain }}
            >
              Por cômodo
            </button>
            <button
              className="py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-80"
              style={{ background: '#2A2D3A', color: textMuted }}
            >
              Agendar
            </button>
          </>
        )}
      </div>

      {/* Room selection */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: textMuted }}>
          Limpar por cômodo
        </p>
        <div className="grid grid-cols-2 gap-2">
          {ROOMS.map(({ id, label, Icon }) => {
            const selected = selectedRooms.has(id);
            return (
              <button
                key={id}
                disabled={offline}
                onClick={() => setSelectedRooms((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id); else next.add(id);
                  return next;
                })}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
                style={selected
                  ? { background: '#0D1829', border: '1px solid #1A56A0', color: '#60A5FA' }
                  : { background: '#2A2D3A', border: '1px solid transparent', color: textMuted }
                }
              >
                <Icon size={14} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Last clean */}
      {lastClean && (
        <div className="flex items-start gap-3 pt-4" style={{ borderTop: `1px solid ${cardBorder}` }}>
          <History size={15} style={{ color: textMuted, flexShrink: 0, marginTop: 2 }} />
          <div>
            <p className="text-[11px] font-semibold" style={{ color: textMuted }}>Última limpeza completa</p>
            <p className="text-xs mt-0.5" style={{ color: textMain }}>{lastClean.date}</p>
            <p className="text-[11px] mt-0.5" style={{ color: textMuted }}>{lastClean.duration} · {lastClean.area}</p>
          </div>
        </div>
      )}
    </div>
  );
}