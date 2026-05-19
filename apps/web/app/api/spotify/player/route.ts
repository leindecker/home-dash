import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token ?? null;
}

export async function GET() {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get('spotify_access_token')?.value;
  const refreshToken = cookieStore.get('spotify_refresh_token')?.value;

  if (!accessToken && !refreshToken) {
    return NextResponse.json({ error: 'Not connected' }, { status: 401 });
  }

  const fetchPlayer = (token: string) =>
    fetch('https://api.spotify.com/v1/me/player', {
      headers: { Authorization: `Bearer ${token}` },
    });

  let res = await fetchPlayer(accessToken ?? '');

  if (res.status === 401 && refreshToken) {
    const newToken = await refreshAccessToken(refreshToken);
    if (!newToken) {
      return NextResponse.json({ error: 'Token refresh failed' }, { status: 401 });
    }
    cookieStore.set('spotify_access_token', newToken, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    accessToken = newToken;
    res = await fetchPlayer(newToken);
  }

  if (res.status === 204) {
    return NextResponse.json({ isPlaying: false, trackName: null });
  }

  if (!res.ok) {
    return NextResponse.json({ error: 'Spotify API error' }, { status: res.status });
  }

  const data = await res.json();
  const item = data.item;

  return NextResponse.json({
    isPlaying: data.is_playing,
    trackName: item?.name ?? null,
    artistName: item?.artists?.map((a: { name: string }) => a.name).join(', ') ?? null,
    albumName: item?.album?.name ?? null,
    albumArt: item?.album?.images?.[0]?.url ?? null,
    progressMs: data.progress_ms ?? 0,
    durationMs: item?.duration_ms ?? 0,
    deviceName: data.device?.name ?? null,
  });
}

const PLAYER_ACTIONS: Record<string, { method: string; url: string }> = {
  play: { method: 'PUT', url: 'https://api.spotify.com/v1/me/player/play' },
  pause: { method: 'PUT', url: 'https://api.spotify.com/v1/me/player/pause' },
  next: { method: 'POST', url: 'https://api.spotify.com/v1/me/player/next' },
  previous: { method: 'POST', url: 'https://api.spotify.com/v1/me/player/previous' },
};

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('spotify_access_token')?.value;

  if (!accessToken) {
    return NextResponse.json({ error: 'Not connected' }, { status: 401 });
  }

  const { action } = await req.json();
  const endpoint = PLAYER_ACTIONS[action];
  if (!endpoint) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const res = await fetch(endpoint.url, {
    method: endpoint.method,
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok && res.status !== 204) {
    return NextResponse.json({ error: 'Spotify API error' }, { status: res.status });
  }

  return NextResponse.json({ ok: true });
}