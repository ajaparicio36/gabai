import { Injectable } from '@nestjs/common';
import { PrismaService } from '@gavai/platform';

export interface ZonalLookupResult {
  value: number;
  confidence:
    | 'exact_subdivision'
    | 'street'
    | 'barangay_median'
    | 'city_median'
    | 'not_found';
}

@Injectable()
export class ZonalLookupService {
  constructor(private readonly prisma: PrismaService) {}

  async getZonalValue(
    barangay: string | null,
    city: string | null,
    streetOrSubd?: string,
  ): Promise<ZonalLookupResult> {
    if (!barangay || !city) {
      return { value: 0, confidence: 'not_found' };
    }

    if (streetOrSubd) {
      const exact = await this.prisma.zonalValue.findFirst({
        where: {
          barangay,
          city,
          streetOrSubd: { contains: streetOrSubd, mode: 'insensitive' },
          zoneType: 'subdivision',
        },
      });
      if (exact) {
        return { value: exact.zonalValuePhp, confidence: 'exact_subdivision' };
      }

      const street = await this.prisma.zonalValue.findFirst({
        where: {
          barangay,
          city,
          streetOrSubd: { contains: streetOrSubd, mode: 'insensitive' },
        },
      });
      if (street) {
        return { value: street.zonalValuePhp, confidence: 'street' };
      }
    }

    const brgyVals = await this.prisma.zonalValue.findMany({
      where: { barangay, city },
    });
    if (brgyVals.length > 0) {
      const median = this.computeMedian(brgyVals.map((v) => v.zonalValuePhp));
      return { value: median, confidence: 'barangay_median' };
    }

    const cityVals = await this.prisma.zonalValue.findMany({
      where: { city },
    });
    if (cityVals.length > 0) {
      const median = this.computeMedian(cityVals.map((v) => v.zonalValuePhp));
      return { value: median, confidence: 'city_median' };
    }

    return { value: 0, confidence: 'not_found' };
  }

  private computeMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }
}
