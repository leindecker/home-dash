import crypto from 'crypto';
import dotenv from 'dotenv';

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

async function tuyaRequest<T>(method: string, path: string, body?: object): Promise<T> {
  const token = await getToken();
  const timestamp = Date.now();
  const nonce = crypto.randomUUID();
  const bodyStr = body ? JSON.stringify(body) : '';
  const sign = buildSign(token, timestamp, nonce, method, path, bodyStr);

  const response = await fetch(`${BASE_URL}${path}`, {
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

  const data = await response.json() as { success: boolean; msg?: string; result: T };

  if (!data.success) {
    throw new Error(`Tuya request failed [${method} ${path}]: ${data.msg}`);
  }

  return data.result;
}

export async function getDevices() {
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

  return results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { ...KNOWN_DEVICES[i], online: false, status: [] }
  );
}

export async function getDeviceStatus(id: string) {
  return tuyaRequest<{ code: string; value: unknown }[]>('GET', `/v1.0/devices/${id}/status`);
}

export async function sendCommand(
  id: string,
  commands: { code: string; value: boolean | string | number }[]
) {
  return tuyaRequest('POST', `/v1.0/devices/${id}/commands`, { commands });
}

export async function getDeviceLogs(id: string) {
  const now = Date.now();
  const start = now - 24 * 60 * 60 * 1000;
  const path = `/v1.0/devices/${id}/logs?start_time=${start}&end_time=${now}&size=20`;
  const result = await tuyaRequest<{ logs: unknown[] }>(
    'GET',
    path
  );
  return result?.logs ?? [];
}

export async function getLockLogs(id: string) {
  const now = Date.now();
  const start = now - 7 * 24 * 60 * 60 * 1000;
  const path = `/v1.0/devices/${id}/logs?start_time=${start}&end_time=${now}&size=50`;
  const result = await tuyaRequest<{ logs: unknown[] }>('GET', path);
  return result?.logs ?? [];
}