import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { ValuationService } from './valuation.service';
import type { ValuationResult } from './valuation.service';

interface ValuationRequest {
  lat: number;
  lng: number;
  propertyType: string;
  lotAreaSqm?: number;
  floorAreaSqm?: number;
  bedrooms?: number;
  bathrooms?: number;
  buildingAgeYears?: number;
  address?: string;
  developer?: string;
}

@Controller('valuation')
@UseGuards(JwtAuthGuard)
export class ValuationController {
  constructor(private readonly valuationService: ValuationService) {}

  @Post()
  async createValuation(
    @Body() body: ValuationRequest,
  ): Promise<ValuationResult> {
    return this.valuationService.createValuation({
      lat: body.lat,
      lng: body.lng,
      propertyType: body.propertyType,
      lotAreaSqm: body.lotAreaSqm,
      floorAreaSqm: body.floorAreaSqm,
      bedrooms: body.bedrooms,
      bathrooms: body.bathrooms,
      buildingAgeYears: body.buildingAgeYears,
      address: body.address,
      developer: body.developer,
    });
  }

  @Get('model/info')
  async getModelInfo(): Promise<unknown> {
    return this.valuationService.getModelInfo();
  }

  @Get(':id')
  async getValuation(@Param('id') id: string): Promise<ValuationResult> {
    return this.valuationService.getValuation(id);
  }
}
