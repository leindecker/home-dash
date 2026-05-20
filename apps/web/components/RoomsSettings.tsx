'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Plus, Trash2, X, Check,
  Home, Sofa, UtensilsCrossed, BedDouble, Laptop,
  Sun, Building2, Droplets, Car, TreePine, ArrowUpDown, LayoutGrid,
} from 'lucide-react';
import { useTokens } from '@/lib/theme';

// ─── Types ──────────────────────────────────────────────────

interface RoomSwitch {
  id: string;
  deviceId: string;
  code: string;
  label: string;
}

interface Room {
  id: string;
  name: string;
  icon: string;
  order: number;
  switches: RoomSwitch[];
}

interface UnassignedSwitch {
  deviceId: string;
  deviceName: string;
  code: string;
  label: string;
}

// ─── Icon registry ───────────────────────────────────────────

const ICON_OPTIONS = [
  { name: 'ti-home', label: 'Casa', icon: Home },
  { name: 'ti-sofa', label: 'Sala', icon: Sofa },
  { name: 'ti-tool-kitchen-2', label: 'Cozinha', icon: UtensilsCrossed },
  { name: 'ti-bed', label: 'Quarto', icon: BedDouble },
  { name: 'ti-device-laptop', label: 'Escritório', icon: Laptop },
  { name: 'ti-road', label: 'Área ext.', icon: Sun },
  { name: 'ti-building', label: 'Prédio', icon: Building2 },
  { name: 'ti-bath', label: 'Banheiro', icon: Droplets },
  { name: 'ti-car-garage', label: 'Garagem', icon: Car },
  { name: 'ti-armchair', label: 'Varanda', icon: LayoutGrid },
  { name: 'ti-garden-cart', label: 'Jardim', icon: TreePine },
  { name: 'ti-stairs', label: 'Escada', icon: ArrowUpDown },
];

function getIcon(name: string) {
  return ICON_OPTIONS.find((o) => o.name === name)?.icon ?? Home;
}

// ─── Icon picker popover ─────────────────────────────────────

