import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ValuationModule } from '../valuation/valuation.module';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { ReportRepository } from './report.repository';

@Module({
  imports: [AuthModule, ValuationModule],
  controllers: [ReportController],
  providers: [ReportService, ReportRepository],
  exports: [ReportService],
})
export class ReportModule {}
