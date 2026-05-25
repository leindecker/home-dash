import TuyaMessageSubscribeWebsocket from 'tuya-pulsar';
import { Server as SocketServer } from 'socket.io';
import { FastifyBaseLogger } from 'fastify';
import { lockState } from '../lib/lock-state';

const LOCK_ID = 'eb7dac4405840b22d2bniz';

const UNLOCK_CODES = new Set([
  'unlock_fingerprint', 'unlock_password', 'unlock_app',
  'unlock_phone', 'unlock_key', 'unlock_face', 'unlock_card', 'unlock_temporary',
]);

const LOCK_CODES = new Set(['lock_motor', 'lock_motor_state']);

const CODE_METHOD: Record<string, string> = {
  unlock_fingerprint: 'fingerprint',
  unlock_password:    'password',
  unlock_app:         'app',
  unlock_phone:       'app',
  unlock_key:         'key',
  unlock_face:        'face',
  unlock_card:        'card',
  unlock_temporary:   'temp',
};

const REGION_URL: Record<string, string> = {
  cn: TuyaMessageSubscribeWebsocket.URL.CN,
  us: TuyaMessageSubscribeWebsocket.URL.US,
  eu: TuyaMessageSubscribeWebsocket.URL.EU,
  in: TuyaMessageSubscribeWebsocket.URL.IN,
};

export function startPulsarConsumer(io: SocketServer, log: FastifyBaseLogger): void {
  const accessId  = process.env.TUYA_ACCESS_ID!;
  const accessKey = process.env.TUYA_ACCESS_SECRET!;
  const region    = (process.env.TUYA_REGION ?? 'us').toLowerCase();
  const envName   = process.env.TUYA_PULSAR_ENV ?? 'prod';

  const url = (REGION_URL[region] ?? TuyaMessageSubscribeWebsocket.URL.US) as typeof TuyaMessageSubscribeWebsocket.URL.US;
  const env = envName === 'test'
    ? TuyaMessageSubscribeWebsocket.env.TEST
    : TuyaMessageSubscribeWebsocket.env.PROD;

  const client = new TuyaMessageSubscribeWebsocket({
    accessId,
    accessKey,
    url,
    env,
    maxRetryTimes: 100,
    logger: (level, ...args) => {
      if (level === 'ERROR') log.error(args, '[pulsar]');
    },
  });

  client.open(() => log.info('[pulsar] connected'));
  client.reconnect(() => log.info('[pulsar] reconnected'));
  client.error((_, err) => log.error({ err }, '[pulsar] connection error'));

  client.message((_, msg) => {
    try {
      const data = msg?.payload?.data;
      if (!data) return;

      const devId  = (data.devId ?? msg?.payload?.devId) as string | undefined;
      const status = (Array.isArray(data.status) ? data.status : []) as Array<{
        code: string; value: unknown;
      }>;

      if (!devId || status.length === 0) {
        client.ackMessage(msg.messageId);
        return;
      }

      // Lock events
      if (devId === LOCK_ID) {
        for (const event of status) {
          if (UNLOCK_CODES.has(event.code)) {
            lockState.status    = 'unlocked';
            lockState.method    = CODE_METHOD[event.code] ?? event.code;
            lockState.updatedAt = new Date().toISOString();
            log.info({ lockState }, '[pulsar] lock unlocked');
            io.emit('lock:status', lockState);
          } else if (LOCK_CODES.has(event.code)) {
            lockState.status    = 'locked';
            lockState.method    = null;
            lockState.userName  = null;
            lockState.updatedAt = new Date().toISOString();
            log.info({ lockState }, '[pulsar] lock locked');
            io.emit('lock:status', lockState);
          }
        }
      }

      // General device status (switches etc.) — same shape as polling
      io.emit('device:status', [{ id: devId, status }]);
      log.info({ devId }, '[pulsar] device:status emitted');

      client.ackMessage(msg.messageId);
    } catch (err) {
      log.error({ err }, '[pulsar] message processing error');
    }
  });

  client.start();
  log.info('[pulsar] consumer starting');
}
