import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET() {
  const res = await fetch(`${API_URL}/devices/lock/logs`);
  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch lock logs' }, { status: res.status });
  }
  return NextResponse.json(await res.json());
}
