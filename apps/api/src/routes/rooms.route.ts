import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { getDevices } from '../services/tuya.service';
import { Device } from '@home-dash/types';

function getSwitchCodes(device: Device): string[] {
  const fromStatus = (device.status ?? [])
    .filter((s) => /^switch_\d+$/.test(s.code))
    .map((s) => s.code)
    .sort();
  if (fromStatus.length > 0) return fromStatus;
  const count = device.buttons ?? 1;
  return Array.from({ length: count }, (_, i) => `switch_${i + 1}`);
}

export async function roomsRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (_req, reply) => {
    try {
      return await prisma.room.findMany({
        include: { switches: true },
        orderBy: { order: 'asc' },
      });
    } catch (err) {
      reply.status(500);
      return { error: (err as Error).message };
    }
  });

  fastify.post<{ Body: { name: string; icon?: string; order?: number } }>(
    '/',
    async (req, reply) => {
      try {
        return await prisma.room.create({
          data: {
            name: req.body.name,
            icon: req.body.icon ?? 'ti-home',
            order: req.body.order ?? 0,
          },
          include: { switches: true },
        });
      } catch (err) {
        reply.status(500);
        return { error: (err as Error).message };
      }
    }
  );

  // Must be registered before /:id to avoid route conflict
  fastify.get('/unassigned', async (_req, reply) => {
    try {
      const devices = (await getDevices()) as Device[];
      const switchDevices = devices.filter((d) => d.type === 'switch');

      const assigned = await prisma.roomSwitch.findMany({
        select: { deviceId: true, code: true },
      });
      const assignedSet = new Set(assigned.map((a) => `${a.deviceId}:${a.code}`));

      const result: { deviceId: string; deviceName: string; code: string; label: string }[] = [];
      for (const device of switchDevices) {
        for (const code of getSwitchCodes(device)) {
          if (!assignedSet.has(`${device.id}:${code}`)) {
            const n = code.match(/^switch_(\d+)$/)?.[1];
            result.push({
              deviceId: device.id,
              deviceName: device.name,
              code,
              label: n ? `L${n}` : code,
            });
          }
        }
      }
      return result;
    } catch (err) {
      reply.status(500);
      return { error: (err as Error).message };
    }
  });

  fastify.patch<{ Params: { id: string }; Body: { name?: string; icon?: string; order?: number } }>(
    '/:id',
    async (req, reply) => {
      try {
        return await prisma.room.update({
          where: { id: req.params.id },
          data: req.body,
          include: { switches: true },
        });
      } catch (err) {
        reply.status(500);
        return { error: (err as Error).message };
      }
    }
  );

  fastify.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    try {
      await prisma.room.delete({ where: { id: req.params.id } });
      return { ok: true };
    } catch (err) {
      reply.status(500);
      return { error: (err as Error).message };
    }
  });

  fastify.post<{
    Params: { id: string };
    Body: { deviceId: string; code: string; label: string };
  }>('/:id/switches', async (req, reply) => {
    try {
      return await prisma.roomSwitch.upsert({
        where: { deviceId_code: { deviceId: req.body.deviceId, code: req.body.code } },
        create: {
          roomId: req.params.id,
          deviceId: req.body.deviceId,
          code: req.body.code,
          label: req.body.label,
        },
        update: { roomId: req.params.id, label: req.body.label },
      });
    } catch (err) {
      reply.status(500);
      return { error: (err as Error).message };
    }
  });

  fastify.delete<{ Params: { id: string; deviceId: string; code: string } }>(
    '/:id/switches/:deviceId/:code',
    async (req, reply) => {
      try {
        await prisma.roomSwitch.delete({
          where: {
            deviceId_code: {
              deviceId: req.params.deviceId,
              code: req.params.code,
            },
          },
        });
        return { ok: true };
      } catch (err) {
        reply.status(500);
        return { error: (err as Error).message };
      }
    }
  );
}