import crypto from 'crypto';
import dotenv from 'dotenv';
import { cache, TTL } from './cache.service';

dotenv.config();

const ACCESS_ID = process.env.TUYA_ACCESS_ID!;
const ACCESS_SECRET = process.env.TUYA_ACCESS_SECRET!;
const BASE_URL = 'https://openapi.tuyaus.com';

export const KNOWN_DEVICES = [
  { id: 'ebc9c5e8491da83916rvhb', name: 'Hub Zigbee Cabeado', type: 'hub', buttons: 0 },
  { id: 'ebc5f5c500ab3ceea7nyzx', name: 'Interruptor Sacada', type: 'switch', buttons: 2 },
  { id: 'eb5b117b23c9ef9feamrrs', name: 'Interruptor Cozinha', type: 'switch', buttons: 2 },
  { id: 'ebbb20db30fc1f6d1bdjdq', name: 'Interruptor Corredor', type: 'switch', buttons: 3 },
  { id: 'ebe4a3e1b2496feef2mxik', name: 'Interruptor Cabeceira Esquerda', type: 'switch', buttons: 2 },
  { id: 'eb6bc8843ee4ff7b6bmts7', name: 'Interruptor Cabeceira Direita', type: 'switch', buttons: 2 },
  { id: 'eb1d5c1cb4d951721chmpg', name: 'Interruptor Escritório', type: 'switch', buttons: 1 },
  { id: 'eb512e387c175ae79dgdri', name: 'Interruptor Banheiro Social', type: 'switch', buttons: 2 },
  { id: 'eb0460cf1eb84bb17b2ba8', name: 'Interruptor Suite', type: 'switch', buttons: 3 },
  { id: 'eb470708b10489b219sklf', name: 'Interruptor Quarto', type: 'switch', buttons: 2 },
  { id: 'eb7dac4405840b22d2bniz', name: 'Smart Lock X3', type: 'lock', buttons: 0 },
] as const;

interface TokenInfo {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

let tokenInfo: TokenInfo | null = null;

function hmacSha256(key: string, data: string): string {
  return crypto.createHmac('sha256', key).update(data).digest('hex').toUpperCase();
}

function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex').toLowerCase();
}

function buildSign(
  token: string,
  timestamp: number,
  nonce: string,
  method: string,
  path: string,
  body: string = ''
): string {
  const bodyHash = sha256(body);
  const stringToSign = `${method}\n${bodyHash}\n\n${path}`;
  const signStr = token
    ? `${ACCESS_ID}${token}${timestamp}${nonce}${stringToSign}`
    : `${ACCESS_ID}${timestamp}${nonce}${stringToSign}`;
  return hmacSha256(ACCESS_SECRET, signStr);
}

async function refreshToken(): Promise<void> {
  const timestamp = Date.now();
  const nonce = crypto.randomUUID();
  const path = '/v1.0/token?grant_type=1';
  const sign = buildSign('', timestamp, nonce, 'GET', path);

  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      client_id: ACCESS_ID,
      sign_method: 'HMAC-SHA256',
      sign,
      t: String(timestamp),
      nonce,
    },
  });

  const data = await response.json() as {
    success: boolean;
    msg?: string;
    result: { access_token: string; refresh_token: string; expire_time: number };
  };

  if (!data.success) {
    throw new Error(`Tuya auth failed: ${data.msg}`);
  }

  tokenInfo = {
    accessToken: data.result.access_token,
    refreshToken: data.result.refresh_token,
    expiresAt: Date.now() + (data.result.expire_time - 60) * 1000,
  };
}

async function getToken(): Promise<string> {
  if (!tokenInfo || Date.now() >= tokenInfo.expiresAt) {
    await refreshToken();
  }
  return tokenInfo!.accessToken;
}

function sortedPath(path: string): string {
  const [pathname, qs] = path.split('?');
  if (!qs) return pathname;
  const sorted = [...new URLSearchParams(qs).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return `${pathname}?${sorted}`;
}

async function tuyaRequest<T>(method: string, path: string, body?: object): Promise<T> {
  const canonicalPath = sortedPath(path);
  const token = await getToken();
  const timestamp = Date.now();
  const nonce = crypto.randomUUID();
  const bodyStr = body ? JSON.stringify(body) : '';
  const sign = buildSign(token, timestamp, nonce, method, canonicalPath, bodyStr);

  const response = await fetch(`${BASE_URL}${canonicalPath}`, {
    method,
    headers: {
      client_id: ACCESS_ID,
      sign_method: 'HMAC-SHA256',
      sign,
      t: String(timestamp),
      nonce,
      access_token: token,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: bodyStr } : {}),
  });

  const data = await response.json() as { success: boolean; code?: number; msg?: string; result: T };

  if (!data.success) {
    console.error('[tuya] request failed', {
      method,
      path: canonicalPath,
      httpStatus: response.status,
      tuyaCode: data.code,
      msg: data.msg,
      body: bodyStr || '(empty)',
    });
    throw new Error(`Tuya request failed [${method} ${canonicalPath}] code=${data.code}: ${data.msg}`);
  }

  return data.result;
}

