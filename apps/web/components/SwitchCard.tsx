'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ChevronRight, Lightbulb, Pencil, X, LayoutGrid,
  Home, Sofa, UtensilsCrossed, BedDouble, Laptop,
  Sun, Building2, Droplets, Car, TreePine, ArrowUpDown,
} from 'lucide-react';
import { useRooms, Room, RoomSwitch } from '@/hooks/useRooms';

// ─── Icon map ────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  'ti-home': Home, home: Home,
  'ti-sofa': Sofa, sofa: Sofa,
  'ti-tool-kitchen-2': UtensilsCrossed, kitchen: UtensilsCrossed,
  'ti-bed': BedDouble, bedroom: BedDouble,
  'ti-device-laptop': Laptop, office: Laptop,
  'ti-road': Sun, outdoor: Sun,
  'ti-building': Building2, building: Building2,
  'ti-bath': Droplets, bath: Droplets,
  'ti-car-garage': Car, garage: Car,
  'ti-armchair': LayoutGrid, armchair: LayoutGrid,
  'ti-garden-cart': TreePine, garden: TreePine,
  'ti-stairs': ArrowUpDown, stairs: ArrowUpDown,
};

function RoomIconCircle({ icon, anyOn }: { icon: string; anyOn: boolean }) {
  const Icon = ICON_MAP[icon] ?? Home;
  return (
    <div
      className="w-[26px] h-[26px] rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: anyOn ? '#0D2A20' : 'rgba(113,113,122,0.2)' }}
    >
      <Icon size={13} style={{ color: anyOn ? '#34D399' : '#71717a' }} />
    </div>
  );
}

// ─── Toggle ──────────────────────────────────────────────────

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

// ─── Switch row within a room ────────────────────────────────

function RoomSwitchRow({
  sw, isDark, textMain, textMuted,
  getStatus, handleToggle, pendingToggles, getLabel, onSaveLabel,
}: {
  sw: RoomSwitch;
  isDark: boolean;
  textMain: string;
  textMuted: string;
  getStatus: (deviceId: string, code: string) => boolean;
  handleToggle: (deviceId: string, code: string) => void;
  pendingToggles: Set<string>;
  getLabel: (deviceId: string, code: string) => string;
  onSaveLabel: (deviceId: string, code: string, newLabel: string) => Promise<void>;
}) {
  const isOn = getStatus(sw.deviceId, sw.code);
  const isPending = pendingToggles.has(`${sw.deviceId}:${sw.code}`);
  const label = getLabel(sw.deviceId, sw.code);

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!editing) setEditValue(label); }, [label, editing]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  async function saveEdit() {
    const trimmed = editValue.trim();
    setEditing(false);
    if (trimmed && trimmed !== label) await onSaveLabel(sw.deviceId, sw.code, trimmed);
  }

  return (
    <div
      className="group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-200"
      style={{ background: isOn && !editing ? '#0D2A20' : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
    >
      <Lightbulb size={13} className="flex-shrink-0" style={{ color: isOn ? '#34D399' : textMuted }} />

      {editing ? (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <input
            ref={inputRef} autoFocus type="text" value={editValue} maxLength={20}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
              if (e.key === 'Escape') setEditing(false);
            }}
            onBlur={saveEdit}
            className="flex-1 min-w-0 text-xs bg-transparent outline-none border-b border-zinc-600 focus:border-[#1D9E75] transition-colors pb-px"
            style={{ color: textMain }}
          />
          <button onClick={() => setEditing(false)} style={{ color: textMuted }}>
            <X size={11} />
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <span
              className="text-[11px] font-semibold uppercase tracking-wide truncate"
              style={{ color: isOn ? '#34D399' : textMuted }}
            >
              {label}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); setEditValue(label); setEditing(true); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded flex-shrink-0"
              style={{ color: textMuted }}
            >
              <Pencil size={10} />
            </button>
          </div>
          <Toggle checked={isOn} onChange={() => handleToggle(sw.deviceId, sw.code)} disabled={isPending} />
        </>
      )}
    </div>
  );
}

// ─── Collapsible room section ────────────────────────────────

