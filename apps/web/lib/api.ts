const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Module-level auth token — set by ClientLayout after session loads
let _authToken: string | null = null;

export function setAuthToken(token: string | null) {
  _authToken = token;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };
  if (_authToken) headers['Authorization'] = `Bearer ${_authToken}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null;
    const detail = body?.error ? ` — ${body.error}` : '';
    throw new Error(`API error ${res.status}: ${path}${detail}`);
  }
  return res.json() as Promise<T>;
}

export function fetchDevices() {
  return apiFetch<Device[]>('/devices');
}

export function fetchDeviceLogs(deviceId: string) {
  return apiFetch<DeviceLog[]>(`/devices/${deviceId}/logs`);
}

export interface LockState {
  status: 'locked' | 'unlocked' | 'unknown';
  method: string | null;
  userName: string | null;
  updatedAt: string;
}

export function fetchLockState() {
  return apiFetch<LockState>('/devices/lock/state');
}

export interface LockLog {
  eventTime: string;
  method: string;
  label: string;
  userName: string | null;
  unlockName: string | null;
}

export function fetchLockLogs() {
  return apiFetch<LockLog[]>('/devices/lock/logs');
}

export function sendDeviceCommand(
  deviceId: string,
  commands: { code: string; value: boolean | string | number }[]
) {
  return apiFetch<unknown>(`/devices/${deviceId}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands }),
  });
}

export interface Device {
  id: string;
  name: string;
  type: string;
  online: boolean;
  status: { code: string; value: boolean | string | number }[];
  buttons?: number;
}

export interface DeviceLog {
  eventId?: string;
  code: string;
  value: string;
  eventTime: number;
}

export interface SwitchLabelEntry {
  code: string;
  label: string;
}

export function fetchSwitchLabels(deviceId: string) {
  return apiFetch<SwitchLabelEntry[]>(`/devices/${deviceId}/switches/labels`);
}

export function updateSwitchLabel(deviceId: string, code: string, label: string) {
  return apiFetch<{ deviceId: string; code: string; label: string }>(
    `/devices/${deviceId}/switches/${code}/label`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    }
  );
}

// ─── auth helpers ──────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  totpEnabled: boolean;
}

export function fetchMe() {
  return apiFetch<UserProfile>('/auth/me');
}

export function setup2FA() {
  return apiFetch<{ secret: string; otpauthUrl: string }>('/auth/setup-2fa', {
    method: 'POST',
  });
}

export function confirm2FA(code: string) {
  return apiFetch<{ ok: boolean }>('/auth/confirm-2fa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
}

export function disable2FA() {
  return apiFetch<{ ok: boolean }>('/auth/disable-2fa', { method: 'POST' });
}