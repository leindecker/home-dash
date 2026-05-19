import { PrismaClient } from '@prisma/client';

// Single instance shared across the process
export const prisma = new PrismaClient();