import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import socketPlugin from './plugins/socket.plugin';
import authPlugin from './plugins/auth.plugin';
import { authRoutes } from './routes/auth.route';
import { deviceRoutes } from './routes/devices.route';
import { labelRoutes } from './routes/labels.route';
import { weatherRoutes } from './routes/weather.route';

dotenv.config();

const app = Fastify({ logger: true });

async function start() {
  await app.register(cors, { origin: '*' });
  await app.register(socketPlugin);
  await app.register(authPlugin);
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(deviceRoutes, { prefix: '/devices' });
  await app.register(labelRoutes, { prefix: '/devices' });
  await app.register(weatherRoutes, { prefix: '/weather' });

  const port = Number(process.env.PORT) || 3001;
  await app.listen({ port, host: '0.0.0.0' });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});