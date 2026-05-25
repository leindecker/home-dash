'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Sun, Moon, Wifi, WifiOff,
  Lightbulb, DoorOpen, DoorClosed,
  LayoutGrid, ChevronRight, X, Pencil, Music, Thermometer,
} from 'lucide-react';
import {
  fetchDevices, fetchDeviceLogs, sendDeviceCommand,
  fetchSwitchLabels, updateSwitchLabel,
  Device, DeviceLog,
} from '@/lib/api';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { useTheme, useTokens } from '@/lib/theme';
import SwitchCard from '@/components/SwitchCard';
import { MOCK_ROOMS, tempColor } from '@/components/TemperatureCard';
import WeatherCard from '@/components/WeatherCard';

// ─── helpers ──────────────────────────────────────────────

function getSwitchCodes(device: Device): string[] {
  const fromStatus = (device.status ?? [])
    .filter((s) => /^switch_\d+$/.test(s.code))
    .map((s) => s.code)
    .sort();
  if (fromStatus.length > 0) return fromStatus;
  const count = device.buttons ?? 1;
  return Array.from({ length: count }, (_, i) => `switch_${i + 1}`);
}

function switchLabel(code: string) {
  const n = code.match(/^switch_(\d+)$/)?.[1];
  return n ? `L${n}` : code;
}

// ─── shared primitives ────────────────────────────────────

function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0 mt-0.5"
      style={{ background: online ? '#1D9E75' : '#EF4444' }}
    />
  );
}

function Toggle({ checked, onChange, disabled }: {
  checked: boolean; onChange: () => void; disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className="relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-40"
      style={{ background: checked ? '#1D9E75' : '#3f3f46' }}
    >
      <span
        className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ transform: checked ? 'translateX(18px)' : 'translateX(3px)' }}
      />
    </button>
  );
}

function MetricCard({ icon, label, value, sub, accent, cardBg, cardBorder, textMuted }: {
  icon: React.ReactNode; label: string; value: string;
  sub?: string; accent?: string;
  cardBg: string; cardBorder: string; textMuted: string;
}) {
  return (
    <div className="rounded-[14px] border p-4 flex flex-col gap-2" style={{ background: cardBg, borderColor: cardBorder }}>
      <div className="flex items-center gap-2 text-xs" style={{ color: textMuted }}>
        <span className="w-4 h-4 flex-shrink-0">{icon}</span>
        {label}
      </div>
      <div className="text-xl font-bold leading-none truncate" style={{ color: accent ?? '#ffffff' }}>
        {value}
      </div>
      {sub && <div className="text-xs" style={{ color: textMuted }}>{sub}</div>}
    </div>
  );
}

// ─── SwitchRow ────────────────────────────────────────────

function SwitchRow({ label, defaultLabel, checked, onChange, disabled, isDark, textMuted, textMain, onSaveLabel }: {
  label: string; defaultLabel: string; checked: boolean;
  onChange: () => void; disabled?: boolean;
  isDark: boolean; textMuted: string; textMain: string;
  onSaveLabel: (newLabel: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!editing) setEditValue(label); }, [label, editing]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  function startEdit(e: React.MouseEvent) { e.stopPropagation(); setEditValue(label); setEditing(true); }

  async function saveEdit() {
    const trimmed = editValue.trim();
    setEditing(false);
    await onSaveLabel(trimmed || defaultLabel);
  }

  function cancelEdit() { setEditValue(label); setEditing(false); }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
    if (e.key === 'Escape') cancelEdit();
  }

  return (
    <div
      className="group flex items-center px-3 py-2.5 rounded-xl transition-colors duration-200"
      style={{ background: checked && !editing ? '#0D2A20' : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
    >
      {editing ? (
        <div className="flex items-center gap-2 w-full">
          <input
            ref={inputRef} autoFocus type="text" value={editValue} maxLength={20}
            onChange={(e) => setEditValue(e.target.value)} onKeyDown={handleKeyDown}
            className="flex-1 min-w-0 text-xs bg-transparent outline-none border-b border-zinc-600 focus:border-[#1D9E75] transition-colors pb-px"
            style={{ color: textMain }}
          />
          <button onClick={saveEdit} className="flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 transition-opacity hover:opacity-80" style={{ background: '#1D9E75', color: '#fff', borderRadius: 6 }}>
            Salvar
          </button>
          <button onClick={cancelEdit} className="flex-shrink-0 transition-opacity hover:opacity-70" style={{ color: textMuted }} aria-label="Cancelar">
            <X size={12} />
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: checked ? '#34D399' : textMuted }}>
              {label}
            </span>
            <button onClick={startEdit} className="opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-60 p-0.5 rounded" style={{ color: textMuted }} aria-label={`Renomear ${label}`}>
              <Pencil size={10} />
            </button>
          </div>
          <Toggle checked={checked} onChange={onChange} disabled={disabled} />
        </>
      )}
    </div>
  );
}

