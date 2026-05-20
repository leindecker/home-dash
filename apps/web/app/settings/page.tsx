'use client';

import { useEffect, useState } from 'react';
import {
  Wifi, WifiOff, Music, Cloud, Mic, Lightbulb, DoorOpen,
  Check, X, RefreshCw, Sun, Moon, ShieldCheck, Shield, QrCode,
} from 'lucide-react';
import { useTokens, useTheme } from '@/lib/theme';
import { fetchDevices, fetchMe, setup2FA, confirm2FA, disable2FA, Device, UserProfile } from '@/lib/api';
import RoomsSettings from '@/components/RoomsSettings';

// ─── Integration item ──────────────────────────────────────

interface Integration {
  key: string;
  name: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  checkStatus: () => Promise<boolean>;
}

async function checkTuya(): Promise<boolean> {
  const res = await fetch('/api/health?service=tuya').catch(() => null);
  // If endpoint doesn't exist, fall back to checking devices
  const devRes = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/devices`
  ).catch(() => null);
  return devRes?.ok ?? false;
}

async function checkSpotify(): Promise<boolean> {
  const res = await fetch('/api/spotify/player').catch(() => null);
  return res != null && res.status !== 401 && res.status !== 500;
}

async function checkOWM(): Promise<boolean> {
  const lat = process.env.NEXT_PUBLIC_WEATHER_LAT ?? '-27.5554';
  const lon = process.env.NEXT_PUBLIC_WEATHER_LON ?? '-48.6277';
  const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`).catch(() => null);
  return res?.ok ?? false;
}

const INTEGRATIONS: Integration[] = [
  {
    key: 'tuya',
    name: 'Tuya Cloud',
    description: 'Dispositivos inteligentes (luzes, sensores)',
    icon: Wifi,
    iconColor: '#34D399',
    iconBg: '#0D2A20',
    checkStatus: checkTuya,
  },
  {
    key: 'spotify',
    name: 'Spotify',
    description: 'Controle de música e player',
    icon: Music,
    iconColor: '#1DB954',
    iconBg: '#0D2A1A',
    checkStatus: checkSpotify,
  },
  {
    key: 'owm',
    name: 'OpenWeatherMap',
    description: 'Clima atual e previsão do tempo',
    icon: Cloud,
    iconColor: '#60A5FA',
    iconBg: '#0D1829',
    checkStatus: checkOWM,
  },
  {
    key: 'alexa',
    name: 'Amazon Alexa',
    description: 'Controle por voz (em breve)',
    icon: Mic,
    iconColor: '#A78BFA',
    iconBg: '#1A0D2A',
    checkStatus: async () => false,
  },
];

// ─── IntegrationRow ────────────────────────────────────────

function IntegrationRow({
  integration,
  status,
  cardBorder,
  textMain,
  textMuted,
  rowBg,
}: {
  integration: Integration;
  status: 'loading' | 'ok' | 'error';
  cardBorder: string;
  textMain: string;
  textMuted: string;
  rowBg: string;
}) {
  const Icon = integration.icon;
  return (
    <div
      className="flex items-center gap-4 px-5 py-4"
      style={{ borderBottom: `1px solid ${cardBorder}` }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: integration.iconBg }}
      >
        <Icon size={18} style={{ color: integration.iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: textMain }}>
          {integration.name}
        </p>
        <p className="text-xs" style={{ color: textMuted }}>
          {integration.description}
        </p>
      </div>
      <div className="flex-shrink-0">
        {status === 'loading' ? (
          <span
            className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin inline-block"
            style={{ borderColor: textMuted, borderTopColor: 'transparent' }}
          />
        ) : status === 'ok' ? (
          <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#34D399' }}>
            <Check size={13} />
            Conectado
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#F87171' }}>
            <X size={13} />
            Offline
          </span>
        )}
      </div>
    </div>
  );
}

// ─── DeviceRow ─────────────────────────────────────────────

function DeviceRow({
  device,
  cardBorder,
  textMain,
  textMuted,
}: {
  device: Device;
  cardBorder: string;
  textMain: string;
  textMuted: string;
}) {
  const Icon = device.type === 'lock' ? DoorOpen : Lightbulb;
  const iconColor = device.online ? '#34D399' : '#71717a';
  const iconBg = device.online ? '#0D2A20' : '#1A1D27';

  return (
    <div
      className="flex items-center gap-4 px-5 py-4"
      style={{ borderBottom: `1px solid ${cardBorder}` }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: iconBg }}
      >
        <Icon size={18} style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: textMain }}>
          {device.name}
        </p>
        <p className="text-xs" style={{ color: textMuted }}>
          {device.type} · ID: {device.id.slice(0, 8)}…
        </p>
      </div>
      <span
        className="text-[11px] font-medium px-2.5 py-1 rounded-full flex-shrink-0"
        style={{
          background: device.online ? '#0D2A20' : '#1A1D27',
          color: device.online ? '#34D399' : '#71717a',
        }}
      >
        {device.online ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}

