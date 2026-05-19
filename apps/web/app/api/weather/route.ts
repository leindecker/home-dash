import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ error: 'lat and lon are required' }, { status: 400 });
  }

  // Backend auth is now optional (soft) — no Authorization header needed
  const res = await fetch(`${API_URL}/weather?lat=${lat}&lon=${lon}`);

  if (!res.ok) {
    return NextResponse.json({ error: 'Weather fetch failed' }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
