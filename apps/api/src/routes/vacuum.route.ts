import { FastifyInstance } from 'fastify';
import { getVacuumStatus, sendVacuumCommand, startRoomCleaning } from '../services/vacuum.service';

export async function vacuumRoutes(fastify: FastifyInstance) {
  fastify.get('/status', async (_req, _reply) => {
    return await getVacuumStatus();
  });

  fastify.post<{ Body: { command: string; params?: unknown[] } }>(
    '/command',
    async (req, reply) => {
      try {
        const { command, params = [] } = req.body;
        return await sendVacuumCommand(command, params);
      } catch (err) {
        reply.status(500);
        return { error: (err as Error).message };
      }
    }
  );

  fastify.post<{ Body: { roomIds: number[] } }>(
    '/rooms',
    async (req, reply) => {
      try {
        const { roomIds } = req.body;
        return await startRoomCleaning(roomIds);
      } catch (err) {
        reply.status(500);
        return { error: (err as Error).message };
      }
    }
  );
}
