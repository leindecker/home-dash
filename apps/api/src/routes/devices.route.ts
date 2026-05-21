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

  const LOCK_ID = 'eb7dac4405840b22d2bniz';

  fastify.get('/lock/logs', async (_req, reply) => {
    try {
      const rawLogs = await getLockLogs(LOCK_ID);
      console.log('[lock-logs] rawLogs[0]:', JSON.stringify(rawLogs?.[0], null, 2));

      return (rawLogs as Array<Record<string, unknown>>).map((log) => {
        // Tuya pode retornar timestamp em ms ou segundos
        const rawTime = log.event_time as number;
        let ts = '';
        if (rawTime) {
          // Se timestamp em segundos (menor que ano 2100 em ms)
          const ms = rawTime < 9999999999 ? rawTime * 1000 : rawTime;
          ts = new Date(ms).toISOString();
        }

        const code = (log.code as string) ?? '';
        const value = log.value;

        let action: string;
        let method: string;
        let description: string;

        // Mapeamento expandido dos códigos da Tuya
        if (code === 'unlock_fingerprint' || (code === '' && value === 'fingerprint')) {
          action = 'unlock'; method = 'fingerprint'; description = 'Aberta por digital';
        } else if (code === 'unlock_password') {
          action = 'unlock'; method = 'password'; description = 'Aberta por senha';
        } else if (code === 'unlock_app' || code === 'unlock_phone') {
          action = 'unlock'; method = 'app'; description = 'Aberta pelo app';
        } else if (code === 'unlock_key') {
          action = 'unlock'; method = 'key'; description = 'Aberta por chave física';
        } else if (code === 'unlock_face') {
          action = 'unlock'; method = 'face'; description = 'Aberta por reconhecimento facial';
        } else if (code === 'unlock_card') {
          action = 'unlock'; method = 'card'; description = 'Aberta por cartão';
        } else if (code === 'unlock_temporary') {
          action = 'unlock'; method = 'temp'; description = 'Aberta por senha temporária';
        } else if (code === 'lock_motor' || code === 'lock' || code === 'auto_lock') {
          action = 'lock'; method = 'auto'; description = 'Trancada automaticamente';
        } else if (code === 'alarm_lock' || code === 'alarm') {
          action = 'alarm'; method = 'alarm';
          const alarmDesc: Record<string, string> = {
            wrong_finger: 'Tentativa inválida — dedo não reconhecido',
            wrong_password: 'Tentativa inválida — senha incorreta',
            wrong_card: 'Tentativa inválida — cartão não reconhecido',
            wrong_face: 'Tentativa inválida — rosto não reconhecido',
          };
          description = alarmDesc[value as string] ?? 'Tentativa inválida';
        } else {
          action = 'unknown'; method = 'unknown'; description = `Evento: ${code || 'desconhecido'}`;
        }

        return { eventTime: ts, action, method, description };
      }).filter(log => log.action !== 'unknown'); // Remove eventos desconhecidos
    } catch (err) {
      reply.status(500);
      return { error: (err as Error).message };
    }
  });

  fastify.get<{ Params: { id: string } }>('/:id/logs', async (req, reply) => {
    try {
      return await getDeviceLogs(req.params.id);
    } catch (err) {
      reply.status(500);
      return { error: (err as Error).message };
    }
  });
}