import { Injectable } from '@nestjs/common';
import { PrismaService } from '@gavai/platform';

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
    pointEstimatePhp: number | null,
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

    const lguAssessedValue = govRef?.lguAssessedValue ?? null;
    const assessmentLevel = govRef?.assessmentLevel ?? 0.02;

    const area = lotAreaSqm ?? floorAreaSqm ?? 0;
    const zFloor = (zonalValuePhp ?? 0) * area;
    const assessFloor =
      lguAssessedValue != null && assessmentLevel > 0
        ? lguAssessedValue / assessmentLevel
        : 0;

    const F_BIR = Math.max(zFloor, assessFloor);

    let auditRiskScore: number | null = null;
    let riskLabel: BirComplianceResult['riskLabel'] = 'unknown';

    if (F_BIR > 0 && pointEstimatePhp != null) {
      auditRiskScore = ((pointEstimatePhp - F_BIR) / F_BIR) * 100;

      if (auditRiskScore > 0) {
        riskLabel = 'green';
      } else if (auditRiskScore >= -5) {
        riskLabel = 'yellow';
      } else {
        riskLabel = 'red';
      }
    }

    return {
      complianceFloorPhp: F_BIR > 0 ? Math.round(F_BIR) : null,
      auditRiskScore:
        auditRiskScore != null ? Math.round(auditRiskScore * 100) / 100 : null,
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
