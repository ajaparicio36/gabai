import { PrismaClient } from '@prisma/client';

interface ZonalRecord {
  city: string;
  barangay: string;
  streetOrSubd: string | null;
  zoneType: string;
  zonalValuePhp: number;
  rdoSource: string;
}

async function parseCSV(
  filePath: string,
  rdoSource: string,
): Promise<ZonalRecord[]> {
  const fs = await import('fs/promises');
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim());

  const records: ZonalRecord[] = [];
  let currentBarangay = '';
  let currentCity = '';
  let currentZoneType = 'residential';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (
      trimmed.startsWith('BARANGAY:') ||
      trimmed.startsWith('ZONE/BARANGAY,')
    ) {
      if (trimmed.startsWith('BARANGAY:')) {
        const parts = trimmed.replace('BARANGAY:', '').split(',ZONE:');
        currentBarangay = parts[0]?.trim() ?? '';
        currentCity = parts[1]?.trim() ?? '';
      } else {
        const parts = trimmed.split(',');
        currentBarangay = parts[1]?.trim() ?? '';
        currentCity = parts[0]?.trim() ?? '';
      }
      continue;
    }

    if (trimmed.toUpperCase().includes('CONDOMINIUMS')) {
      currentZoneType = 'condominium';
      continue;
    }
    if (trimmed.toUpperCase().includes('TOWNHOUSES')) {
      currentZoneType = 'townhouse';
      continue;
    }

    const columns = trimmed.split(',').map((c) => c.trim());
    if (columns.length < 2) continue;

    const street = columns[0]?.replace(/\*/g, '').trim();
    if (
      !street ||
      street === '-' ||
      street.toUpperCase() === 'ALL OTHER STREETS'
    ) {
      continue;
    }

    const classifications = columns.slice(1);
    const classificationLabels = ['RR', 'CR', 'I', 'X', 'GL', 'GP'];

    for (
      let i = 0;
      i < classifications.length && i < classificationLabels.length;
      i++
    ) {
      const valStr = classifications[i]?.replace(/\*/g, '').trim();
      if (!valStr || valStr === '-' || valStr === '') continue;

      const zonalValuePhp = parseFloat(valStr.replace(/,/g, ''));
      if (isNaN(zonalValuePhp) || zonalValuePhp <= 0) continue;

      records.push({
        city: currentCity,
        barangay: currentBarangay,
        streetOrSubd: street,
        zoneType: currentZoneType,
        zonalValuePhp,
        rdoSource,
      });
    }
  }

  return records;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  try {
    const csvFiles = process.argv.slice(2);

    if (csvFiles.length === 0) {
      console.log(
        'Usage: npx tsx scripts/parse-bir-zonal.ts <csv-file> [csv-file...]',
      );
      console.log(
        'Each CSV file should be named like: rdo_XX_bir_zonal.csv where XX is the RDO number',
      );
      process.exit(1);
    }

    for (const filePath of csvFiles) {
      const fileName = filePath.split('/').pop() ?? filePath;
      const rdoMatch = fileName.match(/rdo_(\d+)/i);
      const rdoSource = rdoMatch
        ? `RDO_${rdoMatch[1]}`
        : fileName.replace('.csv', '');

      console.log(`Parsing ${fileName} (source: ${rdoSource})...`);
      const records = await parseCSV(filePath, rdoSource);
      console.log(`  Found ${records.length} records`);

      let inserted = 0;
      for (const record of records) {
        await prisma.zonalValue.create({ data: record });
        inserted++;
      }
      console.log(`  Inserted ${inserted} records`);
    }

    console.log('Done.');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
