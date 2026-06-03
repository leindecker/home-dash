interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  stats() {
    const now = Date.now();
    const entries = [...this.store.entries()].map(([key, entry]) => ({
      key,
      expiresIn: Math.max(0, Math.round((entry.expiresAt - now) / 1000)),
    }));
    return { size: this.store.size, entries };
  }
}

export const cache = new MemoryCache();

export const TTL = {
  DEVICES_LIST:  30 * 1000,        // 30 segundos
  DEVICE_STATUS: 15 * 1000,        // 15 segundos
  DEVICE_LOGS:   2 * 60 * 1000,    // 2 minutos
  LOCK_LOGS:     5 * 60 * 1000,    // 5 minutos
  WEATHER:       10 * 60 * 1000,   // 10 minutos
  ROOMS:         60 * 1000,        // 1 minuto
};
