'use client';

import { useState, useCallback, useEffect } from 'react';

export interface RoomSwitch {
  id: string;
  deviceId: string;
  code: string;
  label: string;
}

export interface Room {
  id: string;
  name: string;
  icon: string;
  order: number;
  switches: RoomSwitch[];
}

export function useRooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rooms');
      if (!res.ok) throw new Error('Failed to fetch rooms');
      setRooms(await res.json());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { rooms, loading, error, refetch };
}