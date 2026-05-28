import { Injectable } from '@nestjs/common';
import { PrismaService } from '@gavai/platform';

interface ReportRecord {
  id: string;
  valuationId: string;
  pdfUrl: string | null;
  verificationHash: string;
  createdAt: Date;
}

@Injectable()
export class ReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    valuationId: string,
    pdfUrl: string | null,
    verificationHash: string,
  ): Promise<ReportRecord> {
    return this.prisma.report.create({
      data: {
        valuationId,
        pdfUrl,
        verificationHash,
      },
    }) as Promise<ReportRecord>;
  }

  async findById(id: string): Promise<ReportRecord | null> {
    return this.prisma.report.findUnique({
      where: { id },
    }) as Promise<ReportRecord | null>;
  }

  async findByValuationId(valuationId: string): Promise<ReportRecord | null> {
    return this.prisma.report.findUnique({
      where: { valuationId },
    }) as Promise<ReportRecord | null>;
  }
}
