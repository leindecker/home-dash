import { NextRequest, NextResponse } from 'next/server';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; deviceId: string; code: string } }
) {
  const res = await fetch(
    `${API}/rooms/${params.id}/switches/${params.deviceId}/${params.code}`,
    { method: 'DELETE' }
  ).catch(() => null);
  if (!res) return NextResponse.json({ error: 'Failed' }, { status: 500 });
  return NextResponse.json(await res.json(), { status: res.status });
}