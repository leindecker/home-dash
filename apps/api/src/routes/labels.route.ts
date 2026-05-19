import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';

export async function labelRoutes(fastify: FastifyInstance) {
  // GET /devices/:deviceId/switches/labels
  fastify.get<{ Params: { deviceId: string } }>(
    '/:deviceId/switches/labels',
    async (req) => {
      const { deviceId } = req.params;
      return prisma.switchLabel.findMany({
        where: { deviceId },
        select: { code: true, label: true },
      });
    }
  );

  // PATCH /devices/:deviceId/switches/:code/label
  fastify.patch<{
    Params: { deviceId: string; code: string };
    Body: { label: string };
  }>(
    '/:deviceId/switches/:code/label',
    async (req, reply) => {
      const { deviceId, code } = req.params;
      const { label } = req.body;

      if (typeof label !== 'string' || label.trim().length === 0) {
        reply.status(400);
        return { error: 'label is required' };
      }

      const result = await prisma.switchLabel.upsert({
        where: { deviceId_code: { deviceId, code } },
        update: { label: label.trim() },
        create: { deviceId, code, label: label.trim() },
      });

      return { deviceId: result.deviceId, code: result.code, label: result.label };
    }
  );
}