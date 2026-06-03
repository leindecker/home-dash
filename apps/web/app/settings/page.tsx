'use client';

import { useEffect, useState, ReactNode } from 'react';
import {
  LayoutGrid, Plus, Check, ShieldCheck, Shield, Moon, Sun,
  ChevronRight, Wifi, Music, Cloud, Mic, X, Trash2, QrCode,
  Home, Sofa, UtensilsCrossed, BedDouble, Laptop,
  Building2, Droplets, Car, TreePine, ArrowUpDown,
} from 'lucide-react';
import { useTokens, useTheme } from '@/lib/theme';
import {
  fetchDevices, fetchMe, setup2FA, confirm2FA, disable2FA,
  Device, UserProfile,
} from '@/lib/api';
import RoomsSettings from '@/components/RoomsSettings';

// ─── Types ───────────────────────────────────────────────────

interface RoomSwitch { id: string; deviceId: string; code: string; label: string; }
interface Room { id: string; name: string; icon: string; order: number; switches: RoomSwitch[]; }

// ─── Icon registry ────────────────────────────────────────────

const ICON_OPTIONS = [
  { name: 'ti-home',           icon: Home           },
  { name: 'ti-sofa',           icon: Sofa           },
  { name: 'ti-tool-kitchen-2', icon: UtensilsCrossed },
  { name: 'ti-bed',            icon: BedDouble      },
  { name: 'ti-device-laptop',  icon: Laptop         },
  { name: 'ti-road',           icon: Sun            },
  { name: 'ti-building',       icon: Building2      },
  { name: 'ti-bath',           icon: Droplets       },
  { name: 'ti-car-garage',     icon: Car            },
  { name: 'ti-armchair',       icon: LayoutGrid     },
  { name: 'ti-garden-cart',    icon: TreePine       },
  { name: 'ti-stairs',         icon: ArrowUpDown    },
];
function getIcon(name: string) {
  return ICON_OPTIONS.find((o) => o.name === name)?.icon ?? Home;
}

// ─── Status check ─────────────────────────────────────────────

async function checkSpotify(): Promise<boolean> {
  const res = await fetch('/api/spotify/player').catch(() => null);
  return res != null && res.status !== 401 && res.status !== 500;
}

// ─── Shared primitives ────────────────────────────────────────

function Card({ children, cardBg, cardBorder }: { children: ReactNode; cardBg: string; cardBorder: string }) {
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: cardBg, borderColor: cardBorder }}>
      {children}
    </div>
  );
}

function SectionLabel({ label, cardBorder }: { label: string; cardBorder: string }) {
  return (
    <div className="px-5 py-3 border-b" style={{ borderColor: cardBorder }}>
      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#71717a' }}>
        {label}
      </p>
    </div>
  );
}

function Row({
  left, right, isLast = false, cardBorder,
}: {
  left: ReactNode; right: ReactNode; isLast?: boolean; cardBorder: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: isLast ? 'none' : `0.5px solid ${cardBorder}`,
    }}>
      {left}
      {right}
    </div>
  );
}

function StatusOk({ label }: { label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#1D9E75', flexShrink: 0 }}>
      <Check size={12} />{label}
    </span>
  );
}

function StatusErr({ label }: { label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#E24B4A', flexShrink: 0 }}>
      {label}
    </span>
  );
}

function IntegrationLeft({
  iconBg, iconColor, icon: Icon, name, sub,
}: {
  iconBg: string; iconColor: string; icon: React.ElementType; name: string; sub: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background: iconBg, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={15} style={{ color: iconColor }} />
      </div>
      <div>
        <p style={{ fontSize: 13, fontWeight: 500 }}>{name}</p>
        <p style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>{sub}</p>
      </div>
    </div>
  );
}

// ─── AllRoomsModal ────────────────────────────────────────────

