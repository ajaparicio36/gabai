import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { ERROR_CODES } from '@gabai/platform';
import { ReportRepository } from './report.repository';
import { ValuationRepository } from '../valuation/valuation.repository';

export interface ReportResult {
  id: string;
  valuationId: string;
  pdfUrl: string | null;
  verificationHash: string;
  createdAt: Date;
}

@Injectable()
export class ReportService {
  constructor(
    private readonly reportRepository: ReportRepository,
    private readonly valuationRepository: ValuationRepository,
  ) {}

  async generateReport(valuationId: string): Promise<ReportResult> {
    const valuation = await this.valuationRepository.findById(valuationId);

    if (!valuation) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND.VALUATION,
        message: `Valuation not found: ${valuationId}`,
      });
    }

    const existing = await this.reportRepository.findByValuationId(valuationId);
    if (existing) {
      return existing;
    }

    const verificationHash = this.generateHash(valuationId);

    const pdfUrl = null;

    return this.reportRepository.create(valuationId, pdfUrl, verificationHash);
  }

  async getReport(id: string): Promise<ReportResult> {
    const report = await this.reportRepository.findById(id);

    if (!report) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND.REPORT,
        message: `Report not found: ${id}`,
      });
    }

    return report;
  }

  private generateHash(valuationId: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = createHash('sha256')
      .update(`${valuationId}:${salt}:${Date.now()}`)
      .digest('hex');
    return hash;
  }
}
