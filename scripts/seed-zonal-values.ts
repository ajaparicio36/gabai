import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const govRefs = await prisma.governmentReference.findMany({});

  console.log(`Found ${govRefs.length} government reference records`);

  let inserted = 0;
  let skipped = 0;

  for (const ref of govRefs) {
    if (!ref.zonalValuePhp) {
      skipped++;
      continue;
    }

    const zonalValue = ref.zonalValuePhp;

    await prisma.zonalValue.upsert({
      where: {
        id: `zv-${ref.barangay}-default`,
      },
      update: {},
      create: {
        id: `zv-${ref.barangay}-default`,
        city: ref.city,
        barangay: ref.barangay,
        streetOrSubd: `${ref.barangay} (barangay-level)`,
        zoneType: 'street',
        zonalValuePhp: zonalValue,
        rdoSource: 'government_reference_fallback',
      },
    });

    const standardStreets = [
      `${ref.barangay} Main Road`,
      `${ref.barangay} Highway`,
      `${ref.barangay} Avenue`,
    ];

    for (const street of standardStreets) {
      const streetId = `zv-${ref.barangay}-${street.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const exists = await prisma.zonalValue.findUnique({
        where: { id: streetId },
      });
      if (exists) continue;

      const multiplier = 0.8 + Math.random() * 0.4;
      const streetValue = Math.round(zonalValue * multiplier * 100) / 100;

      await prisma.zonalValue.create({
        data: {
          id: streetId,
          city: ref.city,
          barangay: ref.barangay,
          streetOrSubd: street,
          zoneType: 'street',
          zonalValuePhp: streetValue,
          rdoSource: 'synthetic_barangay_median',
        },
      });
      inserted++;
    }

    inserted++;
  }

  console.log(
    `Inserted ${inserted} zonal value records (skipped ${skipped} without zonal value)`,
  );
  console.log(`Synthetic data generated — real BIR PDF extraction pending.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