type DeviceInfo = {
  id: string; name: string; type: string; buttons: number;
  online: boolean; status: { code: string; value: unknown }[];
};

export async function getDevices(): Promise<DeviceInfo[]> {
  const cacheKey = 'devices:list';
  const cached = cache.get<DeviceInfo[]>(cacheKey);
  if (cached) {
    console.log('[cache] hit: devices:list');
    return cached;
  }
  console.log('[cache] miss: devices:list → buscando na Tuya');

  const results = await Promise.allSettled(
    KNOWN_DEVICES.map(async (meta) => {
      const info = await tuyaRequest<{
        id: string;
        name: string;
        online: boolean;
        status: { code: string; value: unknown }[];
      }>('GET', `/v1.0/devices/${meta.id}`);

      return {
        ...meta,
        online: info.online,
        status: info.status ?? [],
      };
    })
  );

  const list = results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { ...KNOWN_DEVICES[i], online: false, status: [] }
  );

  cache.set(cacheKey, list, TTL.DEVICES_LIST);
  return list;
}

export async function getDeviceStatus(id: string) {
  const cacheKey = `device:status:${id}`;
  const cached = cache.get<{ code: string; value: unknown }[]>(cacheKey);
  if (cached) {
    console.log(`[cache] hit: ${cacheKey}`);
    return cached;
  }
  console.log(`[cache] miss: ${cacheKey} → buscando na Tuya`);

  const result = await tuyaRequest<{ code: string; value: unknown }[]>('GET', `/v1.0/devices/${id}/status`);
  cache.set(cacheKey, result, TTL.DEVICE_STATUS);
  return result;
}

export async function sendCommand(
  id: string,
  commands: { code: string; value: boolean | string | number }[]
) {
  const result = await tuyaRequest('POST', `/v1.0/devices/${id}/commands`, { commands });

  // Invalida cache do dispositivo após comando
  cache.invalidate(`device:status:${id}`);
  cache.invalidate('devices:list');
  console.log(`[cache] invalidated after command: ${id}`);

  return result;
}

type LockLog = {
  update_time: number;
  nick_name: string;
  unlock_name: string;
  status: { code: string; value: string };
};

export async function getLockLogs(id: string) {
  const cacheKey = `lock:logs:${id}`;
  const cached = cache.get<LockLog[]>(cacheKey);
  if (cached) {
    console.log(`[cache] hit: ${cacheKey}`);
    return cached;
  }
  console.log(`[cache] miss: ${cacheKey} → buscando na Tuya`);

  const now   = Math.floor(Date.now() / 1000);
  const start = now - 7 * 24 * 60 * 60;
  const path  = `/v1.1/devices/${id}/door-lock/open-logs?page_no=1&page_size=20&start_time=${start}&end_time=${now}`;

  const result = await tuyaRequest<{
    logs: LockLog[];
    total: number;
  }>('GET', path);

  const logs = result?.logs ?? [];
  cache.set(cacheKey, logs, TTL.LOCK_LOGS);
  return logs;
}

type DeviceLogEntry = { code: string; value: string; eventTime: number; eventId: string };

export async function getDeviceLogs(id: string) {
  const cacheKey = `device:logs:${id}`;
  const cached = cache.get<DeviceLogEntry[]>(cacheKey);
  if (cached) {
    console.log(`[cache] hit: ${cacheKey}`);
    return cached;
  }
  console.log(`[cache] miss: ${cacheKey} → buscando na Tuya`);

  const now = Date.now();
  const start = now - 24 * 60 * 60 * 1000;
  const path = `/v1.0/devices/${id}/logs?end_time=${now}&size=20&start_time=${start}&type=1`;
  const result = await tuyaRequest<{
    logs: {
      code?: string;
      value?: string;
      event_time?: number;
      event_id?: number | string;
    }[];
  }>('GET', path);

  const logs = (result?.logs ?? [])
    .filter((log) => log.code && log.value !== undefined)
    .map((log) => ({
      code:      log.code!,
      value:     String(log.value),
      eventTime: log.event_time
        ? (log.event_time > 9_999_999_999
            ? Math.floor(log.event_time / 1000)
            : log.event_time)
        : 0,
      eventId:   String(log.event_id ?? ''),
    }));

  cache.set(cacheKey, logs, TTL.DEVICE_LOGS);
  return logs;
}
