import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { Server as SocketServer } from 'socket.io';
import { KNOWN_DEVICES, getDeviceStatus } from '../services/tuya.service';

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketServer;
  }
}

const POLL_INTERVAL_MS = 10_000;

export default fp(async function socketPlugin(fastify: FastifyInstance) {
  const io = new SocketServer(fastify.server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  fastify.decorate('io', io);

  io.on('connection', (socket) => {
    fastify.log.info(`Socket connected: ${socket.id}`);
    socket.on('disconnect', () => {
      fastify.log.info(`Socket disconnected: ${socket.id}`);
    });
  });

  const poll = async () => {
    if (io.sockets.sockets.size === 0) return;

    try {
      const statuses = await Promise.allSettled(
        KNOWN_DEVICES.map(async ({ id }) => ({
          id,
          status: await getDeviceStatus(id),
        }))
      );

      const updates = statuses
        .filter((r) => r.status === 'fulfilled')
        .map((r) => (r as PromiseFulfilledResult<{ id: string; status: unknown }>).value);

      io.emit('device:status', updates);
    } catch (err) {
      fastify.log.error({ err }, 'Socket poll error');
    }
  };

  const interval = setInterval(poll, POLL_INTERVAL_MS);

  fastify.addHook('onClose', () => {
    clearInterval(interval);
    io.close();
  });
});