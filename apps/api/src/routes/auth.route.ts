import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── simple in-memory rate limiter ────────────────────────

const attempts = new Map<string, { count: number; blockedUntil?: number }>();

function isBlocked(ip: string): boolean {
  const a = attempts.get(ip);
  if (!a) return false;
  if (a.blockedUntil && a.blockedUntil > Date.now()) return true;
  if (a.blockedUntil && a.blockedUntil <= Date.now()) {
    attempts.delete(ip);
    return false;
  }
  return false;
}

function recordFail(ip: string): void {
  const a = attempts.get(ip) ?? { count: 0 };
  a.count++;
  if (a.count >= 5) {
    a.blockedUntil = Date.now() + 15 * 60 * 1000;
    a.count = 0;
  }
  attempts.set(ip, a);
}

function clearAttempts(ip: string): void {
  attempts.delete(ip);
}

function jwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET not set');
  return s;
}

// ─── types ────────────────────────────────────────────────

interface LoginBody   { email: string; password: string }
interface Verify2FABody { tempToken: string; code: string; remember?: boolean }
interface Confirm2FABody { code: string }
interface RefreshBody   { rememberToken: string }
interface LogoutBody    { rememberToken: string }

// ─── routes ───────────────────────────────────────────────

export async function authRoutes(fastify: FastifyInstance) {

  // POST /auth/login
  fastify.post<{ Body: LoginBody }>('/login', async (req, reply) => {
    const ip = req.ip ?? '0.0.0.0';
    if (isBlocked(ip)) {
      reply.status(429);
      return { error: 'Too many failed attempts. Try again in 15 minutes.' };
    }

    const { email, password } = req.body ?? {};
    if (!email || !password) {
      reply.status(400);
      return { error: 'Email and password required' };
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      recordFail(ip);
      reply.status(401);
      return { error: 'Invalid credentials' };
    }

    clearAttempts(ip);

    if (user.totpEnabled) {
      const tempToken = jwt.sign(
        { userId: user.id, email: user.email, type: 'temp' },
        jwtSecret(),
        { expiresIn: '5m' }
      );
      return { requiresTwoFactor: true, tempToken };
    }

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      jwtSecret(),
      { expiresIn: '24h' }
    );
    return { accessToken, user: { id: user.id, email: user.email } };
  });

  // POST /auth/verify-2fa
  fastify.post<{ Body: Verify2FABody }>('/verify-2fa', async (req, reply) => {
    const { tempToken, code, remember } = req.body ?? {};
    if (!tempToken || !code) {
      reply.status(400);
      return { error: 'tempToken and code required' };
    }

    let payload: { userId: string; email: string; type: string };
    try {
      payload = jwt.verify(tempToken, jwtSecret()) as typeof payload;
    } catch {
      reply.status(401);
      return { error: 'Invalid or expired temp token' };
    }

    if (payload.type !== 'temp') {
      reply.status(401);
      return { error: 'Invalid token type' };
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user?.totpSecret) {
      reply.status(401);
      return { error: 'User not found or 2FA not configured' };
    }

    const valid = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!valid) {
      reply.status(401);
      return { error: 'Invalid 2FA code' };
    }

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      jwtSecret(),
      { expiresIn: '24h' }
    );

    let rememberToken: string | undefined;
    if (remember) {
      rememberToken = randomUUID();
      await prisma.rememberToken.create({
        data: {
          token: rememberToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }

    return { accessToken, rememberToken, user: { id: user.id, email: user.email } };
  });

  // POST /auth/setup-2fa  (protected)
  fastify.post('/setup-2fa', async (req, reply) => {
    if (!req.user) { reply.status(401); return { error: 'Unauthorized' }; }
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      reply.status(404);
      return { error: 'User not found' };
    }

    const secret = speakeasy.generateSecret({
      name: `HomeDash (${user.email})`,
      issuer: 'HomeDash',
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: secret.base32 },
    });

    const otpauthUrl = speakeasy.otpauthURL({
      secret: secret.base32,
      label: user.email,
      issuer: 'HomeDash',
      encoding: 'base32',
    });

    return { secret: secret.base32, otpauthUrl };
  });

  // POST /auth/confirm-2fa  (protected)
  fastify.post<{ Body: Confirm2FABody }>('/confirm-2fa', async (req, reply) => {
    if (!req.user) { reply.status(401); return { error: 'Unauthorized' }; }
    const { code } = req.body ?? {};
    if (!code) {
      reply.status(400);
      return { error: 'code required' };
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user?.totpSecret) {
      reply.status(400);
      return { error: '2FA not set up yet. Call /auth/setup-2fa first.' };
    }

    const valid = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!valid) {
      reply.status(400);
      return { error: 'Invalid code' };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { totpEnabled: true },
    });

    return { ok: true };
  });

  // POST /auth/disable-2fa  (protected)
  fastify.post('/disable-2fa', async (req, reply) => {
    if (!req.user) { reply.status(401); return { error: 'Unauthorized' }; }
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { totpEnabled: false, totpSecret: null },
    });
    return { ok: true };
  });

  // GET /auth/me  (protected)
  fastify.get('/me', async (req, reply) => {
    if (!req.user) { reply.status(401); return { error: 'Unauthorized' }; }
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, email: true, totpEnabled: true },
    });
    return user;
  });

  // POST /auth/refresh
  fastify.post<{ Body: RefreshBody }>('/refresh', async (req, reply) => {
    const { rememberToken } = req.body ?? {};
    if (!rememberToken) {
      reply.status(400);
      return { error: 'rememberToken required' };
    }

    const record = await prisma.rememberToken.findUnique({
      where: { token: rememberToken },
      include: { user: true },
    });

    if (!record || record.expiresAt < new Date()) {
      await prisma.rememberToken.deleteMany({ where: { token: rememberToken } });
      reply.status(401);
      return { error: 'Invalid or expired remember token' };
    }

    const accessToken = jwt.sign(
      { userId: record.user.id, email: record.user.email },
      jwtSecret(),
      { expiresIn: '24h' }
    );

    return { accessToken, user: { id: record.user.id, email: record.user.email } };
  });

  // POST /auth/logout  (protected)
  fastify.post<{ Body: LogoutBody }>('/logout', async (req) => {
    const { rememberToken } = req.body ?? {};
    if (rememberToken) {
      await prisma.rememberToken.deleteMany({ where: { token: rememberToken } });
    }
    return { ok: true };
  });
}
