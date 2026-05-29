import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  Min,
  Max,
  IsEnum,
} from 'class-validator';

export class CreateCrawlSeedDto {
  @IsString()
  url!: string;

  @IsString()
  site!: string;

  @IsString()
  @IsOptional()
  @IsEnum(['all', 'residential_lot', 'house_and_lot', 'condo', 'commercial'])
  propertyType?: string;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  maxPages?: number;

  @IsInt()
  @Min(1000)
  @Max(30000)
  @IsOptional()
  requestDelayMs?: number;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class UpdateCrawlSeedDto {
  @IsString()
  @IsOptional()
  url?: string;

  @IsString()
  @IsOptional()
  site?: string;

  @IsString()
  @IsOptional()
  @IsEnum(['all', 'residential_lot', 'house_and_lot', 'condo', 'commercial'])
  propertyType?: string;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  maxPages?: number;

  @IsInt()
  @Min(1000)
  @Max(30000)
  @IsOptional()
  requestDelayMs?: number;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class CrawlRunDto {
  @IsString({ each: true })
  seedIds!: string[];

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  maxPages?: number;

  @IsInt()
  @Min(1000)
  @Max(30000)
  @IsOptional()
  requestDelayMs?: number;
}
