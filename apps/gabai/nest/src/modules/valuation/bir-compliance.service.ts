import { Injectable } from '@nestjs/common';
import { PrismaService } from '@gabai/platform';

export interface BirComplianceResult {
  complianceFloorPhp: number | null;
  auditRiskScore: number | null;
  riskLabel: 'green' | 'yellow' | 'red' | 'unknown';
  zonalValuePhp: number | null;
  assessmentLevel: number | null;
  lguAssessedValue: number | null;
}

@Injectable()
export class BirComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  async computeBirFloor(
    barangay: string | null,
    city: string | null,
    streetOrSubd: string | null,
    askingPricePhp: number | null,
    lotAreaSqm: number | null,
    floorAreaSqm: number | null,
  ): Promise<BirComplianceResult> {
    if (!barangay || !city) {
      return this.emptyResult();
    }

    let zonalValuePhp: number | null = null;

    if (streetOrSubd) {
      const exact = await this.prisma.zonalValue.findFirst({
        where: {
          barangay,
          city,
          streetOrSubd: { contains: streetOrSubd, mode: 'insensitive' },
        },
      });
      if (exact) zonalValuePhp = exact.zonalValuePhp;
    }

    if (zonalValuePhp == null) {
      const streetMatches = await this.prisma.zonalValue.findMany({
        where: { barangay, city },
      });
      if (streetMatches.length > 0) {
        zonalValuePhp = this.median(streetMatches.map((z) => z.zonalValuePhp));
      }
    }

    if (zonalValuePhp == null) {
      const cityMatches = await this.prisma.zonalValue.findMany({
        where: { city },
      });
      if (cityMatches.length > 0) {
        zonalValuePhp = this.median(cityMatches.map((z) => z.zonalValuePhp));
      }
    }

    const govRef = await this.prisma.governmentReference.findFirst({
      where: { barangay, city },
    });

    const assessmentLevel = govRef?.assessmentLevel ?? 0.02;
    const lguAssessedValue = govRef?.lguAssessedValue ?? null;

    const area = lotAreaSqm ?? floorAreaSqm ?? 0;
    const complianceFloorPhp =
      zonalValuePhp != null
        ? Math.max(zonalValuePhp, lguAssessedValue ?? 0) * area
        : null;

    let auditRiskScore: number | null = null;
    let riskLabel: BirComplianceResult['riskLabel'] = 'unknown';

    if (
      complianceFloorPhp != null &&
      askingPricePhp != null &&
      complianceFloorPhp > 0
    ) {
      auditRiskScore =
        (askingPricePhp - complianceFloorPhp) / complianceFloorPhp;

      if (auditRiskScore <= 0.3) {
        riskLabel = 'green';
      } else if (auditRiskScore <= 0.7) {
        riskLabel = 'yellow';
      } else {
        riskLabel = 'red';
      }
    }

    return {
      complianceFloorPhp: complianceFloorPhp
        ? Math.round(complianceFloorPhp)
        : null,
      auditRiskScore: auditRiskScore
        ? Math.round(auditRiskScore * 100) / 100
        : null,
      riskLabel,
      zonalValuePhp,
      assessmentLevel,
      lguAssessedValue,
    };
  }

  private median(values: number[]): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private emptyResult(): BirComplianceResult {
    return {
      complianceFloorPhp: null,
      auditRiskScore: null,
      riskLabel: 'unknown',
      zonalValuePhp: null,
      assessmentLevel: null,
      lguAssessedValue: null,
    };
  }
}
