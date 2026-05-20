'use client';

import { useCallback, useEffect, useState } from 'react';
import { SkipBack, SkipForward, Play, Pause, Music, VolumeX } from 'lucide-react';
import { useTokens } from '@/lib/theme';

interface PlayerState {
  isPlaying: boolean;
  trackName: string | null;
  artistName: string | null;
  albumArt: string | null;
  progressMs: number;
  durationMs: number;
}

export default function SpotifyMini() {
  const { cardBorder, textMain, textMuted } = useTokens();
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  const fetchPlayer = useCallback(async () => {
    try {
      const res = await fetch('/api/spotify/player');
      if (res.status === 401 || res.status === 500) {
        setConnected(false);
        return;
      }
      setConnected(true);
      if (res.status === 204) {
        setPlayer(null);
        return;
      }
      const data = await res.json();
      setPlayer({
        isPlaying: data.isPlaying,
        trackName: data.trackName,
        artistName: data.artistName,
        albumArt: data.albumArt,
        progressMs: data.progressMs,
        durationMs: data.durationMs,
      });
    } catch {
      // ignore network errors
    }
  }, []);

  useEffect(() => {
    fetchPlayer();
    const id = setInterval(fetchPlayer, 5000);
    return () => clearInterval(id);
  }, [fetchPlayer]);

  async function sendAction(action: 'play' | 'pause' | 'next' | 'previous') {
    setPending(true);
    try {
      await fetch('/api/spotify/player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      setTimeout(fetchPlayer, 500);
    } finally {
      setPending(false);
    }
  }

  const wrapStyle: React.CSSProperties = {
    margin: 8,
    borderRadius: 12,
    border: `0.5px solid ${cardBorder}`,
    background: 'rgba(0,0,0,0.15)',
    overflow: 'hidden',
  };

  // Disconnected or nothing playing
  if (!connected || !player?.trackName) {
    return (
      <div style={wrapStyle}>
        <div className="flex flex-col items-center justify-center" style={{ padding: '16px 10px' }}>
          <VolumeX size={22} style={{ color: textMuted, opacity: 0.5 }} />
          <span className="text-[11px] mt-1" style={{ color: textMuted, opacity: 0.7 }}>
            Nada tocando
          </span>
        </div>
      </div>
    );
  }

  const progress = player.durationMs > 0
    ? Math.min(100, (player.progressMs / player.durationMs) * 100)
    : 0;

  return (
    <div style={wrapStyle}>
      {/* Track info row */}
      <div className="flex gap-2.5" style={{ padding: '10px 10px 6px' }}>
        {/* Album art */}
        <div
          className="flex-shrink-0 flex items-center justify-center overflow-hidden"
          style={{
            width: 42,
            height: 42,
            borderRadius: 6,
            background: 'linear-gradient(135deg, #1a1a2e, #0D2A1A)',
          }}
        >
          {player.albumArt ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={player.albumArt}
              alt="Album art"
              style={{ width: 42, height: 42, objectFit: 'cover' }}
            />
          ) : (
            <Music size={20} style={{ color: '#1DB954' }} />
          )}
        </div>

        {/* Track + artist + badge */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p
            className="text-[12px] font-semibold leading-tight truncate"
            style={{ color: textMain }}
          >
            {player.trackName}
          </p>
          <p
            className="text-[11px] leading-tight truncate"
            style={{ color: textMuted, marginTop: 2 }}
          >
            {player.artistName}
          </p>
          <div className="flex items-center gap-1" style={{ marginTop: 3 }}>
            {player.isPlaying ? (
              <>
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
                  style={{ background: '#1DB954' }}
                />
                <span className="text-[10px]" style={{ color: '#1DB954' }}>Tocando</span>
              </>
            ) : (
              <span className="text-[10px]" style={{ color: textMuted }}>Pausado</span>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 2,
          margin: '0 10px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: '#1DB954',
            transition: 'width 0.5s linear',
          }}
        />
      </div>

      {/* Controls */}
      <div
        className="flex items-center justify-center"
        style={{ padding: '6px 8px 8px', gap: 2 }}
      >
        <button
          onClick={() => sendAction('previous')}
          disabled={pending}
          className="p-1.5 rounded-full transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ color: textMuted }}
          aria-label="Anterior"
        >
          <SkipBack size={17} />
        </button>
        <button
          onClick={() => sendAction(player.isPlaying ? 'pause' : 'play')}
          disabled={pending}
          className="flex items-center justify-center rounded-full transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ width: 30, height: 30, background: '#1DB954' }}
          aria-label={player.isPlaying ? 'Pausar' : 'Tocar'}
        >
          {player.isPlaying
            ? <Pause size={14} fill="#000" color="#000" />
            : <Play size={14} fill="#000" color="#000" />}
        </button>
        <button
          onClick={() => sendAction('next')}
          disabled={pending}
          className="p-1.5 rounded-full transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ color: textMuted }}
          aria-label="Próxima"
        >
          <SkipForward size={17} />
        </button>
      </div>
    </div>
  );
}