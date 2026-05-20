import { NextResponse } from 'next/server';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET() {
  const res = await fetch(`${API}/rooms/unassigned`).catch(() => null);
  if (!res?.ok) return NextResponse.json([], { status: res?.status ?? 500 });
  return NextResponse.json(await res.json());
}