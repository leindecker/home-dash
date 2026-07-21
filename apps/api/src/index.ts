import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import socketPlugin from './plugins/socket.plugin';
import authPlugin from './plugins/auth.plugin';
import { authRoutes } from './routes/auth.route';
import { deviceRoutes } from './routes/devices.route';
import { labelRoutes } from './routes/labels.route';
import { weatherRoutes } from './routes/weather.route';
import { roomsRoutes } from './routes/rooms.route';
import { webhookRoutes } from './routes/webhook.route';
import { vacuumRoutes } from './routes/vacuum.route';
import { startPulsarConsumer } from './services/tuya.pulsar';
import { cache } from './services/cache.service';

dotenv.config();

const app = Fastify({ logger: true });

async function start() {
  await app.register(cors, { origin: '*' });
  await app.register(socketPlugin);
  await app.register(authPlugin);

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  app.get('/cache/stats', async () => ({
    timestamp: new Date().toISOString(),
    message: 'Cache em memória ativo',
    ...cache.stats(),
  }));

  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(deviceRoutes, { prefix: '/devices' });
  await app.register(labelRoutes, { prefix: '/devices' });
  await app.register(weatherRoutes, { prefix: '/weather' });
  await app.register(roomsRoutes, { prefix: '/rooms' });
  await app.register(webhookRoutes, { prefix: '/webhook' });
  await app.register(vacuumRoutes, { prefix: '/vacuum' });

  const port = Number(process.env.PORT) || 3001;
  await app.listen({ port, host: '0.0.0.0' });

  try {
    startPulsarConsumer(app.io, app.log);
  } catch (err) {
    app.log.error({ err }, '[pulsar] failed to start consumer — continuing without it');
  }

  const SELF_URL = process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:3001';
  setInterval(async () => {
    try {
      await fetch(`${SELF_URL}/health`);
      console.log('[ping] Self-ping ok:', new Date().toISOString());
    } catch (e) {
      console.error('[ping] Self-ping failed:', e);
    }
  }, 10 * 60 * 1000);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});