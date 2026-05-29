import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
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

  @Post('ask')
  async askAboutArea(
    @Body('lat') lat: number,
    @Body('lng') lng: number,
    @Body('message') message: string,
    @Body('history')
    history?: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<{
    reply: string;
    sources: { title: string; url: string; domain: string }[];
  }> {
    return this.areaService.askAboutArea(lat, lng, message, history);
  }
}
