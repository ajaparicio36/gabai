const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@gavai.dev';
  const password = 'admin123';

  console.log('Cleaning up existing admin user...');
  await prisma.user.deleteMany({ where: { email } });

  console.log('Hashing password...');
  const passwordHash = await bcrypt.hash(password, 12);

  console.log('Creating fresh admin user...');
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'admin',
      tier: 'paid',
      emailVerified: true,
    },
  });

  console.log('Admin user re-seeded successfully!');
}

main()
  .catch((e) => {
    console.error('Failed to re-seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
