import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function GET() {
  try {
    const res = await fetch(`${API_URL}/vacuum/status`);
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch vacuum status' }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
