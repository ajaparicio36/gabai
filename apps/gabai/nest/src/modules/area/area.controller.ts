import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { AreaService, AreaIntelligenceResult } from './area.service';

@Controller('area')
@UseGuards(JwtAuthGuard)
export class AreaController {
  constructor(private readonly areaService: AreaService) {}

  @Get('intelligence')
  async getIntelligence(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radiusM') radiusM?: string,
  ): Promise<AreaIntelligenceResult> {
    return this.areaService.getIntelligence(
      Number(lat),
      Number(lng),
      radiusM ? Number(radiusM) : undefined,
    );
  }
}
