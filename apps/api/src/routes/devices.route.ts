import { FastifyInstance } from 'fastify';
import { DeviceCommand } from '@home-dash/types';
import {
  getDevices,
  getDeviceStatus,
  sendCommand,
  getDeviceLogs,
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
}