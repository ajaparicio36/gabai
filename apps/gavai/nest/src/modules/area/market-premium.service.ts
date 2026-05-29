import { Injectable } from '@nestjs/common';
import { PrismaService } from '@gavai/platform';
import { ValuationService } from '../valuation/valuation.service';

interface MarketPremiumResult {
  score: number;
  avmPerSqm: number;
  zonalPerSqm: number | null;
  ratio: number | null;
}

@Injectable()
export class MarketPremiumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly valuationService: ValuationService,
  ) {}

  async getScore(lat: number, lng: number): Promise<MarketPremiumResult> {
    const geoCoding = await this.reverseGeocode(lat, lng);
    const barangay = geoCoding?.barangay ?? null;
    const city = geoCoding?.city ?? null;

    let zonalValuePhp: number | null = null;

    if (barangay && city) {
      const zonalRecord = await this.prisma.zonalValue.findFirst({
        where: { barangay, city },
      });
      if (zonalRecord) {
        zonalValuePhp = zonalRecord.zonalValuePhp;
      }
    }

    if (zonalValuePhp == null && city) {
      const cityRecord = await this.prisma.zonalValue.findFirst({
        where: { city },
      });
      if (cityRecord) {
        zonalValuePhp = cityRecord.zonalValuePhp;
      }
    }

    let avmPerSqm = 0;
    try {
      const valuation = await this.valuationService.createValuation({
        lat,
        lng,
        propertyType: 'house_and_lot',
      });
      avmPerSqm = valuation.pricePerSqmPhp;
    } catch {
      void 0;
    }

    if (zonalValuePhp == null || zonalValuePhp <= 0 || avmPerSqm <= 0) {
      return {
        score: 0.5,
        avmPerSqm,
        zonalPerSqm: zonalValuePhp,
        ratio: null,
      };
    }

    const ratio = avmPerSqm / zonalValuePhp;
    const score = this.ratioToScore(ratio);

    return {
      score,
      avmPerSqm,
      zonalPerSqm: zonalValuePhp,
      ratio,
    };
  }

  private ratioToScore(ratio: number): number {
    if (ratio < 1.0) return 0.3;
    if (ratio < 2.0) return 0.5;
    if (ratio < 4.0) return 0.8;
    if (ratio < 7.0) return 0.9;
    return 0.7;
  }

  private async reverseGeocode(
    lat: number,
    lng: number,
  ): Promise<{ barangay: string | null; city: string | null } | null> {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.GOOGLE_MAPS_KEY ?? ''}`;
      const response = await fetch(url);
      const data = (await response.json()) as {
        status: string;
        results?: {
          address_components?: { types: string[]; long_name: string }[];
        }[];
      };

      if (data.status !== 'OK' || !data.results?.[0]) return null;

      const components = data.results[0].address_components ?? [];
      let barangay: string | null = null;
      let city: string | null = null;

      for (const comp of components) {
        const types = comp.types ?? [];
        if (
          types.includes('administrative_area_level_4') ||
          types.includes('sublocality_level_1') ||
          types.includes('sublocality')
        ) {
          barangay = comp.long_name;
        }
        if (
          types.includes('administrative_area_level_2') ||
          types.includes('locality') ||
          types.includes('administrative_area_level_3')
        ) {
          city = comp.long_name;
        }
      }

      return { barangay, city };
    } catch {
      return null;
    }
  }
}
