import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class ScrapeApproveDto {
  @IsString({ each: true })
  ids!: string[];
}

export class ScrapeRejectDto {
  @IsString({ each: true })
  ids!: string[];

  @IsString()
  @IsOptional()
  reason?: string;
}

export class ScrapeEditDto {
  @IsString()
  id!: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsOptional()
  askingPricePhp?: number;

  @IsOptional()
  lotAreaSqm?: number;

  @IsOptional()
  floorAreaSqm?: number;

  @IsOptional()
  bedrooms?: number;

  @IsOptional()
  bathrooms?: number;

  @IsString()
  @IsOptional()
  propertyType?: string;

  @IsString()
  @IsOptional()
  developer?: string;

  @IsBoolean()
  @IsOptional()
  flagged?: boolean;
}
