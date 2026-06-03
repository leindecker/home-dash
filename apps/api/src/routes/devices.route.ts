import { FastifyInstance } from 'fastify';
import { DeviceCommand } from '@home-dash/types';
import {
  getDevices,
  getDeviceStatus,
  sendCommand,
  getDeviceLogs,
  getLockLogs,
} from '../services/tuya.service';
import { lockState } from '../lib/lock-state';

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
        const error = err as Error;
        console.error('[route] /:id/command error', {
          deviceId: req.params.id,
          commands: req.body.commands,
          message: error.message,
          stack: error.stack,
        });
        reply.status(500);
        return { error: error.message };
      }
    }
  );

  // Current lock state (updated by webhook)
  fastify.get('/lock/state', async () => lockState);

  const LOCK_ID = 'eb7dac4405840b22d2bniz';

  const CODE_MAP: Record<string, { method: string; label: string }> = {
    unlock_fingerprint: { method: 'fingerprint', label: 'Digital'           },
    unlock_password:    { method: 'password',    label: 'Senha'             },
    unlock_app:         { method: 'app',         label: 'Aplicativo'        },
    unlock_phone:       { method: 'app',         label: 'Aplicativo'        },
    unlock_key:         { method: 'key',         label: 'Chave física'      },
    unlock_face:        { method: 'face',        label: 'Reconhecimento facial' },
    unlock_card:        { method: 'card',        label: 'Cartão'            },
    unlock_temporary:   { method: 'temp',        label: 'Senha temporária'  },
    lock_motor:         { method: 'auto',        label: 'Travamento automático' },
    alarm_lock:         { method: 'alarm',       label: 'Tentativa inválida'},
  };

  function capitalizeName(name: string | null): string | null {
    if (!name) return null;
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  fastify.get('/lock/logs', async (_req, reply) => {
    try {
      const raw = await getLockLogs(LOCK_ID);
      return raw
        .map((log) => {
          const ms = log.update_time < 9_999_999_999 ? log.update_time * 1000 : log.update_time;
          const mapped = CODE_MAP[log.status?.code] ?? { method: 'unknown', label: log.status?.code ?? 'Desconhecido' };
          return {
            eventTime: new Date(ms).toISOString(),
            method:    mapped.method,
            label:     mapped.label,
            userName:   capitalizeName(log.nick_name ?? null),
            unlockName: log.unlock_name || null,
          };
        })
        .sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime());
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