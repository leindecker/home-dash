'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Calendar, ChevronDown, Cloud, CloudDrizzle, CloudFog,
  CloudLightning, CloudMoon, CloudRain, CloudSun,
  Cloudy, Droplets, Eye, Gauge, MapPin, Moon,
  Snowflake, Sun, Wind, X,
} from 'lucide-react';

// ─── types ────────────────────────────────────────────────

export interface WeatherData {
  current: {
    temp: number;
    feelsLike: number;
    description: string;
    icon: string;
    humidity: number;
    windSpeed: number;
    visibility: number;
    pressure: number;
    sunrise: number;
    sunset: number;
    city: string;
  };
  hourly: { time: string; temp: number; icon: string; rain: number }[];
  forecast: { dow: string; icon: string; hi: number; lo: number }[];
}

// ─── helpers ──────────────────────────────────────────────

const OWM_EMOJI: Record<string, string> = {
  '01d': '☀️',  '01n': '🌙',
  '02d': '🌤️', '02n': '🌙',
  '03d': '⛅',  '03n': '⛅',
  '04d': '⛅',  '04n': '⛅',
  '09d': '🌦️', '09n': '🌦️',
  '10d': '🌧️', '10n': '🌧️',
  '11d': '⛈️', '11n': '⛈️',
  '13d': '❄️',  '13n': '❄️',
  '50d': '🌫️', '50n': '🌫️',
};

function owmEmoji(code: string): string {
  return OWM_EMOJI[code] ?? OWM_EMOJI[`${code.slice(0, 2)}d`] ?? '🌡️';
}

function conditionColor(code: string): string {
  const base = code.slice(0, 2);
  if (base === '01') return '#F59E0B';
  if (base === '11') return '#A78BFA';
  if (base === '13') return '#BAE6FD';
  if (base === '09' || base === '10') return '#60A5FA';
  return '#8B8FA8';
}

