'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import {
  LayoutDashboard, Zap, BarChart2, Settings, Wifi, WifiOff, LogOut, Bot,
} from 'lucide-react';
import { useTokens } from '@/lib/theme';
import { fetchDevices, Device } from '@/lib/api';
import SpotifyMini from '@/components/SpotifyMini';
import { MOCK_ROOMS, RoomData } from '@/components/TemperatureCard';

// ─── nav config ───────────────────────────────────────────

const NAV_MAIN = [
  { href: '/',          icon: LayoutDashboard, label: 'Home'      },
  { href: '/routines',  icon: Zap,             label: 'Rotinas'   },
  { href: '/history',   icon: BarChart2,       label: 'Histórico' },
  { href: '/cleaning',  icon: Bot,             label: 'Limpeza'   },
] as const;

const NAV_SYSTEM = [
  { href: '/settings', icon: Settings, label: 'Configurações' },
] as const;

// ─── NavItem ──────────────────────────────────────────────

interface NavItemProps {
  href: string;
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  textMuted: string;
  onClick?: () => void;
}

function NavItem({ href, icon: Icon, label, isActive, textMuted, onClick }: NavItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                 dark:hover:bg-white/5 hover:bg-black/[0.04] hover:opacity-100"
      style={{
        background: isActive ? '#0D2A20' : 'transparent',
        color:      isActive ? '#34D399' : textMuted,
      }}
    >
      <Icon size={17} />
      {label}
    </Link>
  );
}

// ─── UserSection ──────────────────────────────────────────

function UserSection({ cardBorder, textMain, textMuted }: {
  cardBorder: string; textMain: string; textMuted: string;
}) {
  const { data: session } = useSession();
  if (!session?.user) return null;

  const { name, email, image } = session.user;

  return (
    <div>
      <div style={{ height: 1, margin: '0 20px 12px', background: cardBorder }} />
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2.5">
          {image ? (
            <Image
              src={image}
              alt={name ?? 'Avatar'}
              width={32}
              height={32}
              className="rounded-full flex-shrink-0"
              style={{ objectFit: 'cover' }}
              unoptimized={false}
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold"
              style={{ background: '#0D2A20', color: '#34D399' }}
            >
              {name?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold truncate" style={{ color: textMain }}>{name}</p>
            <p className="text-[10px] truncate" style={{ color: textMuted }}>{email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="p-1.5 rounded-lg flex-shrink-0 transition-opacity hover:opacity-60"
            style={{ color: textMuted }}
            title="Sair"
            aria-label="Sair"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Temperature helpers ───────────────────────────────────

function sidebarTempColor(temp: number): string {
  if (temp < 20) return '#60A5FA';
  if (temp <= 26) return '#1D9E75';
  return '#F59E0B';
}

// ─── Sidebar ──────────────────────────────────────────────

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { isDark, sidebarBg, cardBorder, textMain, textMuted } = useTokens();
  const [hub, setHub] = useState<Device | null | undefined>(undefined);
  const [tempRooms, setTempRooms] = useState<RoomData[]>([]);

  useEffect(() => {
    fetchDevices()
      .then((devs) => setHub(devs.find((d) => d.type === 'hub') ?? null))
      .catch(() => setHub(null));
  }, []);

  useEffect(() => {
    setTempRooms(MOCK_ROOMS);
    const id = setInterval(() => setTempRooms(MOCK_ROOMS), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const navContent = (
    <nav
      className="flex flex-col h-full"
      style={{
        width: 220,
        borderRight: `1px solid ${cardBorder}`,
        background: sidebarBg,
      }}
    >
      {/* Brand */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-lg leading-none">🏠</span>
          <span className="text-sm font-bold leading-tight" style={{ color: textMain }}>
            Meu Apartamento
          </span>
        </div>
        <p className="text-[11px] ml-7" style={{ color: textMuted }}>Painel de automação</p>
      </div>
      <div style={{ height: 1, margin: '0 20px', background: cardBorder }} />

      {/* Temperature widget */}
      {tempRooms.length > 0 && (
        <div className="px-4 pt-3 pb-1">
          <div className="grid grid-cols-3 gap-1.5">
            {tempRooms.map((room) => {
              const color = sidebarTempColor(room.temp);
              return (
                <div
                  key={room.name}
                  className="flex flex-col rounded-lg"
                  style={{
                    padding: '6px 8px',
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                  }}
                >
                  <p
                    className="text-[9px] font-medium truncate leading-tight mb-1"
                    style={{ color: textMuted }}
                  >
                    {room.name}
                  </p>
                  <p
                    className="text-[13px] font-bold tabular-nums leading-none"
                    style={{ color }}
                  >
                    {room.temp.toFixed(1)}°
                  </p>
                  <p className="text-[9px] mt-0.5" style={{ color: textMuted }}>
                    {room.humidity}%
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="px-3 pt-4 flex-1 space-y-5 overflow-y-auto">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider px-3 mb-2" style={{ color: textMuted }}>
            Principal
          </p>
          <div className="space-y-0.5">
            {NAV_MAIN.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                isActive={pathname === item.href}
                textMuted={textMuted}
                onClick={onClose}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider px-3 mb-2" style={{ color: textMuted }}>
            Sistema
          </p>
          <div className="space-y-0.5">
            {NAV_SYSTEM.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                isActive={pathname === item.href}
                textMuted={textMuted}
                onClick={onClose}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Hub status */}
      <div className="p-4">
        <div style={{ height: 1, background: cardBorder, marginBottom: 12 }} />
        <div className="flex items-center gap-2.5 px-2">
          {hub === undefined ? (
            <span className="w-2 h-2 rounded-full" style={{ background: textMuted }} />
          ) : hub?.online ? (
            <Wifi size={13} style={{ color: '#1D9E75' }} />
          ) : (
            <WifiOff size={13} style={{ color: '#EF4444' }} />
          )}
          <div>
            <p className="text-[11px] font-medium" style={{ color: textMain }}>Hub Zigbee</p>
            <p
              className="text-[10px]"
              style={{
                color: hub === undefined
                  ? textMuted
                  : hub?.online ? '#1D9E75' : '#EF4444',
              }}
            >
              {hub === undefined ? '…' : hub?.online ? 'Online' : hub ? 'Offline' : 'Não encontrado'}
            </p>
          </div>
        </div>
      </div>

      {/* Spotify mini player */}
      <SpotifyMini />

      {/* Logged-in user */}
      <UserSection cardBorder={cardBorder} textMain={textMain} textMuted={textMuted} />
    </nav>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex flex-shrink-0" style={{ width: 220 }}>
        {navContent}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar */}
      <div
        className="fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-300"
        style={{ transform: mobileOpen ? 'translateX(0)' : 'translateX(-220px)' }}
      >
        {navContent}
      </div>
    </>
  );
}
