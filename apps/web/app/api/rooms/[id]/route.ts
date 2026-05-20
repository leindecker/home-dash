import { NextRequest, NextResponse } from 'next/server';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const res = await fetch(`${API}/rooms/${params.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res) return NextResponse.json({ error: 'Failed' }, { status: 500 });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const res = await fetch(`${API}/rooms/${params.id}`, {
    method: 'DELETE',
  }).catch(() => null);
  if (!res) return NextResponse.json({ error: 'Failed' }, { status: 500 });
  return NextResponse.json(await res.json(), { status: res.status });
}