function AllRoomsModal({
  rooms, cardBg, cardBorder, textMain, textMuted, onDelete, onRemoveSwitch, onClose,
}: {
  rooms: Room[];
  cardBg: string; cardBorder: string; textMain: string; textMuted: string;
  onDelete: (id: string) => Promise<void>;
  onRemoveSwitch: (roomId: string, deviceId: string, code: string) => Promise<void>;
  onClose: () => void;
}) {
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-[14px] border flex flex-col"
        style={{ background: cardBg, borderColor: cardBorder, maxWidth: 480, maxHeight: '82vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: cardBorder }}>
          <h3 className="text-sm font-semibold" style={{ color: textMain }}>Todos os cômodos</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70 transition-opacity" style={{ color: textMuted }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-2">
          {rooms.length === 0 ? (
            <p className="text-sm text-center py-10" style={{ color: textMuted }}>Nenhum cômodo cadastrado</p>
          ) : (
            rooms.map((room, i) => {
              const Icon = getIcon(room.icon);
              return (
                <div
                  key={room.id}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '12px 0',
                    borderBottom: i < rooms.length - 1 ? `0.5px solid ${cardBorder}` : 'none',
                  }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: '#0D2A20', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                    <Icon size={15} style={{ color: '#34D399' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: textMain, marginBottom: 6 }}>
                      {room.name}
                      <span style={{ fontSize: 11, fontWeight: 400, color: textMuted, marginLeft: 8 }}>
                        {room.switches.length} {room.switches.length === 1 ? 'interruptor' : 'interruptores'}
                      </span>
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {room.switches.length === 0 ? (
                        <span style={{ fontSize: 11, color: textMuted }}>Sem interruptores</span>
                      ) : (
                        room.switches.map((sw) => (
                          <span
                            key={`${sw.deviceId}:${sw.code}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 6, background: '#0D2A20', border: '1px solid #1D9E75', color: '#34D399' }}
                          >
                            {sw.label}
                            <button
                              onClick={() => onRemoveSwitch(room.id, sw.deviceId, sw.code)}
                              className="hover:opacity-70 transition-opacity leading-none"
                              style={{ color: '#34D399' }}
                            >
                              <X size={9} />
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onDelete(room.id)}
                    className="p-1.5 rounded-lg hover:opacity-70 transition-opacity flex-shrink-0"
                    style={{ color: '#E24B4A' }}
                    title="Remover cômodo"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t flex-shrink-0" style={{ borderColor: cardBorder }}>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-medium border transition-opacity hover:opacity-70"
            style={{ borderColor: cardBorder, color: textMuted }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CreateRoomModal ──────────────────────────────────────────

function CreateRoomModal({
  cardBg, cardBorder, textMain, textMuted, onConfirm, onClose,
}: {
  cardBg: string; cardBorder: string; textMain: string; textMuted: string;
  onConfirm: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    await onConfirm(trimmed);
    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-[14px] border"
        style={{ background: cardBg, borderColor: cardBorder, maxWidth: 360 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: cardBorder }}>
          <h3 className="text-sm font-semibold" style={{ color: textMain }}>Novo cômodo</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70" style={{ color: textMuted }}>
            <X size={15} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: textMuted }}>Nome</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              placeholder="Ex: Sala de estar"
              maxLength={30}
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ background: '#13151F', borderColor: cardBorder, color: '#fff' }}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-xl text-xs border transition-opacity hover:opacity-70"
              style={{ borderColor: cardBorder, color: textMuted }}
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim() || saving}
              className="flex-1 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ background: '#1D9E75', color: '#fff' }}
            >
              {saving ? 'Criando…' : 'Criar cômodo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ManageRoomsOverlay ───────────────────────────────────────
// Full-screen overlay with the complete RoomsSettings component
// for icon/name editing and switch management.

function ManageRoomsOverlay({
  cardBg, cardBorder, textMain, textMuted, onClose,
}: {
  cardBg: string; cardBorder: string; textMain: string; textMuted: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="relative mx-auto my-8"
        style={{ maxWidth: 760, padding: '0 1rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold" style={{ color: '#fff' }}>Gerenciar cômodos</p>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
            style={{ color: '#71717a' }}
          >
            <X size={16} />
          </button>
        </div>
        <RoomsSettings />
        <div style={{ height: '2rem' }} />
      </div>
    </div>
  );
}

// ─── TwoFAModal ───────────────────────────────────────────────

function TwoFAModal({
  cardBg, cardBorder, textMain, textMuted, onSuccess, onClose,
}: {
  cardBg: string; cardBorder: string; textMain: string; textMuted: string;
  onSuccess: () => void; onClose: () => void;
}) {
  const [qrImg, setQrImg] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const data = await setup2FA();
        const QRCode = (await import('qrcode')).default;
        const img = await QRCode.toDataURL(data.otpauthUrl, { width: 180, margin: 1 });
        setQrImg(img);
      } catch { setError('Erro ao iniciar configuração'); }
      finally { setReady(true); }
    }
    init();
  }, []);

  async function handleConfirm() {
    if (otpCode.length !== 6) { setError('Digite o código de 6 dígitos'); return; }
    setWorking(true); setError('');
    try {
      await confirm2FA(otpCode);
      onSuccess();
      onClose();
    } catch { setError('Código inválido'); }
    finally { setWorking(false); }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="w-full rounded-[14px] border"
        style={{ background: cardBg, borderColor: cardBorder, maxWidth: 340 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: cardBorder }}>
          <h3 className="text-sm font-semibold" style={{ color: textMain }}>Ativar verificação 2FA</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70" style={{ color: textMuted }}>
            <X size={15} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {!ready ? (
            <div className="flex justify-center py-6">
              <span className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: '#34D399', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <>
              <p className="text-xs text-center" style={{ color: textMuted }}>
                Escaneie com Google Authenticator ou Authy
              </p>
              {qrImg && (
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrImg} alt="QR Code 2FA" className="rounded-xl"
                    style={{ width: 160, height: 160, imageRendering: 'pixelated' }} />
                </div>
              )}
              <div>
                <label className="block text-xs mb-1" style={{ color: textMuted }}>Código de confirmação</label>
                <input
                  type="text" inputMode="numeric" maxLength={6} value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none text-center tracking-widest"
                  style={{ background: '#13151F', borderColor: cardBorder, color: '#fff' }}
                />
              </div>
              {error && <p className="text-xs text-center" style={{ color: '#E24B4A' }}>{error}</p>}
              <div className="flex gap-2">
                <button onClick={onClose}
                  className="flex-1 py-2 rounded-xl text-xs border transition-opacity hover:opacity-70"
                  style={{ borderColor: cardBorder, color: textMuted }}>
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={working || otpCode.length !== 6}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{ background: '#1D9E75', color: '#fff' }}
                >
                  {working ? 'Verificando…' : 'Confirmar'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function SettingsPage() {
  const { cardBg, cardBorder, textMain, textMuted, pageBg } = useTokens();
  const { isDark, toggle } = useTheme();

  // Rooms
  const [rooms, setRooms]             = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [showAllRooms, setShowAllRooms] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showManageRooms, setShowManageRooms] = useState(false);

  // Auth / profile
  const [profile, setProfile]           = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [show2FA, setShow2FA]           = useState(false);
  const [disabling2FA, setDisabling2FA] = useState(false);

  // Devices & integrations
  const [devices, setDevices]     = useState<Device[]>([]);
  const [spotifyStatus, setSpotifyStatus] = useState<'loading' | 'ok' | 'err'>('loading');

  // ── Data loading ────────────────────────────────────────────

  async function loadRooms() {
    setRoomsLoading(true);
    try {
      const res = await fetch('/api/rooms');
      setRooms(res.ok ? await res.json() : []);
    } catch { setRooms([]); }
    finally { setRoomsLoading(false); }
  }

  useEffect(() => {
    loadRooms();
    fetchMe().then(setProfile).catch(() => {}).finally(() => setProfileLoading(false));
    fetchDevices()
      .then((devs) => setDevices(devs.filter((d) => d.type !== 'hub')))
      .catch(() => {});
    checkSpotify()
      .then((ok) => setSpotifyStatus(ok ? 'ok' : 'err'))
      .catch(() => setSpotifyStatus('err'));
  }, []);

  // ── Room CRUD ───────────────────────────────────────────────

  async function handleCreateRoom(name: string) {
    await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, icon: 'ti-home', order: rooms.length }),
    });
    setShowCreateRoom(false);
    await loadRooms();
  }

  async function handleDeleteRoom(id: string) {
    if (!confirm('Remover este cômodo?')) return;
    await fetch(`/api/rooms/${id}`, { method: 'DELETE' });
    await loadRooms();
  }

  async function handleRemoveSwitch(roomId: string, deviceId: string, code: string) {
    await fetch(`/api/rooms/${roomId}/switches/${deviceId}/${code}`, { method: 'DELETE' });
    await loadRooms();
  }

  // ── 2FA ─────────────────────────────────────────────────────

  async function handleDisable2FA() {
    if (!confirm('Desativar a verificação em duas etapas?')) return;
    setDisabling2FA(true);
    try {
      await disable2FA();
      setProfile((p) => p ? { ...p, totpEnabled: false } : p);
    } catch {}
    finally { setDisabling2FA(false); }
  }

  // ── Derived ─────────────────────────────────────────────────

  const previewRooms = rooms.slice(0, 3);

  // ── Render ──────────────────────────────────────────────────

  return (
    <div style={{ padding: '1.5rem', minHeight: '100vh', background: pageBg }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* ── Header ─────────────────────────────────────── */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: 18, fontWeight: 500, color: textMain, margin: 0 }}>
            Configurações
          </h1>
          <p style={{ fontSize: 13, color: textMuted, margin: '4px 0 0' }}>
            Integrações e dispositivos
          </p>
        </div>

        {/* ── Seção 1: Cômodos (largura total) ───────────── */}
        <div style={{ marginBottom: '1rem' }}>
          <Card cardBg={cardBg} cardBorder={cardBorder}>
            {/* Card header */}
            <div
              className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: cardBorder }}
            >
              <div className="flex items-center gap-2">
                <LayoutGrid size={15} style={{ color: '#34D399' }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: textMain }}>
                  Cômodos configurados
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowAllRooms(false); setShowManageRooms(true); }}
                  className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-opacity hover:opacity-70"
                  style={{ borderColor: cardBorder, color: textMuted }}
                >
                  Gerenciar
                </button>
                <button
                  onClick={() => setShowCreateRoom(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                  style={{ background: '#1D9E75', color: '#fff' }}
                >
                  <Plus size={12} />
                  Novo
                </button>
              </div>
            </div>

            {/* Rooms preview list */}
            <div className="px-5 py-3">
              {roomsLoading ? (
                <div className="flex justify-center py-6">
                  <span className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: '#34D399', borderTopColor: 'transparent' }} />
                </div>
              ) : rooms.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: textMuted }}>
                  Nenhum cômodo criado ainda
                </p>
              ) : (
                <div>
                  {previewRooms.map((room, i) => {
                    const Icon = getIcon(room.icon);
                    return (
                      <div
                        key={room.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 0',
                          borderBottom: i < previewRooms.length - 1 ? `0.5px solid ${cardBorder}` : 'none',
                        }}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: 10,
                          background: '#0D2A20', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Icon size={15} style={{ color: '#34D399' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: textMain, margin: 0 }}>
                            {room.name}
                          </p>
                          <p style={{ fontSize: 11, color: textMuted, margin: '2px 0 0' }}>
                            {room.switches.length} {room.switches.length === 1 ? 'interruptor' : 'interruptores'}
                          </p>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end', maxWidth: '55%' }}>
                          {room.switches.map((sw) => (
                            <span
                              key={`${sw.deviceId}:${sw.code}`}
                              style={{
                                fontSize: 11, fontWeight: 500,
                                padding: '2px 8px', borderRadius: 6,
                                background: '#0D2A20', border: '1px solid #1D9E75', color: '#34D399',
                              }}
                            >
                              {sw.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Ver todos button */}
              {rooms.length > 0 && (
                <button
                  onClick={() => setShowAllRooms(true)}
                  className="w-full mt-3 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
                  style={{ border: `1px dashed ${cardBorder}`, color: textMuted, background: 'transparent' }}
                >
                  Ver todos os cômodos ({rooms.length} no total)
                </button>
              )}
            </div>
          </Card>
        </div>

        {/* ── Seção 2: Segurança + Aparência ─────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

          {/* Card Segurança */}
          <Card cardBg={cardBg} cardBorder={cardBorder}>
            <SectionLabel label="Segurança" cardBorder={cardBorder} />
            <div className="px-5 py-2">

              {/* Row: Google Login */}
              <Row
                cardBorder={cardBorder}
                left={
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: textMain }}>Login com Google</p>
                    <p style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
                      {profileLoading ? '…' : (profile?.email ?? '—')}
                    </p>
                  </div>
                }
                right={<StatusOk label="Ativo" />}
              />

              {/* Row: 2FA */}
              <Row
                cardBorder={cardBorder}
                left={
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: textMain }}>Verificação em duas etapas</p>
                    <p style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
                      {profile?.totpEnabled ? '2FA do Google ativo' : 'Adiciona uma camada extra de segurança'}
                    </p>
                  </div>
                }
                right={
                  profileLoading ? (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin inline-block"
                      style={{ borderColor: textMuted, borderTopColor: 'transparent' }} />
                  ) : profile?.totpEnabled ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#1D9E75' }}>
                        <ShieldCheck size={12} />Protegido
                      </span>
                      <button
                        onClick={handleDisable2FA}
                        disabled={disabling2FA}
                        className="text-[10px] px-2 py-0.5 rounded border transition-opacity hover:opacity-70 disabled:opacity-40"
                        style={{ borderColor: cardBorder, color: textMuted }}
                      >
                        Desativar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShow2FA(true)}
                      className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg transition-opacity hover:opacity-80"
                      style={{ background: '#0D1829', color: '#60A5FA' }}
                    >
                      <QrCode size={11} />
                      Ativar 2FA
                    </button>
                  )
                }
              />

              {/* Row: Acesso restrito */}
              <Row
                cardBorder={cardBorder}
                isLast
                left={
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: textMain }}>Acesso restrito</p>
                    <p style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>Apenas 1 email autorizado</p>
                  </div>
                }
                right={
                  /* Visual-only toggle — on */
                  <div style={{
                    width: 36, height: 20, borderRadius: 10,
                    background: '#1D9E75',
                    display: 'flex', alignItems: 'center',
                    padding: '0 3px', flexShrink: 0,
                  }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', marginLeft: 'auto' }} />
                  </div>
                }
              />
            </div>
          </Card>

          {/* Card Aparência */}
          <Card cardBg={cardBg} cardBorder={cardBorder}>
            <SectionLabel label="Aparência" cardBorder={cardBorder} />
            <div className="px-5 py-2">

              {/* Row: Tema */}
              <Row
                cardBorder={cardBorder}
                left={
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: textMain }}>Tema</p>
                    <p style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
                      {isDark ? 'Modo escuro ativo' : 'Modo claro ativo'}
                    </p>
                  </div>
                }
                right={
                  <button
                    onClick={toggle}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all hover:opacity-70"
                    style={{ borderColor: cardBorder, color: textMain, background: isDark ? '#1A1D27' : '#f1f5f9' }}
                  >
                    {isDark ? <Moon size={13} /> : <Sun size={13} />}
                    {isDark ? 'Escuro' : 'Claro'}
                  </button>
                }
              />

              {/* Row: Idioma */}
              <Row
                cardBorder={cardBorder}
                isLast
                left={
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: textMain }}>Idioma</p>
                    <p style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>Interface em português</p>
                  </div>
                }
                right={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: textMuted, fontSize: 12 }}>
                    PT-BR <ChevronRight size={13} />
                  </div>
                }
              />
            </div>
          </Card>
        </div>

        {/* ── Seção 3: Integrações ────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Card Integrações 1: Tuya + Spotify */}
          <Card cardBg={cardBg} cardBorder={cardBorder}>
            <SectionLabel label="Integrações" cardBorder={cardBorder} />
            <div className="px-5 py-2">

              {/* Row: Tuya */}
              <Row
                cardBorder={cardBorder}
                left={
                  <IntegrationLeft
                    iconBg="#0D2A20" iconColor="#34D399" icon={Wifi}
                    name="Tuya Cloud"
                    sub={`${devices.length} dispositivos`}
                  />
                }
                right={<StatusOk label="Conectado" />}
              />

              {/* Row: Spotify */}
              <Row
                cardBorder={cardBorder}
                isLast
                left={
                  <IntegrationLeft
                    iconBg="#0D2A1A" iconColor="#1DB954" icon={Music}
                    name="Spotify"
                    sub={spotifyStatus === 'ok' ? 'Conta vinculada' : 'Não conectado'}
                  />
                }
                right={
                  spotifyStatus === 'loading' ? (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin inline-block"
                      style={{ borderColor: textMuted, borderTopColor: 'transparent' }} />
                  ) : spotifyStatus === 'ok' ? (
                    <StatusOk label="Conectado" />
                  ) : (
                    <button
                      className="text-[11px] font-semibold px-3 py-1 rounded-lg transition-opacity hover:opacity-80"
                      style={{ background: '#1DB954', color: '#fff' }}
                    >
                      Conectar
                    </button>
                  )
                }
              />
            </div>
          </Card>

          {/* Card Integrações 2: OWM + Alexa */}
          <Card cardBg={cardBg} cardBorder={cardBorder}>
            <SectionLabel label="Integrações" cardBorder={cardBorder} />
            <div className="px-5 py-2">

              {/* Row: OpenWeatherMap */}
              <Row
                cardBorder={cardBorder}
                left={
                  <IntegrationLeft
                    iconBg="#0D1829" iconColor="#60A5FA" icon={Cloud}
                    name="OpenWeatherMap"
                    sub="São José, SC"
                  />
                }
                right={<StatusOk label="Ativo" />}
              />

              {/* Row: Amazon Alexa */}
              <Row
                cardBorder={cardBorder}
                isLast
                left={
                  <IntegrationLeft
                    iconBg="#1A0D2A" iconColor="#A78BFA" icon={Mic}
                    name="Amazon Alexa"
                    sub="Controle por voz"
                  />
                }
                right={<StatusErr label="Offline" />}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────── */}

      {showAllRooms && (
        <AllRoomsModal
          rooms={rooms}
          cardBg={cardBg} cardBorder={cardBorder}
          textMain={textMain} textMuted={textMuted}
          onDelete={handleDeleteRoom}
          onRemoveSwitch={handleRemoveSwitch}
          onClose={() => setShowAllRooms(false)}
        />
      )}

      {showCreateRoom && (
        <CreateRoomModal
          cardBg={cardBg} cardBorder={cardBorder}
          textMain={textMain} textMuted={textMuted}
          onConfirm={handleCreateRoom}
          onClose={() => setShowCreateRoom(false)}
        />
      )}

      {showManageRooms && (
        <ManageRoomsOverlay
          cardBg={cardBg} cardBorder={cardBorder}
          textMain={textMain} textMuted={textMuted}
          onClose={() => { setShowManageRooms(false); loadRooms(); }}
        />
      )}

      {show2FA && (
        <TwoFAModal
          cardBg={cardBg} cardBorder={cardBorder}
          textMain={textMain} textMuted={textMuted}
          onSuccess={() => setProfile((p) => p ? { ...p, totpEnabled: true } : p)}
          onClose={() => setShow2FA(false)}
        />
      )}
    </div>
  );
}