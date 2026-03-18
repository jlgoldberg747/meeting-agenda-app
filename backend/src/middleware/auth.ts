import { FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../lib/supabase';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    accessToken: string;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }

  request.userId = data.user.id;
  request.accessToken = token;
}
