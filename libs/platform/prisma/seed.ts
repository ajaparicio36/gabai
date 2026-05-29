import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL || 'admin@gavai.dev';
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  if (process.env.RESET_ADMIN === 'true') {
    console.log(`Resetting admin user password for: ${email}`);
    await prisma.user.deleteMany({ where: { email } });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'admin',
      tier: 'paid',
      emailVerified: true,
    },
  });

  console.log(`Admin user created: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
