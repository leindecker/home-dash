const VACUUM_IP    = process.env.XIAOMI_VACUUM_IP!;
const VACUUM_TOKEN = process.env.XIAOMI_VACUUM_TOKEN!;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let device: any = null;

const CONNECT_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`[vacuum] ${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// Lazy-load so tsx watch mode doesn't try to transform miio's old CommonJS
// dependency tree (object-keys etc.) at server startup, which causes an
// ECANCELED syscall error on macOS when many files are read simultaneously.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getDevice(): Promise<any> {
  if (!device) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const miio = require('miio') as any;
    device = await withTimeout(
      miio.device({ address: VACUUM_IP, token: VACUUM_TOKEN }),
      CONNECT_TIMEOUT_MS,
      `connect to ${VACUUM_IP}`,
    );
  }
  return device;
}

const STATE_MAP: Record<number, string> = {
  1:  'idle',
  2:  'idle',
  3:  'idle',
  4:  'cleaning',
  5:  'returning',
  6:  'cleaning',
  8:  'charging',
  9:  'charging',
  10: 'paused',
  11: 'cleaning',
  12: 'error',
  13: 'idle',
  14: 'idle',
  17: 'idle',
  18: 'cleaning',
};

const COMMAND_MAP: Record<string, { method: string; params: unknown[] }> = {
  start: { method: 'app_start',  params: [] },
  pause: { method: 'app_pause',  params: [] },
  stop:  { method: 'app_stop',   params: [] },
  dock:  { method: 'app_charge', params: [] },
  spot:  { method: 'app_spot',   params: [] },
};

let lastKnownStatus: ReturnType<typeof buildStatus> | null = null;

function buildStatus(state: Record<string, number>, summary: unknown[][]) {
  const s = state;
  return {
    status:    STATE_MAP[s.state] ?? 'idle',
    battery:   s.battery,
    cleanTime: s.clean_time,
    cleanArea: Math.round(s.clean_area / 10000),
    fanPower:  s.fan_power,
    error:     s.error_code,
    offline:   false as boolean,
    lastClean: summary?.[0] ? {
      duration: Math.round((summary[0][1] as number) / 60) + ' min',
      area:     Math.round((summary[0][2] as number) / 10000) + ' m²',
      date:     new Date((summary[0][0] as number) * 1000).toLocaleString('pt-BR'),
    } : null,
  };
}

export async function getVacuumStatus() {
  try {
    const d = await getDevice();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state   = await withTimeout(d.call('get_status', []),        CONNECT_TIMEOUT_MS, 'get_status')        as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summary = await withTimeout(d.call('get_clean_summary', []), CONNECT_TIMEOUT_MS, 'get_clean_summary') as any[];

    const result = buildStatus(state[0], summary);
    lastKnownStatus = result;
    return result;
  } catch (err) {
    console.error('[vacuum] getStatus error:', err);
    device = null;
    if (lastKnownStatus) {
      return { ...lastKnownStatus, offline: true };
    }
    return {
      status:    'offline' as string,
      battery:   null as number | null,
      cleanTime: null as number | null,
      cleanArea: null as number | null,
      fanPower:  null as number | null,
      error:     null as number | null,
      offline:   true,
      lastClean: null,
    };
  }
}

export async function sendVacuumCommand(command: string, params: unknown[] = []) {
  try {
    const d   = await getDevice();
    const cmd = COMMAND_MAP[command];
    if (!cmd) throw new Error(`Unknown command: ${command}`);

    const result = await withTimeout(
      d.call(cmd.method, params.length ? params : cmd.params),
      CONNECT_TIMEOUT_MS,
      cmd.method,
    );
    console.log(`[vacuum] command ${command} result:`, result);
    return { success: true, result };
  } catch (err) {
    console.error('[vacuum] command error:', err);
    device = null;
    throw err;
  }
}

export async function startRoomCleaning(roomIds: number[]) {
  try {
    const d      = await getDevice();
    const result = await withTimeout(
      d.call('app_segment_clean', [roomIds]),
      CONNECT_TIMEOUT_MS,
      'app_segment_clean',
    );
    console.log('[vacuum] room cleaning result:', result);
    return { success: true, result };
  } catch (err) {
    console.error('[vacuum] room cleaning error:', err);
    device = null;
    throw err;
  }
}
