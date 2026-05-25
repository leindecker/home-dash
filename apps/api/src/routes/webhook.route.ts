import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { lockState } from '../lib/lock-state';

const ACCESS_SECRET = process.env.TUYA_ACCESS_SECRET!;
const LOCK_ID       = 'eb7dac4405840b22d2bniz';

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

function tryDecrypt(data: string): unknown {
  const key = ACCESS_SECRET.substring(0, 16);
  const decipher = crypto.createDecipheriv('aes-128-ecb', key, '');
  decipher.setAutoPadding(true);
  let out = decipher.update(data, 'base64', 'utf8');
  out += decipher.final('utf8');
  return JSON.parse(out);
}

function processEvents(
  events: Array<{ code: string; value: unknown; devId?: string }>,
  fastify: FastifyInstance
) {
  for (const event of events) {
    if (event.devId && event.devId !== LOCK_ID) continue;

    if (UNLOCK_CODES.has(event.code)) {
      lockState.status    = 'unlocked';
      lockState.method    = CODE_METHOD[event.code] ?? event.code;
      lockState.updatedAt = new Date().toISOString();
      fastify.log.info({ lockState }, '[webhook] unlocked');
      fastify.io.emit('lock:status', lockState);
    } else if (LOCK_CODES.has(event.code)) {
      lockState.status    = 'locked';
      lockState.method    = null;
      lockState.userName  = null;
      lockState.updatedAt = new Date().toISOString();
      fastify.log.info({ lockState }, '[webhook] locked');
      fastify.io.emit('lock:status', lockState);
    }
  }
}

export async function webhookRoutes(fastify: FastifyInstance) {
  // Tuya push endpoint
  fastify.post('/tuya', async (req, reply) => {
    fastify.log.info({ body: req.body }, '[webhook] received');

    try {
      const body = req.body as Record<string, unknown>;
      let events: Array<{ code: string; value: unknown; devId?: string }> = [];

      if (typeof body.data === 'string') {
        try {
          const decrypted = tryDecrypt(body.data) as {
            devId?: string;
            status?: Array<{ code: string; value: unknown }>;
          };
          fastify.log.info({ decrypted }, '[webhook] decrypted');
          if (Array.isArray(decrypted.status)) {
            events = decrypted.status.map(s => ({ ...s, devId: decrypted.devId }));
          }
        } catch {
          fastify.log.warn('[webhook] decryption failed, trying plain body');
          if (Array.isArray((body as { status?: unknown }).status)) {
            events = (body.status as Array<{ code: string; value: unknown }>)
              .map(s => ({ ...s, devId: body.devId as string | undefined }));
          }
        }
      } else if (Array.isArray(body.status)) {
        events = (body.status as Array<{ code: string; value: unknown }>)
          .map(s => ({ ...s, devId: body.devId as string | undefined }));
      }

      processEvents(events, fastify);
    } catch (err) {
      fastify.log.error({ err }, '[webhook] processing error');
    }

    // Tuya espera 200 independente do resultado
    return reply.status(200).send({ ok: true });
  });

  // Endpoint de teste local (POST /webhook/test)
  fastify.post('/test', async (req, reply) => {
    const { code, userName } = req.body as { code?: string; userName?: string };
    const eventCode = code ?? 'unlock_fingerprint';

    processEvents([{ code: eventCode, value: 1, devId: LOCK_ID }], fastify);
    if (userName) lockState.userName = userName;

    return reply.send(lockState);
  });
}
