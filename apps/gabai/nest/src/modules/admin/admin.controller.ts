import { Controller, Post, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ValuationService } from '../valuation/valuation.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly valuationService: ValuationService) {}

  @Get('train/records')
  async getTrainingRecords() {
    return this.valuationService.getTrainingRecords();
  }

  @Post('train/retrain')
  async triggerRetrain() {
    return this.valuationService.triggerRetrain();
  }

  @Get('model/versions')
  async getModelVersions() {
    return this.valuationService.getModelVersions();
  }

  @Post('model/promote/:version')
  async promoteModel(@Param('version') version: string) {
    return this.valuationService.promoteModelVersion(version);
  }
}
