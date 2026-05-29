import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { ERROR_CODES } from '@gavai/platform';
import { ReportRepository } from './report.repository';
import { ValuationRepository } from '../valuation/valuation.repository';

export interface ReportResult {
  id: string;
  valuationId: string;
  pdfUrl: string | null;
  verificationHash: string;
  createdAt: Date;
  normalizedListings: unknown[];
  warnings: string[];
}

@Injectable()
export class ReportService {
  constructor(
    private readonly reportRepository: ReportRepository,
    private readonly valuationRepository: ValuationRepository,
  ) {}

  async generateReport(valuationId: string): Promise<ReportResult> {
    const valuation =
      await this.valuationRepository.findValuationById(valuationId);

    if (!valuation) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND.VALUATION,
        message: `Valuation not found: ${valuationId}`,
      });
    }

    const normalizedListings =
      valuation.inputLat != null && valuation.inputLng != null
        ? await this.reportRepository.findNormalizedComparablesForValuation({
            lat: valuation.inputLat,
            lng: valuation.inputLng,
            propertyType: valuation.propertyType,
            radiusM: 3000,
          })
        : [];

    const warnings =
      normalizedListings.length < 3
        ? ['Not enough normalized comparable listings in this area']
        : [];

    const existing = await this.reportRepository.findByValuationId(valuationId);
    if (existing) {
      return { ...existing, normalizedListings, warnings };
    }

    const verificationHash = this.generateHash(valuationId);

    const pdfUrl = null;

    const report = await this.reportRepository.create(
      valuationId,
      pdfUrl,
      verificationHash,
    );
    return { ...report, normalizedListings, warnings };
  }

  async getReport(id: string): Promise<ReportResult> {
    const report = await this.reportRepository.findById(id);

    if (!report) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND.REPORT,
        message: `Report not found: ${id}`,
      });
    }

    const valuation = await this.valuationRepository.findValuationById(
      report.valuationId,
    );
    const normalizedListings =
      valuation && valuation.inputLat != null && valuation.inputLng != null
        ? await this.reportRepository.findNormalizedComparablesForValuation({
            lat: valuation.inputLat,
            lng: valuation.inputLng,
            propertyType: valuation.propertyType,
            radiusM: 3000,
          })
        : [];

    const warnings =
      normalizedListings.length < 3
        ? ['Not enough normalized comparable listings in this area']
        : [];

    return { ...report, normalizedListings, warnings };
  }

  private generateHash(valuationId: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = createHash('sha256')
      .update(`${valuationId}:${salt}:${Date.now()}`)
      .digest('hex');
    return hash;
  }
}
