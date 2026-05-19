import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@homedash.local';
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`User ${email} already exists — skipping.`);
    return;
  }

  const password = await bcrypt.hash('Admin@1234', 12);
  await prisma.user.create({ data: { email, password } });
  console.log(`Created user: ${email}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
