import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { Server as SocketServer } from 'socket.io';

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketServer;
  }
}

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

  // Real-time device status updates are pushed by the Pulsar consumer
  // (tuya.pulsar.ts) — no polling needed here.

  fastify.addHook('onClose', () => {
    io.close();
  });
});