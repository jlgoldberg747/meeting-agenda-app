import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { templateRoutes } from './routes/templates';
import { meetingRoutes } from './routes/meetings';

export function buildApp() {
  const fastify = Fastify({ logger: process.env.NODE_ENV !== 'production' });

  fastify.register(helmet, { contentSecurityPolicy: false });
  fastify.register(cors, {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  fastify.get('/api/health', async () => ({ status: 'ok' }));

  fastify.register(templateRoutes, { prefix: '/api' });
  fastify.register(meetingRoutes, { prefix: '/api' });

  return fastify;
}
