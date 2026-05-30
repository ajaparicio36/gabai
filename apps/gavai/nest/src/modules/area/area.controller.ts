import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Param,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { AreaService, AreaIntelligenceResult } from './area.service';
import { FloodOverlayService } from './flood-overlay.service';

@Controller('area')
@UseGuards(JwtAuthGuard)
export class AreaController {
  constructor(
    private readonly areaService: AreaService,
    private readonly floodOverlayService: FloodOverlayService,
  ) {}

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

  @Get('flood-tile/:z/:x/:y')
  async getFloodTile(
    @Param('z') z: string,
    @Param('x') x: string,
    @Param('y') y: string,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.floodOverlayService.getTile(
      Number(z),
      Number(x),
      Number(y),
    );
    if (!data) {
      res.status(204).send();
      return;
    }
    res.setHeader('Content-Type', 'application/vnd.mapbox-vector-tile');
    res.send(Buffer.from(data));
  }
}
