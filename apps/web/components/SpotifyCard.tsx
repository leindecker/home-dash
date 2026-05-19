'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Disc, SkipBack, SkipForward, Play, Pause } from 'lucide-react';

export interface SpotifyPlayerState {
  isPlaying: boolean;
  trackName: string | null;
  artistName: string | null;
  albumName: string | null;
  albumArt: string | null;
  progressMs: number;
  durationMs: number;
  deviceName: string | null;
}

interface SpotifyCardProps {
  isDark: boolean;
  cardBg: string;
  cardBorder: string;
  textMain: string;
  textMuted: string;
  onTrackChange?: (trackName: string | null) => void;
}

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SpotifyCard({
  isDark, cardBg, cardBorder, textMain, textMuted, onTrackChange,
}: SpotifyCardProps) {
  const [player, setPlayer] = useState<SpotifyPlayerState | null>(null);
  // null = initial loading, false = not authenticated, true = authenticated
  const [connected, setConnected] = useState<boolean | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const onTrackChangeRef = useRef(onTrackChange);
  onTrackChangeRef.current = onTrackChange;

  const fetchPlayer = useCallback(async () => {
    try {
      const res = await fetch('/api/spotify/player');
      if (res.status === 401) {
        setConnected(false);
        onTrackChangeRef.current?.(null);
        return;
      }
      setConnected(true);
      if (res.status === 204) {
        setPlayer(null);
        onTrackChangeRef.current?.(null);
        return;
      }
      const data: SpotifyPlayerState = await res.json();
      setPlayer(data);
      onTrackChangeRef.current?.(data.isPlaying ? data.trackName : null);
    } catch {
      // ignore network errors silently
    }
  }, []);

  useEffect(() => {
    fetchPlayer();
    const id = setInterval(fetchPlayer, 5000);
    return () => clearInterval(id);
  }, [fetchPlayer]);

  async function sendAction(action: 'play' | 'pause' | 'next' | 'previous') {
    setActionPending(true);
    try {
      await fetch('/api/spotify/player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      setTimeout(fetchPlayer, 500);
    } finally {
      setActionPending(false);
    }
  }

  const cardClass = 'rounded-[14px] border p-5 flex flex-col';
  const cardStyle = { background: cardBg, borderColor: cardBorder };

  // ── disconnected ──────────────────────────────────────────
  if (connected === false) {
    return (
      <div className={cardClass} style={cardStyle}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: textMain }}>Spotify</h2>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-6">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(29,185,84,0.15)' }}
          >
            <Disc size={22} color="#1DB954" />
          </div>
          <p className="text-sm text-center" style={{ color: textMuted }}>
            Conecte sua conta Spotify para ver o que está tocando
          </p>
          <a
            href="/api/spotify/login"
            className="px-4 py-2 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: '#1DB954', color: '#000' }}
          >
            Conectar Spotify
          </a>
        </div>
      </div>
    );
  }

  // ── loading ───────────────────────────────────────────────
  if (connected === null) {
    return (
      <div className={cardClass} style={cardStyle}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: textMain }}>Spotify</h2>
        <div className="flex-1 flex items-center justify-center h-32">
          <div
            className="w-5 h-5 border-2 rounded-full animate-spin"
            style={{ borderColor: '#1DB954', borderTopColor: 'transparent' }}
          />
        </div>
      </div>
    );
  }

  // ── nothing playing ───────────────────────────────────────
  if (!player?.trackName) {
    return (
      <div className={cardClass} style={cardStyle}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: textMain }}>Spotify</h2>
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              color: textMuted,
            }}
          >
            Pausado
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-4">
          <div
            className="w-14 h-14 rounded-lg flex items-center justify-center"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
          >
            <Disc size={24} style={{ color: textMuted }} />
          </div>
          <p className="text-xs" style={{ color: textMuted }}>Nada tocando</p>
        </div>
      </div>
    );
  }

  // ── playing or paused with track ──────────────────────────
  const progress = player.durationMs > 0 ? player.progressMs / player.durationMs : 0;

  return (
    <div className={cardClass} style={cardStyle}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold" style={{ color: textMain }}>Spotify</h2>
        {player.isPlaying ? (
          <span
            className="flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: '#0D2A1A', color: '#1DB954' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: '#1DB954' }}
            />
            Tocando
          </span>
        ) : (
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              color: textMuted,
            }}
          >
            Pausado
          </span>
        )}
      </div>

      {/* Track info */}
      <div className="flex items-center gap-3 mb-4">
        {player.albumArt ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.albumArt}
            alt={player.albumName ?? 'Album art'}
            width={60}
            height={60}
            className="flex-shrink-0 object-cover"
            style={{ borderRadius: 8, width: 60, height: 60 }}
          />
        ) : (
          <div
            className="flex-shrink-0 flex items-center justify-center"
            style={{
              width: 60,
              height: 60,
              borderRadius: 8,
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            }}
          >
            <Disc size={24} style={{ color: textMuted }} />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight truncate" style={{ color: textMain }}>
            {player.trackName}
          </p>
          <p className="text-xs mt-0.5 truncate" style={{ color: textMuted }}>
            {player.artistName}
          </p>
          <p className="text-xs truncate" style={{ color: textMuted }}>
            {player.albumName}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-2">
        <div
          className="w-full h-1 rounded-full overflow-hidden"
          style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${Math.min(100, progress * 100)}%`, background: '#1DB954' }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] tabular-nums" style={{ color: textMuted }}>
            {formatMs(player.progressMs)}
          </span>
          <span className="text-[10px] tabular-nums" style={{ color: textMuted }}>
            {formatMs(player.durationMs)}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-5 my-1">
        <button
          onClick={() => sendAction('previous')}
          disabled={actionPending}
          className="p-1.5 rounded-full transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ color: textMuted }}
          aria-label="Anterior"
        >
          <SkipBack size={18} />
        </button>
        <button
          onClick={() => sendAction(player.isPlaying ? 'pause' : 'play')}
          disabled={actionPending}
          className="flex items-center justify-center w-10 h-10 rounded-full transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: '#1DB954' }}
          aria-label={player.isPlaying ? 'Pausar' : 'Tocar'}
        >
          {player.isPlaying
            ? <Pause size={18} fill="#000" color="#000" />
            : <Play size={18} fill="#000" color="#000" />}
        </button>
        <button
          onClick={() => sendAction('next')}
          disabled={actionPending}
          className="p-1.5 rounded-full transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ color: textMuted }}
          aria-label="Próxima"
        >
          <SkipForward size={18} />
        </button>
      </div>

      {/* Device */}
      {player.deviceName && (
        <p className="text-[11px] text-center mt-2" style={{ color: textMuted }}>
          Tocando em {player.deviceName}
        </p>
      )}
    </div>
  );
}