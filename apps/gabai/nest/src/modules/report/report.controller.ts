import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { ReportService, ReportResult } from './report.service';

interface GenerateReportDto {
  valuationId: string;
}

@Controller('report')
@UseGuards(JwtAuthGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post('generate')
  async generate(@Body() body: GenerateReportDto): Promise<ReportResult> {
    return this.reportService.generateReport(body.valuationId);
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<ReportResult> {
    return this.reportService.getReport(id);
  }
}