// ─── SwitchDeviceBlock ────────────────────────────────────

function SwitchDeviceBlock({ device, isDark, textMuted, textMain, getStatus, handleToggle, pendingToggles, getLabel, onSaveLabel }: {
  device: Device; isDark: boolean; textMuted: string; textMain: string;
  getStatus: (id: string, code: string) => boolean;
  handleToggle: (id: string, code: string) => void;
  pendingToggles: Set<string>;
  getLabel: (deviceId: string, code: string) => string;
  onSaveLabel: (deviceId: string, code: string, newLabel: string) => Promise<void>;
}) {
  const codes = getSwitchCodes(device);
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <StatusDot online={device.online} />
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
          {device.name.replace(/^Interruptor\s*/i, '')}
        </p>
      </div>
      <div className="space-y-1.5">
        {codes.map((code) => {
          const isOn = getStatus(device.id, code);
          const isPending = pendingToggles.has(`${device.id}:${code}`);
          return (
            <SwitchRow
              key={code}
              label={getLabel(device.id, code)}
              defaultLabel={switchLabel(code)}
              checked={isOn}
              onChange={() => handleToggle(device.id, code)}
              disabled={isPending || !device.online}
              isDark={isDark} textMuted={textMuted} textMain={textMain}
              onSaveLabel={(newLabel) => onSaveLabel(device.id, code, newLabel)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── AllSwitchesModal ─────────────────────────────────────

function AllSwitchesModal({ switchDevices, isDark, textMain, textMuted, cardBg, cardBorder, getStatus, handleToggle, pendingToggles, getLabel, onSaveLabel, onClose }: {
  switchDevices: Device[]; isDark: boolean; textMain: string; textMuted: string;
  cardBg: string; cardBorder: string;
  getStatus: (id: string, code: string) => boolean;
  handleToggle: (id: string, code: string) => void;
  pendingToggles: Set<string>;
  getLabel: (deviceId: string, code: string) => string;
  onSaveLabel: (deviceId: string, code: string, newLabel: string) => Promise<void>;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-[480px] rounded-[14px] border flex flex-col" style={{ background: cardBg, borderColor: cardBorder, maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: cardBorder }}>
          <h2 className="text-sm font-semibold" style={{ color: textMain }}>Todos os interruptores</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:opacity-70" style={{ color: textMuted }} aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          <div className="space-y-6">
            {switchDevices.map((sw) => (
              <SwitchDeviceBlock key={sw.id} device={sw} isDark={isDark} textMain={textMain} textMuted={textMuted} getStatus={getStatus} handleToggle={handleToggle} pendingToggles={pendingToggles} getLabel={getLabel} onSaveLabel={onSaveLabel} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────

export default function Dashboard() {
  const { isDark, toggle } = useTheme();
  const { pageBg, cardBg, cardBorder, textMain, textMuted } = useTokens();

  const [devices, setDevices] = useState<Device[]>([]);
  const [logs, setLogs] = useState<DeviceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingToggles, setPendingToggles] = useState<Set<string>>(new Set());
  const [showAllSwitches, setShowAllSwitches] = useState(false);
  const [switchLabels, setSwitchLabels] = useState<Record<string, string>>({});
  const [now, setNow] = useState(new Date());

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = showAllSwitches ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showAllSwitches]);

  const loadData = useCallback(async () => {
    try {
      const devicesData = await fetchDevices();
      setDevices(devicesData);

      const switchDev = devicesData.filter((d) => d.type === 'switch');
      const hub = devicesData.find((d) => d.type === 'hub');

      const [labelsResults] = await Promise.all([
        Promise.allSettled(
          switchDev.map((d) =>
            fetchSwitchLabels(d.id).then((entries) => ({ deviceId: d.id, entries }))
          )
        ),
        hub
          ? fetchDeviceLogs(hub.id).catch(() => [] as DeviceLog[]).then((l) => setLogs(l.slice(0, 4)))
          : Promise.resolve(),
      ]);

      const labelsMap: Record<string, string> = {};
      for (const r of labelsResults) {
        if (r.status === 'fulfilled') {
          for (const { code, label } of r.value.entries) {
            labelsMap[`${r.value.deviceId}:${code}`] = label;
          }
        }
      }
      setSwitchLabels(labelsMap);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const socket = getSocket();
    socket.on(
      'device:status',
      (updates: { id: string; status: { code: string; value: boolean | string | number }[] }[]) => {
        setDevices((prev) =>
          prev.map((d) => {
            const u = updates.find((x) => x.id === d.id);
            return u ? { ...d, status: u.status } : d;
          })
        );
      }
    );
    return () => { socket.off('device:status'); disconnectSocket(); };
  }, [loadData]);

  // ── derived ────────────────────────────────────────────

  const hub = devices.find((d) => d.type === 'hub');
  const switchDevices = devices.filter((d) => d.type === 'switch');
  const previewSwitches = switchDevices.slice(0, 3);

  const lightsOnCount = devices
    .filter((d) => d.type === 'switch')
    .flatMap((d) => d.status)
    .filter((s) => /^switch_\d+$/.test(s.code) && s.value === true)
    .length;

  const totalChannels = devices
    .filter((d) => d.type === 'switch')
    .flatMap((d) => d.status)
    .filter((s) => /^switch_\d+$/.test(s.code))
    .length;

  const isDoorOpen = logs[0]?.code === 'doorcontact_state' && logs[0]?.value === 'true';

  // ── label helpers ──────────────────────────────────────

  function getLabel(deviceId: string, code: string): string {
    return switchLabels[`${deviceId}:${code}`] ?? switchLabel(code);
  }

  async function handleSaveLabel(deviceId: string, code: string, newLabel: string) {
    const key = `${deviceId}:${code}`;
    const prevLabel = switchLabels[key] ?? switchLabel(code);
    setSwitchLabels((prev) => ({ ...prev, [key]: newLabel }));
    try {
      await updateSwitchLabel(deviceId, code, newLabel);
    } catch (e) {
      setSwitchLabels((prev) => ({ ...prev, [key]: prevLabel }));
      console.error('Failed to save label:', e);
    }
  }

  function getStatus(deviceId: string, code: string): boolean {
    return devices.find((d) => d.id === deviceId)
      ?.status?.find((s) => s.code === code)?.value === true;
  }

  async function handleToggle(deviceId: string, code: string) {
    const key = `${deviceId}:${code}`;
    const current = getStatus(deviceId, code);
    setDevices((prev) =>
      prev.map((d) =>
        d.id === deviceId
          ? { ...d, status: d.status.map((s) => s.code === code ? { ...s, value: !current } : s) }
          : d
      )
    );
    setPendingToggles((prev) => new Set([...prev, key]));
    try {
      await sendDeviceCommand(deviceId, [{ code, value: !current }]);
    } catch (e) {
      setDevices((prev) =>
        prev.map((d) =>
          d.id === deviceId
            ? { ...d, status: d.status.map((s) => s.code === code ? { ...s, value: current } : s) }
            : d
        )
      );
      console.error('Toggle failed:', e);
    } finally {
      setPendingToggles((prev) => { const n = new Set(prev); n.delete(key); return n; });
    }
  }

  // ── render ─────────────────────────────────────────────

  const sala = MOCK_ROOMS.find((r) => r.name === 'Sala');

  return (
    <>
      <div className="p-4 sm:p-6 min-h-screen" style={{ background: pageBg }}>
        <div className="max-w-5xl mx-auto">

          {/* Topbar */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold" style={{ color: textMain }}>Visão geral</h1>
              <p className="text-sm mt-0.5" style={{ color: textMuted }}>
                {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                {' · '}
                {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <button
              onClick={toggle}
              className="p-2 rounded-xl border transition-colors"
              style={{ background: cardBg, borderColor: cardBorder, color: textMuted }}
              aria-label="Toggle tema"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64" style={{ color: textMuted }}>
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm">Carregando dispositivos…</p>
              </div>
            </div>
          ) : (
            <>
              {/* ── 5 métricas ── */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
                <MetricCard
                  icon={isDoorOpen ? <DoorOpen size={16} /> : <DoorClosed size={16} />}
                  label="Porta principal"
                  value={isDoorOpen ? 'Aberta' : 'Trancada'}
                  accent={isDoorOpen ? '#EF4444' : '#1D9E75'}
                  cardBg={cardBg} cardBorder={cardBorder} textMuted={textMuted}
                />
                <MetricCard
                  icon={<Lightbulb size={16} />}
                  label="Luzes ligadas"
                  value={`${lightsOnCount} de ${totalChannels}`}
                  accent={lightsOnCount > 0 ? '#F59E0B' : '#1D9E75'}
                  cardBg={cardBg} cardBorder={cardBorder} textMuted={textMuted}
                />
                <MetricCard
                  icon={<Thermometer size={16} />}
                  label="Temperatura sala"
                  value={sala ? `${sala.temp.toFixed(1)}°C` : '—'}
                  accent={sala ? tempColor(sala.temp) : textMuted}
                  cardBg={cardBg} cardBorder={cardBorder} textMuted={textMuted}
                />
                <MetricCard
                  icon={hub?.online ? <Wifi size={16} /> : <WifiOff size={16} />}
                  label="Hub Zigbee"
                  value={hub?.online ? 'Online' : hub ? 'Offline' : '—'}
                  accent={hub?.online ? '#1D9E75' : '#EF4444'}
                  cardBg={cardBg} cardBorder={cardBorder} textMuted={textMuted}
                />
                <MetricCard
                  icon={<Music size={16} />}
                  label="Tocando agora"
                  value="Ver sidebar"
                  accent={textMuted}
                  cardBg={cardBg} cardBorder={cardBorder} textMuted={textMuted}
                />
              </div>

              {/* ── WeatherCard full-width ── */}
              <div className="mb-4">
                <WeatherCard isDark={isDark} cardBg={cardBg} cardBorder={cardBorder} textMain={textMain} textMuted={textMuted} />
              </div>

              {/* ── Grid principal 2-col ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

                {/* Porta Principal (LockCard) */}
                <div className="rounded-[14px] border p-5" style={{ background: cardBg, borderColor: cardBorder }}>
                  <h2 className="text-sm font-semibold mb-4" style={{ color: textMain }}>Porta Principal</h2>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                      {isDoorOpen ? <DoorOpen size={20} color="#EF4444" /> : <DoorClosed size={20} color="#1D9E75" />}
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: isDoorOpen ? 'rgba(239,68,68,0.15)' : 'rgba(29,158,117,0.15)', color: isDoorOpen ? '#EF4444' : '#1D9E75' }}>
                      {isDoorOpen ? 'ABERTA' : 'TRANCADA'}
                    </span>
                  </div>
                  <div className="mt-auto pt-3 border-t" style={{ borderColor: cardBorder }}>
                    <Link
                      href="/history"
                      className="flex items-center justify-end gap-1 text-xs transition-opacity hover:opacity-70"
                      style={{ color: textMuted }}
                    >
                      Ver histórico completo
                      <ChevronRight size={13} />
                    </Link>
                  </div>
                </div>

                {/* Interruptores (SwitchCard) */}
                <SwitchCard
                  isDark={isDark}
                  textMain={textMain}
                  textMuted={textMuted}
                  cardBg={cardBg}
                  cardBorder={cardBorder}
                  lightsOnCount={lightsOnCount}
                  getStatus={getStatus}
                  handleToggle={handleToggle}
                  pendingToggles={pendingToggles}
                  getLabel={getLabel}
                  onSaveLabel={handleSaveLabel}
                />
              </div>

            </>
          )}
        </div>
      </div>

      {showAllSwitches && (
        <AllSwitchesModal
          switchDevices={switchDevices} isDark={isDark}
          textMain={textMain} textMuted={textMuted}
          cardBg={cardBg} cardBorder={cardBorder}
          getStatus={getStatus} handleToggle={handleToggle}
          pendingToggles={pendingToggles}
          getLabel={getLabel} onSaveLabel={handleSaveLabel}
          onClose={() => setShowAllSwitches(false)}
        />
      )}
    </>
  );
}
