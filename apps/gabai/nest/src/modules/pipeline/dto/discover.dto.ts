import { IsString, IsOptional, IsEnum } from 'class-validator';

export class DiscoverDto {
  @IsString()
  location!: string;

  @IsString()
  @IsOptional()
  @IsEnum(['residential_lot', 'house_and_lot', 'condo', 'commercial'])
  propertyType?: string;
}

export class DiscoverApproveDto {
  @IsString({ each: true })
  ids!: string[];
}