// ─── TwoFactorCard ─────────────────────────────────────────

function TwoFactorCard({
  cardBg, cardBorder, textMain, textMuted,
}: {
  cardBg: string; cardBorder: string; textMain: string; textMuted: string;
}) {
  const [profile, setProfile]   = useState<UserProfile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [setupMode, setSetupMode] = useState(false);
  const [qrUrl, setQrUrl]       = useState('');
  const [qrImg, setQrImg]       = useState('');
  const [otpCode, setOtpCode]   = useState('');
  const [error, setError]       = useState('');
  const [working, setWorking]   = useState(false);

  useEffect(() => {
    fetchMe().then(setProfile).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleSetup() {
    setWorking(true);
    setError('');
    try {
      const data = await setup2FA();
      setQrUrl(data.otpauthUrl);
      // Generate QR image via qrcode
      const QRCode = (await import('qrcode')).default;
      const img = await QRCode.toDataURL(data.otpauthUrl, { width: 180, margin: 1 });
      setQrImg(img);
      setSetupMode(true);
    } catch { setError('Erro ao iniciar configuração'); }
    finally { setWorking(false); }
  }

  async function handleConfirm() {
    if (otpCode.length !== 6) { setError('Digite o código de 6 dígitos'); return; }
    setWorking(true);
    setError('');
    try {
      await confirm2FA(otpCode);
      setProfile((p) => p ? { ...p, totpEnabled: true } : p);
      setSetupMode(false);
      setQrImg('');
      setOtpCode('');
    } catch { setError('Código inválido'); }
    finally { setWorking(false); }
  }

  async function handleDisable() {
    if (!confirm('Desativar a verificação em duas etapas?')) return;
    setWorking(true);
    try {
      await disable2FA();
      setProfile((p) => p ? { ...p, totpEnabled: false } : p);
    } catch { setError('Erro ao desativar'); }
    finally { setWorking(false); }
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: cardBg, borderColor: cardBorder }}>
      <div className="px-5 py-4 border-b" style={{ borderColor: cardBorder }}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: textMuted }}>Segurança</p>
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin inline-block"
            style={{ borderColor: '#34D399', borderTopColor: 'transparent' }} />
        ) : setupMode ? (
          <div className="space-y-4">
            <p className="text-sm font-medium" style={{ color: textMain }}>
              Escaneie com Google Authenticator ou Authy
            </p>
            {qrImg && (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrImg} alt="QR Code 2FA" className="rounded-xl"
                  style={{ width: 180, height: 180, imageRendering: 'pixelated' }} />
              </div>
            )}
            <div>
              <label className="block text-xs mb-1" style={{ color: textMuted }}>Código de confirmação</label>
              <input
                type="text" inputMode="numeric" maxLength={6} value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ background: '#13151F', borderColor: '#2A2D3A', color: '#ffffff' }}
              />
            </div>
            {error && <p className="text-xs" style={{ color: '#F87171' }}>{error}</p>}
            <div className="flex gap-2">
              <button onClick={handleConfirm} disabled={working}
                className="flex-1 py-2 rounded-xl text-xs font-semibold disabled:opacity-50 transition-opacity hover:opacity-80"
                style={{ background: '#1D9E75', color: '#ffffff' }}>
                {working ? 'Confirmando…' : 'Confirmar ativação'}
              </button>
              <button onClick={() => { setSetupMode(false); setError(''); }}
                className="px-4 py-2 rounded-xl text-xs border transition-opacity hover:opacity-70"
                style={{ borderColor: cardBorder, color: textMuted }}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: profile?.totpEnabled ? '#0D2A20' : '#1A1D27' }}>
                {profile?.totpEnabled
                  ? <ShieldCheck size={18} style={{ color: '#34D399' }} />
                  : <Shield size={18} style={{ color: '#71717a' }} />}
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: textMain }}>Verificação em duas etapas</p>
                <p className="text-xs" style={{ color: textMuted }}>
                  {profile?.totpEnabled ? 'Ativo — TOTP (Google Authenticator)' : 'Adiciona uma camada extra de segurança'}
                </p>
              </div>
            </div>
            {profile?.totpEnabled ? (
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: '#0D2A20', color: '#34D399' }}>
                  2FA Ativo
                </span>
                <button onClick={handleDisable} disabled={working}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-full border transition-opacity hover:opacity-70 disabled:opacity-40"
                  style={{ borderColor: cardBorder, color: textMuted }}>
                  Desativar
                </button>
              </div>
            ) : (
              <button onClick={handleSetup} disabled={working}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-opacity hover:opacity-80 disabled:opacity-50 flex-shrink-0"
                style={{ background: '#0D1829', color: '#60A5FA' }}>
                <QrCode size={13} />
                {working ? 'Gerando…' : 'Ativar 2FA'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────

export default function SettingsPage() {
  const { cardBg, cardBorder, textMain, textMuted, pageBg, rowBg } = useTokens();
  const { isDark, toggle } = useTheme();
  const [integrationStatuses, setIntegrationStatuses] = useState<
    Record<string, 'loading' | 'ok' | 'error'>
  >(Object.fromEntries(INTEGRATIONS.map((i) => [i.key, 'loading'])));
  const [devices, setDevices] = useState<Device[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function checkIntegrations() {
    setIntegrationStatuses(Object.fromEntries(INTEGRATIONS.map((i) => [i.key, 'loading'])));
    await Promise.allSettled(
      INTEGRATIONS.map(async (i) => {
        const ok = await i.checkStatus().catch(() => false);
        setIntegrationStatuses((prev) => ({ ...prev, [i.key]: ok ? 'ok' : 'error' }));
      })
    );
  }

  async function loadDevices() {
    setDevicesLoading(true);
    try {
      const devs = await fetchDevices();
      setDevices(devs.filter((d) => d.type !== 'hub'));
    } catch {
      setDevices([]);
    } finally {
      setDevicesLoading(false);
    }
  }

  useEffect(() => {
    checkIntegrations();
    loadDevices();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([checkIntegrations(), loadDevices()]);
    setRefreshing(false);
  }

  return (
    <div className="p-4 sm:p-6 min-h-screen" style={{ background: pageBg }}>
      {/* Topbar */}
      <div className="flex items-start justify-between mb-6 gap-4 max-w-4xl mx-auto">
        <div>
          <h1 className="text-xl font-bold" style={{ color: textMain }}>
            Configurações
          </h1>
          <p className="text-sm mt-0.5" style={{ color: textMuted }}>
            Integrações e dispositivos
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ background: cardBg, borderColor: cardBorder, color: textMuted }}
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Rooms section — wider layout */}
      <div className="mb-4 max-w-4xl mx-auto">
        <RoomsSettings />
      </div>

      <div className="space-y-4 max-w-2xl mx-auto">
        {/* Security */}
        <TwoFactorCard
          cardBg={cardBg} cardBorder={cardBorder}
          textMain={textMain} textMuted={textMuted}
        />

        {/* Appearance */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ background: cardBg, borderColor: cardBorder }}
        >
          <div className="px-5 py-4 border-b" style={{ borderColor: cardBorder }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
              Aparência
            </p>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-medium" style={{ color: textMain }}>
                Tema
              </p>
              <p className="text-xs" style={{ color: textMuted }}>
                {isDark ? 'Modo escuro ativo' : 'Modo claro ativo'}
              </p>
            </div>
            <button
              onClick={toggle}
              className="flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-xl border transition-all hover:opacity-70"
              style={{ background: isDark ? '#1A1D27' : '#f1f5f9', borderColor: cardBorder, color: textMain }}
            >
              {isDark ? <Moon size={14} /> : <Sun size={14} />}
              {isDark ? 'Escuro' : 'Claro'}
            </button>
          </div>
        </div>

        {/* Integrations */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ background: cardBg, borderColor: cardBorder }}
        >
          <div className="px-5 py-4 border-b" style={{ borderColor: cardBorder }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
              Integrações
            </p>
          </div>
          {INTEGRATIONS.map((integration) => (
            <IntegrationRow
              key={integration.key}
              integration={integration}
              status={integrationStatuses[integration.key]}
              cardBorder={cardBorder}
              textMain={textMain}
              textMuted={textMuted}
              rowBg={rowBg}
            />
          ))}
        </div>

        {/* Devices */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ background: cardBg, borderColor: cardBorder }}
        >
          <div className="px-5 py-4 border-b" style={{ borderColor: cardBorder }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
              Dispositivos
            </p>
          </div>

          {devicesLoading ? (
            <div className="flex justify-center py-8">
              <span
                className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: '#34D399', borderTopColor: 'transparent' }}
              />
            </div>
          ) : devices.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: textMuted }}>
              Nenhum dispositivo encontrado
            </p>
          ) : (
            devices.map((d) => (
              <DeviceRow
                key={d.id}
                device={d}
                cardBorder={cardBorder}
                textMain={textMain}
                textMuted={textMuted}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