function RoomSection({
  room, index, isDark, textMain, textMuted, cardBorder,
  getStatus, handleToggle, pendingToggles, getLabel, onSaveLabel,
}: {
  room: Room;
  index: number;
  isDark: boolean;
  textMain: string;
  textMuted: string;
  cardBorder: string;
  getStatus: (deviceId: string, code: string) => boolean;
  handleToggle: (deviceId: string, code: string) => void;
  pendingToggles: Set<string>;
  getLabel: (deviceId: string, code: string) => string;
  onSaveLabel: (deviceId: string, code: string, newLabel: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(index === 0);

  const onCount = room.switches.filter((sw) => getStatus(sw.deviceId, sw.code)).length;
  const anyOn = onCount > 0;

  function handleToggleAll(e: React.MouseEvent) {
    e.stopPropagation();
    const target = !anyOn;
    room.switches.forEach((sw) => {
      if (getStatus(sw.deviceId, sw.code) !== target) handleToggle(sw.deviceId, sw.code);
    });
  }

  return (
    <div>
      <button
        className="w-full flex items-center gap-2.5 py-2.5 text-left transition-opacity hover:opacity-80"
        onClick={() => setExpanded((v) => !v)}
      >
        <RoomIconCircle icon={room.icon} anyOn={anyOn} />
        <span className="flex-1 min-w-0 text-[13px] font-semibold truncate" style={{ color: textMain }}>
          {room.name}
        </span>
        <span className="text-[11px] flex-shrink-0" style={{ color: anyOn ? '#34D399' : textMuted }}>
          {anyOn ? `${onCount} ligad${onCount === 1 ? 'o' : 'os'}` : 'Todos desligados'}
        </span>
        <button
          onClick={handleToggleAll}
          className="text-[11px] font-medium px-2 py-0.5 rounded-md flex-shrink-0 transition-opacity hover:opacity-70"
          style={{
            background: anyOn ? 'rgba(239,68,68,0.15)' : 'rgba(29,158,117,0.15)',
            color: anyOn ? '#F87171' : '#34D399',
          }}
        >
          {anyOn ? 'Apagar tudo' : 'Ligar tudo'}
        </button>
        <ChevronRight
          size={14}
          className="flex-shrink-0"
          style={{
            color: textMuted,
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        />
      </button>

      <div
        style={{
          maxHeight: expanded ? `${room.switches.length * 56 + 12}px` : '0px',
          overflow: 'hidden',
          transition: 'max-height 0.25s ease',
        }}
      >
        <div className="space-y-1.5 pb-3">
          {room.switches.map((sw) => (
            <RoomSwitchRow
              key={`${sw.deviceId}:${sw.code}`}
              sw={sw}
              isDark={isDark}
              textMain={textMain}
              textMuted={textMuted}
              getStatus={getStatus}
              handleToggle={handleToggle}
              pendingToggles={pendingToggles}
              getLabel={getLabel}
              onSaveLabel={onSaveLabel}
            />
          ))}
        </div>
      </div>

      <div style={{ borderBottom: `1px solid ${cardBorder}`, opacity: 0.4 }} />
    </div>
  );
}

// ─── SwitchCard ──────────────────────────────────────────────

interface SwitchCardProps {
  isDark: boolean;
  textMain: string;
  textMuted: string;
  cardBg: string;
  cardBorder: string;
  lightsOnCount: number;
  getStatus: (deviceId: string, code: string) => boolean;
  handleToggle: (deviceId: string, code: string) => void;
  pendingToggles: Set<string>;
  getLabel: (deviceId: string, code: string) => string;
  onSaveLabel: (deviceId: string, code: string, newLabel: string) => Promise<void>;
}

export default function SwitchCard({
  isDark, textMain, textMuted, cardBg, cardBorder, lightsOnCount,
  getStatus, handleToggle, pendingToggles, getLabel, onSaveLabel,
}: SwitchCardProps) {
  const { rooms, loading } = useRooms();

  return (
    <div className="rounded-[14px] border p-5 flex flex-col" style={{ background: cardBg, borderColor: cardBorder }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold" style={{ color: textMain }}>Interruptores</h2>
        {lightsOnCount > 0 && (
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: '#0D2A20', color: '#34D399' }}
          >
            {lightsOnCount} ligad{lightsOnCount === 1 ? 'o' : 'os'}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <span
            className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: '#34D399', borderTopColor: 'transparent' }}
          />
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <LayoutGrid size={28} style={{ color: textMuted }} />
          <p className="text-sm text-center" style={{ color: textMuted }}>Nenhum cômodo configurado</p>
          <Link
            href="/settings"
            className="text-xs font-medium px-4 py-2 rounded-xl transition-opacity hover:opacity-70"
            style={{ background: '#0D2A20', color: '#34D399' }}
          >
            Configurar cômodos
          </Link>
        </div>
      ) : (
        <div>
          {rooms.map((room, i) => (
            <RoomSection
              key={room.id}
              room={room}
              index={i}
              isDark={isDark}
              textMain={textMain}
              textMuted={textMuted}
              cardBorder={cardBorder}
              getStatus={getStatus}
              handleToggle={handleToggle}
              pendingToggles={pendingToggles}
              getLabel={getLabel}
              onSaveLabel={onSaveLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
}