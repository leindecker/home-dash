import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';

declare module 'fastify' {
  interface FastifyRequest {
    user?: { userId: string; email: string };
  }
}

// Soft auth: validates JWT if present but does NOT block unauthenticated requests.
// Route-level protection for the home dashboard is handled by Google OAuth in the
// Next.js middleware layer. Backend routes that need user context check req.user themselves.
export default fp(async function authPlugin(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request) => {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) return;

    const token = authorization.slice(7);
    const secret = process.env.JWT_SECRET;
    if (!secret) return;

    try {
      const payload = jwt.verify(token, secret) as {
        userId: string;
        email: string;
        type?: string;
      };
      if (payload.type !== 'temp') {
        request.user = { userId: payload.userId, email: payload.email };
      }
    } catch {
      // Invalid token — ignore, let the route decide
    }
  });
});
