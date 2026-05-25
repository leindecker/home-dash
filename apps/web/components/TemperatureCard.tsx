'use client';

import { BedDouble, Droplets, Laptop, Sofa, Thermometer } from 'lucide-react';

// TODO: substituir por GET /devices/:id quando sensor Zigbee for vinculado
// Estrutura compatível com Tuya API: { va_temperature: 235, va_humidity: 62 }
// Usar parseTemp(va_temperature) para converter décimos de grau em °C

export function parseTemp(value: number): number {
  return value / 10;
}

export interface RoomData {
  name: string;
  icon: 'sofa' | 'bed' | 'laptop';
  temp: number;
  humidity: number;
}

export const MOCK_ROOMS: RoomData[] = [
  { name: 'Sala',         icon: 'sofa',   temp: 23.5, humidity: 62 },
  { name: 'Quarto', icon: 'bed',    temp: 19.2, humidity: 58 },
  { name: 'Office',   icon: 'laptop', temp: 27.8, humidity: 71 },
];

// ─── helpers ──────────────────────────────────────────────

export function tempColor(temp: number): string {
  if (temp < 20)  return '#60A5FA';
  if (temp <= 26) return '#34D399';
  return '#F59E0B';
}

function tempBg(temp: number): string {
  if (temp < 20)  return 'rgba(96,165,250,0.15)';
  if (temp <= 26) return 'rgba(52,211,153,0.15)';
  return 'rgba(245,158,11,0.15)';
}

function RoomIcon({ icon, size = 16 }: { icon: RoomData['icon']; size?: number }) {
  if (icon === 'sofa')   return <Sofa   size={size} />;
  if (icon === 'bed')    return <BedDouble size={size} />;
  return <Laptop size={size} />;
}

// ─── Sparkline SVG (últimas 12h — dados mockados) ─────────
// 7 pontos a cada 2h: 02:00 → 04:00 → 06:00 → 08:00 → 10:00 → 12:00 → 14:00

const CHART_POINTS: [number, number][] = [
  [0,   21.0],
  [50,  20.5],
  [100, 21.5],
  [150, 23.0],
  [200, 24.5],
  [250, 25.5],
  [300, 24.0],
];

const CHART_MIN = 20;
const CHART_MAX = 26;
const CHART_TOP = 3;
const CHART_H   = 52;
const AREA_BTM  = 57;

function toY(temp: number): number {
  return CHART_TOP + ((CHART_MAX - temp) / (CHART_MAX - CHART_MIN)) * CHART_H;
}

function buildPath(pts: [number, number][]): string {
  const mapped = pts.map(([x, t]) => [x, toY(t)] as [number, number]);
  let d = `M ${mapped[0][0]},${mapped[0][1]}`;
  for (let i = 1; i < mapped.length; i++) {
    const [px, py] = mapped[i - 1];
    const [cx, cy] = mapped[i];
    const mx = (px + cx) / 2;
    d += ` C ${mx},${py} ${mx},${cy} ${cx},${cy}`;
  }
  return d;
}

const LINE_D = buildPath(CHART_POINTS);
const AREA_D = `${LINE_D} L 300,${AREA_BTM} L 0,${AREA_BTM} Z`;

function Sparkline({ textMuted }: { textMuted: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium mb-2 uppercase tracking-wide" style={{ color: textMuted }}>
        Variação — últimas 12h
      </p>
      <svg
        viewBox="0 0 300 72"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="temp-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#34D399" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#34D399" stopOpacity="0"    />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path d={AREA_D} fill="url(#temp-area-grad)" />

        {/* Line */}
        <path
          d={LINE_D}
          fill="none"
          stroke="#34D399"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* X-axis labels */}
        <text x="0"   y="70" fontSize="9" fill={textMuted} textAnchor="start">02:00</text>
        <text x="150" y="70" fontSize="9" fill={textMuted} textAnchor="middle">08:00</text>
        <text x="300" y="70" fontSize="9" fill={textMuted} textAnchor="end">14:00</text>
      </svg>
    </div>
  );
}

// ─── TemperatureCard ───────────────────────────────────────

interface TemperatureCardProps {
  isDark: boolean;
  cardBg: string;
  cardBorder: string;
  textMain: string;
  textMuted: string;
}

export default function TemperatureCard({
  isDark, cardBg, cardBorder, textMain, textMuted,
}: TemperatureCardProps) {
  const cellBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';

  return (
    <div
      className="rounded-[14px] border"
      style={{ background: cardBg, borderColor: cardBorder, padding: '12px 16px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Thermometer size={13} style={{ color: '#34D399' }} />
          <h2 className="text-xs font-semibold" style={{ color: textMain }}>Temperatura</h2>
        </div>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: '#0D2A20', color: '#34D399' }}
        >
          {MOCK_ROOMS.length} sensores
        </span>
      </div>

      {/* 3-column room grid */}
      <div className="grid grid-cols-3" style={{ gap: 6 }}>
        {MOCK_ROOMS.map((room) => {
          const color = tempColor(room.temp);
          const bg    = tempBg(room.temp);
          return (
            <div
              key={room.name}
              className="flex flex-col rounded-xl"
              style={{ background: cellBg, padding: '7px 10px', gap: 4 }}
            >
              {/* Name + icon */}
              <div className="flex items-center gap-1.5">
                <div
                  className="rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ width: 22, height: 22, background: bg, color }}
                >
                  <RoomIcon icon={room.icon} size={11} />
                </div>
                <p className="text-[11px] font-medium leading-tight truncate" style={{ color: textMain }}>
                  {room.name}
                </p>
              </div>

              {/* Temperature */}
              <p className="font-bold tabular-nums leading-none" style={{ fontSize: 15, color }}>
                {room.temp.toFixed(1)}°
              </p>

              {/* Humidity */}
              <div className="flex items-center gap-0.5" style={{ color: textMuted }}>
                <Droplets size={9} />
                <span style={{ fontSize: 10 }}>{room.humidity}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}