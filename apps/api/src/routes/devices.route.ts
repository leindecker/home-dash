import { FastifyInstance } from 'fastify';
import { DeviceCommand } from '@home-dash/types';
import {
  getDevices,
  getDeviceStatus,
  sendCommand,
  getDeviceLogs,
  getLockLogs,
} from '../services/tuya.service';

export async function deviceRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (_req, reply) => {
    try {
      return await getDevices();
    } catch (err) {
      reply.status(500);
      return { error: (err as Error).message };
    }
  });

  fastify.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    try {
      return await getDeviceStatus(req.params.id);
    } catch (err) {
      reply.status(500);
      return { error: (err as Error).message };
    }
  });

  fastify.post<{ Params: { id: string }; Body: DeviceCommand }>(
    '/:id/command',
    async (req, reply) => {
      try {
        return await sendCommand(req.params.id, req.body.commands);
      } catch (err) {
        reply.status(500);
        return { error: (err as Error).message };
      }
    }
  );

  fastify.get<{ Params: { id: string } }>('/:id/logs', async (req, reply) => {
    try {
      return await getDeviceLogs(req.params.id);
    } catch (err) {
      reply.status(500);
      return { error: (err as Error).message };
    }
  });

  const LOCK_ID = 'eb7dac4405840b22d2bniz';

  fastify.get('/lock/logs', async (_req, reply) => {
    try {
      const rawLogs = await getLockLogs(LOCK_ID);

      return rawLogs.map((entry) => {
        const log = entry as { event_time?: number; code?: string };
        const ts = log.event_time ? new Date(log.event_time).toISOString() : '';
        const code = log.code ?? '';

        let action: string;
        let method: string;
        let description: string;

        switch (code) {
          case 'unlock_fingerprint':
            action = 'unlock'; method = 'fingerprint'; description = 'Aberta por digital'; break;
          case 'unlock_password':
            action = 'unlock'; method = 'password'; description = 'Aberta por senha'; break;
          case 'unlock_app':
            action = 'unlock'; method = 'app'; description = 'Aberta pelo app'; break;
          case 'unlock_key':
            action = 'unlock'; method = 'key'; description = 'Aberta por chave física'; break;
          case 'lock_motor':
            action = 'lock'; method = 'auto'; description = 'Trancada automaticamente'; break;
          case 'alarm_lock':
            action = 'alarm'; method = 'alarm'; description = 'Tentativa inválida'; break;
          default:
            action = 'unknown'; method = 'unknown'; description = 'Evento desconhecido';
        }

        return { eventTime: ts, action, method, description };
      });
    } catch (err) {
      reply.status(500);
      return { error: (err as Error).message };
    }
  });
}