function IconPicker({
  current,
  cardBg,
  cardBorder,
  onSelect,
  onClose,
}: {
  current: string;
  cardBg: string;
  cardBorder: string;
  onSelect: (name: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 top-full left-0 mt-1 p-2 rounded-xl border shadow-lg grid grid-cols-4 gap-1"
      style={{ background: cardBg, borderColor: cardBorder, minWidth: 180 }}
    >
      {ICON_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const selected = opt.name === current;
        return (
          <button
            key={opt.name}
            title={opt.label}
            onClick={() => { onSelect(opt.name); onClose(); }}
            className="flex flex-col items-center gap-1 p-2 rounded-lg transition-colors"
            style={{
              background: selected ? '#0D2A20' : 'transparent',
              color: selected ? '#34D399' : '#71717a',
            }}
          >
            <Icon size={16} />
            <span className="text-[9px] leading-none">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Switch selection modal ──────────────────────────────────

function SwitchSelectModal({
  room,
  unassigned,
  cardBg,
  cardBorder,
  textMain,
  textMuted,
  onConfirm,
  onClose,
}: {
  room: Room;
  unassigned: UnassignedSwitch[];
  cardBg: string;
  cardBorder: string;
  textMain: string;
  textMuted: string;
  onConfirm: (selected: UnassignedSwitch[]) => Promise<void>;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  function toggleSelect(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function handleConfirm() {
    setSaving(true);
    const items = unassigned.filter((s) => selected.has(`${s.deviceId}:${s.code}`));
    await onConfirm(items);
    setSaving(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-[14px] border flex flex-col"
        style={{ background: cardBg, borderColor: cardBorder, maxWidth: 360, maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: cardBorder }}>
          <h3 className="text-sm font-semibold" style={{ color: textMain }}>Selecionar interruptores</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70" style={{ color: textMuted }}>
            <X size={15} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-3 space-y-1.5">
          {unassigned.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: textMuted }}>
              Todos os interruptores já estão vinculados
            </p>
          ) : (
            unassigned.map((sw) => {
              const key = `${sw.deviceId}:${sw.code}`;
              const isSelected = selected.has(key);
              return (
                <button
                  key={key}
                  onClick={() => toggleSelect(key)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
                  style={{
                    background: isSelected ? '#0D2A20' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isSelected ? '#1D9E75' : 'transparent'}`,
                  }}
                >
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                    style={{ background: isSelected ? '#1D9E75' : 'rgba(255,255,255,0.1)' }}
                  >
                    {isSelected && <Check size={10} style={{ color: '#fff' }} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: isSelected ? '#34D399' : textMain }}>
                      {sw.label}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: textMuted }}>
                      {sw.deviceName} · {sw.code}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t flex-shrink-0" style={{ borderColor: cardBorder }}>
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl text-xs border transition-opacity hover:opacity-70"
            style={{ borderColor: cardBorder, color: textMuted }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0 || saving}
            className="flex-1 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: '#1D9E75', color: '#fff' }}
          >
            {saving ? 'Salvando…' : `Confirmar (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Room selection modal (for linking from unassigned) ──────

function RoomSelectModal({
  sw,
  rooms,
  cardBg,
  cardBorder,
  textMain,
  textMuted,
  onSelect,
  onClose,
}: {
  sw: UnassignedSwitch;
  rooms: Room[];
  cardBg: string;
  cardBorder: string;
  textMain: string;
  textMuted: string;
  onSelect: (roomId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  async function handleSelect(roomId: string) {
    setSaving(true);
    await onSelect(roomId);
    setSaving(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-[14px] border flex flex-col"
        style={{ background: cardBg, borderColor: cardBorder, maxWidth: 360, maxHeight: '70vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: cardBorder }}>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: textMain }}>Vincular a um cômodo</h3>
            <p className="text-[11px] mt-0.5" style={{ color: textMuted }}>
              {sw.label} · {sw.deviceName}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70" style={{ color: textMuted }}>
            <X size={15} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-3 space-y-1.5">
          {rooms.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: textMuted }}>Nenhum cômodo cadastrado</p>
          ) : (
            rooms.map((room) => {
              const Icon = getIcon(room.icon);
              return (
                <button
                  key={room.id}
                  onClick={() => handleSelect(room.id)}
                  disabled={saving}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors hover:opacity-80 disabled:opacity-40"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                >
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#0D2A20' }}>
                    <Icon size={15} style={{ color: '#34D399' }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: textMain }}>{room.name}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Room card (left column) ─────────────────────────────────

function RoomCard({
  room,
  cardBg,
  cardBorder,
  textMain,
  textMuted,
  onUpdate,
  onDelete,
  onAddSwitches,
  onRemoveSwitch,
}: {
  room: Room;
  cardBg: string;
  cardBorder: string;
  textMain: string;
  textMuted: string;
  onUpdate: (id: string, data: { name?: string; icon?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddSwitches: (room: Room) => void;
  onRemoveSwitch: (roomId: string, deviceId: string, code: string) => Promise<void>;
}) {
  const [name, setName] = useState(room.name);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { setName(room.name); }, [room.name]);

  async function handleNameBlur() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== room.name) await onUpdate(room.id, { name: trimmed });
    else setName(room.name);
  }

  async function handleIconSelect(iconName: string) {
    await onUpdate(room.id, { icon: iconName });
  }

  async function handleDelete() {
    if (!confirm(`Remover o cômodo "${room.name}"?`)) return;
    setDeleting(true);
    await onDelete(room.id);
  }

  const Icon = getIcon(room.icon);

  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: cardBg, borderColor: cardBorder }}
    >
      {/* Header: icon + name + delete */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowIconPicker((v) => !v)}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-opacity hover:opacity-70"
            style={{ background: '#0D2A20' }}
            title="Trocar ícone"
          >
            <Icon size={16} style={{ color: '#34D399' }} />
          </button>
          {showIconPicker && (
            <IconPicker
              current={room.icon}
              cardBg={cardBg}
              cardBorder={cardBorder}
              onSelect={handleIconSelect}
              onClose={() => setShowIconPicker(false)}
            />
          )}
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleNameBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          maxLength={30}
          className="flex-1 min-w-0 text-sm font-semibold bg-transparent outline-none border-b border-transparent focus:border-zinc-600 transition-colors"
          style={{ color: textMain }}
        />

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-1.5 rounded-lg transition-opacity hover:opacity-70 disabled:opacity-30 flex-shrink-0"
          style={{ color: '#F87171' }}
          title="Remover cômodo"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Switches */}
      <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: textMuted }}>
        Interruptores vinculados
      </p>

      {room.switches.length === 0 ? (
        <p className="text-xs mb-2" style={{ color: textMuted }}>Nenhum vinculado</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {room.switches.map((sw) => (
            <span
              key={`${sw.deviceId}:${sw.code}`}
              className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md"
              style={{ background: '#0D2A20', border: '1px solid #1D9E75', color: '#34D399' }}
            >
              {sw.label}
              <button
                onClick={() => onRemoveSwitch(room.id, sw.deviceId, sw.code)}
                className="hover:opacity-70 transition-opacity"
                style={{ color: '#34D399' }}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      <button
        onClick={() => onAddSwitches(room)}
        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-opacity hover:opacity-70"
        style={{ background: 'rgba(29,158,117,0.1)', color: '#34D399' }}
      >
        <Plus size={12} />
        Adicionar
      </button>
    </div>
  );
}

// ─── RoomsSettings ───────────────────────────────────────────

export default function RoomsSettings() {
  const { cardBg, cardBorder, textMain, textMuted } = useTokens();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [unassigned, setUnassigned] = useState<UnassignedSwitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [addSwitchesRoom, setAddSwitchesRoom] = useState<Room | null>(null);
  const [linkSwitchItem, setLinkSwitchItem] = useState<UnassignedSwitch | null>(null);
  const newNameRef = useRef<HTMLInputElement>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/rooms'),
        fetch('/api/rooms/unassigned'),
      ]);
      setRooms(r1.ok ? await r1.json() : []);
      setUnassigned(r2.ok ? await r2.json() : []);
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { loadData(); }, []);

  async function handleCreateRoom() {
    const name = newName.trim();
    if (!name) return;
    setCreatingRoom(true);
    try {
      await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icon: 'ti-home', order: rooms.length }),
      });
      setNewName('');
      await loadData();
    } finally { setCreatingRoom(false); }
  }

  async function handleUpdate(id: string, data: { name?: string; icon?: string }) {
    await fetch(`/api/rooms/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await loadData();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/rooms/${id}`, { method: 'DELETE' });
    await loadData();
  }

  async function handleAddSwitches(room: Room, switches: UnassignedSwitch[]) {
    await Promise.all(
      switches.map((sw) =>
        fetch(`/api/rooms/${room.id}/switches`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: sw.deviceId, code: sw.code, label: sw.label }),
        })
      )
    );
    await loadData();
  }

  async function handleRemoveSwitch(roomId: string, deviceId: string, code: string) {
    await fetch(`/api/rooms/${roomId}/switches/${deviceId}/${code}`, { method: 'DELETE' });
    await loadData();
  }

  async function handleLinkToRoom(roomId: string, sw: UnassignedSwitch) {
    await fetch(`/api/rooms/${roomId}/switches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: sw.deviceId, code: sw.code, label: sw.label }),
    });
    await loadData();
  }

  return (
    <>
      <div className="rounded-2xl border overflow-hidden" style={{ background: cardBg, borderColor: cardBorder }}>
        {/* Section header */}
        <div className="px-5 py-4 border-b" style={{ borderColor: cardBorder }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
            Cômodos &amp; Interruptores
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <span
              className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: '#34D399', borderTopColor: 'transparent' }}
            />
          </div>
        ) : (
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* ── Left column: configured rooms ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold" style={{ color: textMuted }}>
                    Cômodos configurados
                  </p>
                </div>

                {/* New room input */}
                <div className="flex gap-2 mb-4">
                  <input
                    ref={newNameRef}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateRoom(); }}
                    placeholder="Nome do novo cômodo…"
                    className="flex-1 min-w-0 rounded-xl border px-3 py-2 text-xs outline-none transition-colors"
                    style={{ background: '#13151F', borderColor: cardBorder, color: '#fff' }}
                  />
                  <button
                    onClick={handleCreateRoom}
                    disabled={!newName.trim() || creatingRoom}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-40 flex-shrink-0"
                    style={{ background: '#1D9E75', color: '#fff' }}
                  >
                    <Plus size={13} />
                    Criar
                  </button>
                </div>

                {rooms.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: textMuted }}>
                    Nenhum cômodo criado ainda
                  </p>
                ) : (
                  <div className="space-y-3">
                    {rooms.map((room) => (
                      <RoomCard
                        key={room.id}
                        room={room}
                        cardBg={cardBg}
                        cardBorder={cardBorder}
                        textMain={textMain}
                        textMuted={textMuted}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                        onAddSwitches={setAddSwitchesRoom}
                        onRemoveSwitch={handleRemoveSwitch}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* ── Right column: unassigned switches ── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xs font-semibold" style={{ color: textMuted }}>
                    Interruptores não vinculados
                  </p>
                  {unassigned.length > 0 && (
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ background: '#0D2A20', color: '#34D399' }}
                    >
                      {unassigned.length}
                    </span>
                  )}
                </div>

                {unassigned.length === 0 ? (
                  <div className="rounded-xl border p-5 text-center" style={{ borderColor: cardBorder }}>
                    <p className="text-sm" style={{ color: '#34D399' }}>
                      Todos os interruptores estão vinculados ✅
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {unassigned.map((sw) => (
                      <div
                        key={`${sw.deviceId}:${sw.code}`}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.04)' }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate" style={{ color: textMain }}>
                            {sw.label}
                          </p>
                          <p className="text-[11px] truncate" style={{ color: textMuted }}>
                            {sw.deviceName} · {sw.code}
                          </p>
                        </div>
                        <button
                          onClick={() => setLinkSwitchItem(sw)}
                          disabled={rooms.length === 0}
                          className="text-[11px] font-medium px-2.5 py-1 rounded-lg flex-shrink-0 transition-opacity hover:opacity-70 disabled:opacity-30"
                          style={{ background: '#0D2A20', color: '#34D399' }}
                        >
                          Vincular
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: add switches to a room */}
      {addSwitchesRoom && (
        <SwitchSelectModal
          room={addSwitchesRoom}
          unassigned={unassigned}
          cardBg={cardBg}
          cardBorder={cardBorder}
          textMain={textMain}
          textMuted={textMuted}
          onConfirm={(items) => handleAddSwitches(addSwitchesRoom, items)}
          onClose={() => setAddSwitchesRoom(null)}
        />
      )}

      {/* Modal: choose room for an unassigned switch */}
      {linkSwitchItem && (
        <RoomSelectModal
          sw={linkSwitchItem}
          rooms={rooms}
          cardBg={cardBg}
          cardBorder={cardBorder}
          textMain={textMain}
          textMuted={textMuted}
          onSelect={(roomId) => handleLinkToRoom(roomId, linkSwitchItem)}
          onClose={() => setLinkSwitchItem(null)}
        />
      )}
    </>
  );
}