function conditionBg(code: string): string {
  const base = code.slice(0, 2);
  if (base === '01') return 'rgba(245,158,11,0.15)';
  if (base === '11') return 'rgba(167,139,250,0.15)';
  if (base === '13') return 'rgba(186,230,253,0.15)';
  if (base === '09' || base === '10') return 'rgba(96,165,250,0.15)';
  return 'rgba(139,143,168,0.15)';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatTime(unix: number): string {
  return new Date(unix * 1000).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

// ─── OWM → lucide icon ────────────────────────────────────

function OWMIcon({ code, size = 22 }: { code: string; size?: number }) {
  const base  = code.slice(0, 2);
  const night = code.endsWith('n');
  if (base === '01') return night ? <Moon size={size} /> : <Sun size={size} />;
  if (base === '02') return night ? <CloudMoon size={size} /> : <CloudSun size={size} />;
  if (base === '03') return <Cloud size={size} />;
  if (base === '04') return <Cloudy size={size} />;
  if (base === '09') return <CloudDrizzle size={size} />;
  if (base === '10') return <CloudRain size={size} />;
  if (base === '11') return <CloudLightning size={size} />;
  if (base === '13') return <Snowflake size={size} />;
  if (base === '50') return <CloudFog size={size} />;
  return <Cloud size={size} />;
}

// ─── skeleton ─────────────────────────────────────────────

function Skeleton({ isDark, cardBg, cardBorder, textMain }: {
  isDark: boolean; cardBg: string; cardBorder: string; textMain: string;
}) {
  const pulse = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  return (
    <div className="rounded-[14px] border p-5" style={{ background: cardBg, borderColor: cardBorder }}>
      <div className="flex items-center justify-between mb-5">
        <span className="text-sm font-semibold" style={{ color: textMain }}>Clima</span>
        <div className="w-24 h-5 rounded-full animate-pulse" style={{ background: pulse }} />
      </div>
      <div className="flex items-center gap-4 mb-5">
        <div className="w-14 h-14 rounded-full flex-shrink-0 animate-pulse" style={{ background: pulse }} />
        <div className="space-y-2 flex-1">
          <div className="w-20 h-9 rounded animate-pulse" style={{ background: pulse }} />
          <div className="w-32 h-3 rounded animate-pulse" style={{ background: pulse }} />
          <div className="w-24 h-3 rounded animate-pulse" style={{ background: pulse }} />
        </div>
      </div>
      <div className="w-full h-9 rounded-xl animate-pulse" style={{ background: pulse }} />
    </div>
  );
}

// ─── modal ────────────────────────────────────────────────

function WeatherModal({
  data, isDark, cardBg, cardBorder, textMain, textMuted, onClose,
}: {
  data: WeatherData;
  isDark: boolean;
  cardBg: string;
  cardBorder: string;
  textMain: string;
  textMuted: string;
  onClose: () => void;
}) {
  const rowBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const section = (label: string) => (
    <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: textMuted }}>
      {label}
    </p>
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] rounded-[14px] border flex flex-col"
        style={{ background: cardBg, borderColor: cardBorder, maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: cardBorder }}
        >
          <div>
            <h2 className="text-sm font-semibold" style={{ color: textMain }}>
              Clima — {data.current.city}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: textMuted }}>
              {capitalize(data.current.description)} · {data.current.temp}°C
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
            style={{ color: textMuted }}
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal body */}
        <div className="overflow-y-auto p-5 space-y-6">

          {/* 1. Detalhes de hoje */}
          <div>
            {section('Detalhes de hoje')}
            <div className="grid grid-cols-4 gap-2">
              {[
                { icon: <Droplets size={16} />, value: `${data.current.humidity}%`,          label: 'Umidade'    },
                { icon: <Wind      size={16} />, value: `${data.current.windSpeed} km/h`,     label: 'Vento'      },
                { icon: <Eye       size={16} />, value: `${data.current.visibility} km`,      label: 'Visib.'     },
                { icon: <Gauge     size={16} />, value: `${data.current.pressure} hPa`,       label: 'Pressão'    },
              ].map(({ icon, value, label }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl"
                  style={{ background: rowBg }}
                >
                  <span style={{ color: textMuted }}>{icon}</span>
                  <span className="text-xs font-semibold tabular-nums" style={{ color: textMain }}>{value}</span>
                  <span className="text-[10px]" style={{ color: textMuted }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Por hora */}
          <div>
            {section('Por hora')}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {data.hourly.map((h, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-[52px] flex flex-col items-center gap-1 py-2 rounded-xl"
                  style={{
                    background: i === 0
                      ? 'rgba(96,165,250,0.12)'
                      : rowBg,
                  }}
                >
                  <span
                    className="text-[10px] font-medium"
                    style={{ color: i === 0 ? '#60A5FA' : textMuted }}
                  >
                    {i === 0 ? 'Agora' : h.time}
                  </span>
                  <span className="text-base leading-none">{owmEmoji(h.icon)}</span>
                  <span className="text-xs font-semibold" style={{ color: textMain }}>{h.temp}°</span>
                  {h.rain > 0 && (
                    <span className="text-[10px] tabular-nums" style={{ color: '#60A5FA' }}>{h.rain}%</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 3. Próximos 5 dias */}
          <div>
            {section('Próximos 5 dias')}
            <div className="grid grid-cols-5 gap-1.5">
              {data.forecast.map((day, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-xl"
                  style={{
                    background: i === 0 ? 'rgba(96,165,250,0.12)' : rowBg,
                  }}
                >
                  <span
                    className="text-[10px] font-semibold"
                    style={{ color: i === 0 ? '#60A5FA' : textMuted }}
                  >
                    {day.dow}
                  </span>
                  <span className="text-sm leading-none">{owmEmoji(day.icon)}</span>
                  <span className="text-xs font-semibold" style={{ color: textMain }}>{day.hi}°</span>
                  <span className="text-[10px]" style={{ color: textMuted }}>{day.lo}°</span>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Sol */}
          <div>
            {section('Sol')}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: rowBg }}>
                <span className="text-xl leading-none">🌅</span>
                <div>
                  <p className="text-xs font-semibold" style={{ color: textMain }}>
                    {formatTime(data.current.sunrise)}
                  </p>
                  <p className="text-[11px]" style={{ color: textMuted }}>Nascer do sol</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: rowBg }}>
                <span className="text-xl leading-none">🌇</span>
                <div>
                  <p className="text-xs font-semibold" style={{ color: textMain }}>
                    {formatTime(data.current.sunset)}
                  </p>
                  <p className="text-[11px]" style={{ color: textMuted }}>Pôr do sol</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── WeatherCard ──────────────────────────────────────────

interface WeatherCardProps {
  isDark: boolean;
  cardBg: string;
  cardBorder: string;
  textMain: string;
  textMuted: string;
  onWeatherUpdate?: (display: string | null) => void;
}

const lat  = parseFloat(process.env.NEXT_PUBLIC_WEATHER_LAT  ?? '-27.5554');
const lon  = parseFloat(process.env.NEXT_PUBLIC_WEATHER_LON  ?? '-48.6277');
const city = process.env.NEXT_PUBLIC_WEATHER_CITY ?? 'São José';

export default function WeatherCard({
  isDark, cardBg, cardBorder, textMain, textMuted, onWeatherUpdate,
}: WeatherCardProps) {
  const [data, setData]           = useState<WeatherData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const onUpdateRef = useRef(onWeatherUpdate);
  onUpdateRef.current = onWeatherUpdate;

  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    try {
      const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
      if (!res.ok) throw new Error('error');
      const d: WeatherData = await res.json();
      setData(d);
      onUpdateRef.current?.(`${d.current.temp}°C ${owmEmoji(d.current.icon)}`);
    } catch {
      // keep previous data on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather(lat, lon);
  }, [fetchWeather]);

  // Polling every 10 min
  useEffect(() => {
    const id = setInterval(() => fetchWeather(lat, lon), 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchWeather]);

  if (loading) {
    return <Skeleton isDark={isDark} cardBg={cardBg} cardBorder={cardBorder} textMain={textMain} />;
  }

  if (!data) {
    return (
      <div className="rounded-[14px] border p-5" style={{ background: cardBg, borderColor: cardBorder }}>
        <span className="text-sm font-semibold" style={{ color: textMain }}>Clima</span>
        <p className="mt-4 font-light" style={{ fontSize: 40, lineHeight: 1, color: textMuted }}>--°C</p>
      </div>
    );
  }

  const iconColor = conditionColor(data.current.icon);
  const iconBg    = conditionBg(data.current.icon);

  return (
    <>
      <div className="rounded-[14px] border p-5 flex flex-col" style={{ background: cardBg, borderColor: cardBorder }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: textMain }}>Clima</h2>
          <span
            className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: '#0D1829', color: '#60A5FA' }}
          >
            <MapPin size={9} />
            {city}
          </span>
        </div>

        {/* Current weather */}
        <div className="flex items-center gap-4 mb-4 flex-1">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: iconBg, color: iconColor }}
          >
            <OWMIcon code={data.current.icon} size={26} />
          </div>
          <div className="min-w-0">
            <div className="font-light leading-none" style={{ fontSize: 40, color: textMain }}>
              {data.current.temp}°
            </div>
            <p className="text-xs mt-1 truncate" style={{ color: textMuted }}>
              {capitalize(data.current.description)}
            </p>
            <p className="text-xs mt-0.5" style={{ color: textMuted }}>
              Sensação {data.current.feelsLike}°C
            </p>
          </div>
        </div>

        {/* Ver previsão */}
        <button
          onClick={() => setShowModal(true)}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs transition-opacity hover:opacity-70"
          style={{ borderColor: cardBorder, color: textMuted, background: 'transparent' }}
        >
          <Calendar size={13} />
          Ver previsão completa
          <ChevronDown size={13} className="ml-auto" />
        </button>
      </div>

      {showModal && (
        <WeatherModal
          data={data}
          isDark={isDark}
          cardBg={cardBg}
          cardBorder={cardBorder}
          textMain={textMain}
          textMuted={textMuted}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
